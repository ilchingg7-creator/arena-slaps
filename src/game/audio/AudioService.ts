import {
  getSoundDefinition,
  getSoundsByCategory,
  SOUND_MANIFEST,
  type SoundKey,
} from "../assets/soundManifest";
import type { IAudioBackend } from "./AudioBackend";

/**
 * Settings snapshot the AudioService cares about. The service does NOT
 * own settings — it reads from this object so the caller can keep all
 * settings in one place (e.g. GameSettings in localStorage).
 *
 * SFX and Music have independent mute + volume controls.
 */
export type AudioSettings = {
  sfxMuted: boolean;
  musicMuted: boolean;
  sfxVolume: number;
  musicVolume: number;
};

/**
 * High-level audio API. Scenes should call `playSlap()`, `playWin()`, etc.
 * — never {@link IAudioBackend.play} directly — so that per-sound volume
 * scaling, per-category mute, and future effect chains live in one place.
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
  private currentMusicKey: SoundKey | null = null;

  constructor(backend: IAudioBackend, settings: AudioSettings) {
    this.backend = backend;
    this.settings = { ...settings };
  }

  /**
   * Update the live settings (mute toggle, volume slider, etc.).
   *
   * When a category becomes muted, only the sounds in that category are
   * stopped (so e.g. muting music keeps currently-playing SFX alive and
   * vice-versa). Unmuting never starts playback automatically — callers
   * decide when to fire the next sound.
   *
   * When the music volume changes, the volume of the currently-playing
   * music track is updated in real-time via `backend.setVolume` — no
   * need to restart the track.
   */
  updateSettings(settings: AudioSettings): void {
    const previous = this.settings;
    this.settings = { ...settings };

    if (settings.sfxMuted && !previous.sfxMuted) {
      this.stopSfx();
    }
    if (settings.musicMuted && !previous.musicMuted) {
      this.stopMusic();
    }

    // Live-adjust the playing music track's volume without restarting it.
    if (
      !settings.musicMuted &&
      settings.musicVolume !== previous.musicVolume &&
      this.currentMusicKey !== null
    ) {
      const def = getSoundDefinition(this.currentMusicKey);
      const perSound = def.volume ?? 1;
      const volume = clamp01(settings.musicVolume * perSound);
      this.backend.setVolume(this.currentMusicKey, volume);
    }
  }

  /** Returns true when both SFX and Music are muted (for the top-right mute button). */
  isMasterMuted(): boolean {
    return this.settings.sfxMuted && this.settings.musicMuted;
  }

  /** Returns the currently-playing music key, or null if no music is playing. */
  getCurrentMusicKey(): SoundKey | null {
    return this.currentMusicKey;
  }

  isSfxMuted(): boolean {
    return this.settings.sfxMuted;
  }

  isMusicMuted(): boolean {
    return this.settings.musicMuted;
  }

  getSfxVolume(): number {
    return this.settings.sfxVolume;
  }

  getMusicVolume(): number {
    return this.settings.musicVolume;
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

  /**
   * Low-level escape hatch — plays a manifest key with the appropriate
   * category volume and mute applied. Music tracks loop; SFX do not.
   *
   * For music: if the same track is already playing, this is a no-op (prevents
   * restarts when navigating between menu scenes). If a different track is
   * playing, the old one is stopped first.
   */
  play(key: SoundKey): boolean {
    const def = getSoundDefinition(key);
    const isMusic = def.category === "music";

    if (isMusic) {
      if (this.settings.musicMuted) {
        return false;
      }
      // Don't restart the same track.
      if (this.currentMusicKey === key) {
        return true;
      }
      // Stop the previous track if one is playing.
      if (this.currentMusicKey !== null) {
        this.backend.stop(this.currentMusicKey);
      }
    } else {
      if (this.settings.sfxMuted) {
        return false;
      }
    }

    const perSound = def.volume ?? 1;
    const categoryVolume = isMusic
      ? this.settings.musicVolume
      : this.settings.sfxVolume;
    const volume = clamp01(categoryVolume * perSound);
    const loop = isMusic;
    const started = this.backend.play(key, volume, loop);

    if (isMusic && started) {
      this.currentMusicKey = key;
    }

    return started;
  }

  // ---------- High-level SFX API ----------

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

  // ---------- High-level Music API ----------

  /** Start the menu background music (loops via backend). */
  playMenuTheme(): boolean {
    return this.play("menu-theme");
  }

  /** Start the battle background music (loops via backend). */
  playBattleTheme(): boolean {
    return this.play("battle-theme");
  }

  /** Stop every currently-playing music-category sound. */
  stopMusic(): void {
    for (const def of getSoundsByCategory("music")) {
      this.backend.stop(def.key);
    }
    this.currentMusicKey = null;
  }

  /** Stop every currently-playing sfx-category sound. */
  stopSfx(): void {
    for (const def of getSoundsByCategory("sfx")) {
      this.backend.stop(def.key);
    }
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
