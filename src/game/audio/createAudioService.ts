import type { GameSettings } from "../config/gameSettings";
import {
  IAudioBackend,
  NoopAudioBackend,
  PhaserAudioBackend,
} from "./AudioBackend";
import { AudioService } from "./AudioService";

type PhaserSceneLike = ConstructorParameters<typeof PhaserAudioBackend>[0];

/**
 * Decide which audio backend to use for the current runtime.
 *
 * Returns a NoopAudioBackend when:
 *  - running in Node/SSR (typeof window === 'undefined')
 *  - the Phaser scene has no SoundManager (e.g. audio disabled in config)
 *
 * Otherwise returns a PhaserAudioBackend bound to the given scene.
 */
export function createAudioBackend(
  scene: PhaserSceneLike,
): IAudioBackend {
  if (typeof window === "undefined") {
    return new NoopAudioBackend();
  }

  if (!scene.sound) {
    return new NoopAudioBackend();
  }

  return new PhaserAudioBackend(scene);
}

/**
 * Convenience factory: creates a backend for the scene and wraps it in an
 * AudioService pre-loaded with the given settings.
 */
export function createAudioService(
  scene: PhaserSceneLike,
  settings: Pick<
    GameSettings,
    "sfxMuted" | "musicMuted" | "sfxVolume" | "musicVolume"
  >,
): AudioService {
  const backend = createAudioBackend(scene);
  return new AudioService(backend, {
    sfxMuted: settings.sfxMuted,
    musicMuted: settings.musicMuted,
    sfxVolume: settings.sfxVolume,
    musicVolume: settings.musicVolume,
  });
}
