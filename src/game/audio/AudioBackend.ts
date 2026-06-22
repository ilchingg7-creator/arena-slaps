import type { SoundKey } from "../assets/soundManifest";
import { getSoundDefinition } from "../assets/soundManifest";

/**
 * Low-level audio contract. Implementations are swappable:
 *   - {@link PhaserAudioBackend}  — production, uses Phaser.Sound.BaseSound
 *   - {@link NoopAudioBackend}    — tests, SSR, browsers without WebAudio
 *
 * The audio backend never reads settings; the {@link AudioService} is
 * responsible for applying per-category mute / volume before calling into the
 * backend.
 */
export interface IAudioBackend {
  /** Pre-load a sound asset. Safe to call multiple times for the same key. */
  load(key: SoundKey): void;
  /** Whether a sound has been loaded and is ready to play. */
  isLoaded(key: SoundKey): boolean;
  /**
   * Play a sound. Returns true iff the sound actually started.
   * Implementations must accept `volume` in [0, 1] and clamp out-of-range.
   * `loop` defaults to false; pass `true` for music tracks that should loop.
   */
  play(key: SoundKey, volume: number, loop?: boolean): boolean;
  /**
   * Stop a single currently-playing sound by key. Safe to call when the
   * sound is not playing (implementations must no-op gracefully).
   */
  stop(key: SoundKey): void;
  /**
   * Change the volume of a currently-playing sound. Safe to call when the
   * sound is not playing (implementations must no-op gracefully).
   * Used for live volume adjustments without restarting the track.
   */
  setVolume(key: SoundKey, volume: number): void;
  /** Stop every sound this backend knows about. */
  stopAll(): void;
}

type PhaserSound = {
  stop?: () => void;
  setVolume?: (volume: number) => void;
  destroy?: () => void;
  isPlaying?: boolean;
  // Use a permissive play signature — Phaser's BaseSound.play has a
  // complex overload (markerName?: string | SoundConfig, config?:
  // SoundConfig) that doesn't structurally match our duck type. We
  // cast to access it at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  play?: (...args: any[]) => boolean;
};

type PhaserLike = {
  load?: {
    audio: (key: string, urls: string | string[]) => void;
  };
  sound?: {
    get?: (key: string) => PhaserSound | null | undefined;
    play: (
      key: string,
      config?: { volume?: number; loop?: boolean },
    ) => boolean;
    add?: (key: string, config?: { volume?: number; loop?: boolean }) => PhaserSound;
    stopAll?: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    remove?: (sound: any) => boolean;
  };
  cache?: {
    audio?: { exists: (key: string) => boolean };
  };
};

/**
 * Production audio backend that delegates to Phaser's loader and SoundManager.
 *
 * Uses `sound.add(key, config)` to create a `BaseSound` instance, then calls
 * `BaseSound.play()` to start it. This gives us a DIRECT reference to the
 * sound object, which we store in `playingSounds` for reliable `setVolume()`
 * and `stop()` calls — `sound.get(key)` is unreliable after stopAll() cycles.
 */
export class PhaserAudioBackend implements IAudioBackend {
  private scene: PhaserLike;
  private loaded = new Set<SoundKey>();
  private playingSounds = new Map<string, PhaserSound>();

  constructor(scene: PhaserLike) {
    this.scene = scene;
  }

  load(key: SoundKey): void {
    if (this.loaded.has(key)) {
      return;
    }
    const def = getSoundDefinition(key);
    this.scene.load?.audio(key, def.path);
    this.loaded.add(key);
  }

  isLoaded(key: SoundKey): boolean {
    if (!this.loaded.has(key)) {
      return false;
    }
    return this.scene.cache?.audio?.exists(key) ?? true;
  }

  play(key: SoundKey, volume: number, loop?: boolean): boolean {
    const v = clamp01(volume);
    const config: { volume: number; loop?: boolean } = { volume: v };
    if (loop) {
      config.loop = true;
    }

    try {
      // If a sound with this key is already tracked, stop + remove it
      // first to avoid duplicate instances (sound.add() creates a NEW
      // BaseSound each time, so calling play() twice without cleanup
      // would leave the old one playing).
      const existing = this.playingSounds.get(key);
      if (existing) {
        try {
          existing.stop?.();
          if (this.scene.sound?.remove) {
            this.scene.sound.remove(existing);
          }
        } catch {
          // Best-effort
        }
        this.playingSounds.delete(key);
      }

      // Prefer sound.add() + BaseSound.play() — gives us a direct reference.
      // Fall back to sound.play() if add() is unavailable.
      if (this.scene.sound?.add) {
        const sound = this.scene.sound.add(key, config);
        if (sound) {
          this.playingSounds.set(key, sound);
          sound.play?.(undefined, config);
          return true;
        }
      }
      // Fallback: SoundManager.play() returns boolean (not the sound).
      this.scene.sound?.play(key, config);
      return true;
    } catch {
      return false;
    }
  }

  stop(key: SoundKey): void {
    try {
      const sound = this.playingSounds.get(key) ?? this.scene.sound?.get?.(key);
      sound?.stop?.();
      // Also remove from the SoundManager if possible.
      if (sound && this.scene.sound?.remove) {
        try {
          this.scene.sound.remove(sound);
        } catch {
          // Best-effort
        }
      }
    } catch {
      // Best-effort
    }
    this.playingSounds.delete(key);
  }

  setVolume(key: SoundKey, volume: number): void {
    const v = clamp01(volume);
    try {
      // Use the stored direct reference first (most reliable).
      const sound = this.playingSounds.get(key) ?? this.scene.sound?.get?.(key);
      if (sound) {
        if (typeof sound.setVolume === "function") {
          sound.setVolume(v);
        }
      }
    } catch {
      // Best-effort
    }
  }

  stopAll(): void {
    // Stop each tracked sound individually first (so we can remove them),
    // then call stopAll() as a safety net for any untracked sounds.
    for (const [, sound] of this.playingSounds) {
      try {
        sound.stop?.();
      } catch {
        // Best-effort
      }
    }
    this.playingSounds.clear();
    this.scene.sound?.stopAll?.();
  }
}

/**
 * No-op backend used in tests and during SSR. Tracks calls so tests can
 * assert on what would have been played.
 */
export class NoopAudioBackend implements IAudioBackend {
  calls: Array<{
    op: "load" | "play" | "stop" | "setVolume" | "stopAll";
    key?: SoundKey;
    volume?: number;
    loop?: boolean;
  }> = [];
  private loaded = new Set<SoundKey>();

  load(key: SoundKey): void {
    this.loaded.add(key);
    this.calls.push({ op: "load", key });
  }

  isLoaded(key: SoundKey): boolean {
    return this.loaded.has(key);
  }

  play(key: SoundKey, volume: number, loop?: boolean): boolean {
    this.calls.push({
      op: "play",
      key,
      volume: clamp01(volume),
      loop: loop === true,
    });
    return true;
  }

  stop(key: SoundKey): void {
    this.calls.push({ op: "stop", key });
  }

  setVolume(key: SoundKey, volume: number): void {
    this.calls.push({ op: "setVolume", key, volume: clamp01(volume) });
  }

  stopAll(): void {
    this.calls.push({ op: "stopAll" });
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
