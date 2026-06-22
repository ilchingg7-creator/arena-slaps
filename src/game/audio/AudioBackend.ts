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
    ) => unknown;
    stopAll?: () => void;
  };
  cache?: {
    audio?: { exists: (key: string) => boolean };
  };
};

/**
 * Production audio backend that delegates to Phaser's loader and SoundManager.
 *
 * `scene` should be the active Phaser.Scene during create(); we only touch
 * the loader + sound + cache, so a real Scene works fine and a duck-typed
 * stub works fine in tests.
 */
export class PhaserAudioBackend implements IAudioBackend {
  private scene: PhaserLike;
  private loaded = new Set<SoundKey>();

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
      this.scene.sound?.play(key, config);
      return true;
    } catch {
      return false;
    }
  }

  stop(key: SoundKey): void {
    try {
      const sound = this.scene.sound?.get?.(key);
      sound?.stop?.();
    } catch {
      // Best-effort: if Phaser can't find/stop the sound, no-op.
    }
  }

  setVolume(key: SoundKey, volume: number): void {
    try {
      const sound = this.scene.sound?.get?.(key);
      sound?.setVolume?.(clamp01(volume));
    } catch {
      // Best-effort: if Phaser can't find the sound, no-op.
    }
  }

  stopAll(): void {
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
