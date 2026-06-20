import { SOUND_MANIFEST, type SoundKey } from "../assets/soundManifest";
import { getSoundDefinition } from "../assets/soundManifest";
import type { IAudioBackend } from "./AudioBackend";

/**
 * Settings snapshot the AudioService cares about. The service does NOT
 * own settings — it reads from this object so the caller can keep all
 * settings in one place (e.g. GameSettings in localStorage).
 */
export type AudioSettings = {
  muted: boolean;
  masterVolume: number;
};

/**
 * High-level audio API. Scenes should call `playSlap()`, `playWin()`, etc.
 * — never {@link IAudioBackend.play} directly — so that per-sound volume
 * scaling, mute, and future effect chains live in one place.
 *
 * Replaceable design:
 *  - To swap the engine (e.g. to Web Audio API), pass a different
 *    {@link IAudioBackend} into the constructor.
 *  - To swap an individual sound asset, edit `soundManifest.ts`.
 *  - To add a new game event, add a method here and a key in the manifest.
 */
export class AudioService {
  private backend: IAudioBackend;
  private settings: AudioSettings;

  constructor(backend: IAudioBackend, settings: AudioSettings) {
    this.backend = backend;
    this.settings = { ...settings };
  }

  /** Update the live settings (mute toggle, volume slider, etc.). */
  updateSettings(settings: AudioSettings): void {
    this.settings = { ...settings };

    if (this.settings.muted) {
      this.backend.stopAll();
    }
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  getMasterVolume(): number {
    return this.settings.masterVolume;
  }

  /** Pre-load every sound in the manifest. Idempotent. */
  preloadAll(): void {
    for (const def of SOUND_MANIFEST) {
      this.backend.load(def.key);
    }
  }

  /** Pre-load a specific sound. Idempotent. */
  preload(key: SoundKey): void {
    this.backend.load(key);
  }

  /** Low-level escape hatch — plays a manifest key with master volume applied. */
  play(key: SoundKey): boolean {
    if (this.settings.muted) {
      return false;
    }

    const def = getSoundDefinition(key);
    const perSound = def.volume ?? 1;
    const volume = clamp01(this.settings.masterVolume * perSound);
    return this.backend.play(key, volume);
  }

  // ---------- High-level game event API ----------

  playSlapHit(): boolean {
    return this.play("slap-hit");
  }

  playSlapMiss(): boolean {
    return this.play("slap-miss");
  }

  playPowerUpCollect(): boolean {
    return this.play("powerup-collect");
  }

  playRingOut(): boolean {
    return this.play("ring-out");
  }

  playRoundWin(): boolean {
    return this.play("round-win");
  }

  playRoundLose(): boolean {
    return this.play("round-lose");
  }

  playRoundDraw(): boolean {
    return this.play("round-draw");
  }

  playCountdownTick(): boolean {
    return this.play("countdown-tick");
  }

  playMenuClick(): boolean {
    return this.play("menu-click");
  }

  playMenuStart(): boolean {
    return this.play("menu-start");
  }

  /** Stop everything immediately (e.g. on scene shutdown). */
  stopAll(): void {
    this.backend.stopAll();
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
