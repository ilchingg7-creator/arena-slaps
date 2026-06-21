import type { SoundKey } from "../assets/soundManifest";
import { getSoundDefinition } from "../assets/soundManifest";

/**
 * Low-level audio contract. Implementations are swappable:
 *   - {@link PhaserAudioBackend}  — production, uses Phaser.Sound.BaseSound
 *   - {@link NoopAudioBackend}    — tests, SSR, browsers without WebAudio
 *
 * The audio backend never reads settings; the {@link AudioService} is
 * responsible for applying mute / master volume before calling into the
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
   */
  play(key: SoundKey, volume: number): boolean;
  /** Stop every sound this backend knows about. */
  stopAll(): void;
}

type PhaserLike = {
  load?: {
    audio: (key: string, urls: string | string[]) => void;
  };
  sound?: {
    get?: (key: string) => unknown;
    play: (
      key: string,
      config?: { volume?: number },
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

  play(key: SoundKey, volume: number): boolean {
    const v = clamp01(volume);

    try {
      this.scene.sound?.play(key, { volume: v });
      return true;
    } catch {
      return false;
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
    op: "load" | "play" | "stopAll";
    key?: SoundKey;
    volume?: number;
  }> = [];
  private loaded = new Set<SoundKey>();

  load(key: SoundKey): void {
    this.loaded.add(key);
    this.calls.push({ op: "load", key });
  }

  isLoaded(key: SoundKey): boolean {
    return this.loaded.has(key);
  }

  play(key: SoundKey, volume: number): boolean {
    this.calls.push({ op: "play", key, volume: clamp01(volume) });
    return true;
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
