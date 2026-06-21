import type Phaser from "phaser";
import type { GameSettings } from "../config/gameSettings";
import type { AudioService } from "./AudioService";
import { createAudioService } from "./createAudioService";

/**
 * Registry key under which the shared {@link AudioService} singleton lives.
 * Stored on `scene.registry` so every Phaser scene in the same game reads
 * the SAME AudioService instance — and therefore shares the same
 * `currentMusicKey` tracking and the same backend.
 */
const REGISTRY_KEY = "audioService";

/**
 * Lazy-init accessor for the shared {@link AudioService} singleton.
 *
 * Bug context (fix-audio, bug 1): scenes used to call
 * `createAudioService(this, settings)` directly inside `create()`, which
 * built a fresh AudioService with its own `currentMusicKey` state per scene.
 * When MainMenuScene started `menu-theme` and the user navigated to
 * AudioSettingsScene, that new scene's AudioService didn't know about the
 * music the old one had started — so the mute button and volume sliders in
 * AudioSettingsScene had no effect on the actually-playing menu-theme.
 *
 * Fix: the first scene that calls this helper creates the AudioService and
 * stores it in `scene.registry`. Every subsequent scene reads the same
 * instance back, and we sync the latest settings into it via
 * {@link AudioService.updateSettings} so the mute / volume changes apply to
 * the music that's actually playing through the shared backend.
 */
export function getAudioService(
  scene: Phaser.Scene,
  settings: Pick<
    GameSettings,
    "sfxMuted" | "musicMuted" | "sfxVolume" | "musicVolume"
  >,
): AudioService {
  const existing = scene.registry.get(REGISTRY_KEY) as
    | AudioService
    | undefined;
  if (existing) {
    // Sync the latest settings into the shared instance so the actually-
    // playing music gets muted / re-volumed. This is what makes the
    // AudioSettingsScene sliders affect the menu-theme started by
    // MainMenuScene.
    existing.updateSettings({
      sfxMuted: settings.sfxMuted,
      musicMuted: settings.musicMuted,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
    });
    return existing;
  }
  const audio = createAudioService(scene, settings);
  scene.registry.set(REGISTRY_KEY, audio);
  return audio;
}
