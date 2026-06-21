import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { getAudioService } from "./getAudioService";

/**
 * Tests for the shared-singleton AudioService accessor.
 *
 * Bug context: every scene used to call `createAudioService(this, settings)`
 * directly, which built a fresh AudioService with its own `currentMusicKey`
 * state. When the user navigated MainMenuScene -> AudioSettingsScene, the new
 * scene's AudioService didn't know about the music the old one had started,
 * so the mute button / volume sliders in AudioSettingsScene had no effect on
 * the still-playing menu-theme.
 *
 * Fix: store one AudioService in the Phaser registry so every scene shares
 * the same instance and the same `currentMusicKey` tracking.
 */

type RegistryLike = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
};

function makeRegistry(): RegistryLike {
  const store = new Map<string, unknown>();
  return {
    get: (k) => store.get(k),
    set: (k, v) => {
      store.set(k, v);
    },
  };
}

const baseSettings = {
  sfxMuted: false,
  musicMuted: false,
  sfxVolume: 0.7,
  musicVolume: 0.5,
};

function makeScene(): Phaser.Scene {
  return { registry: makeRegistry() } as unknown as Phaser.Scene;
}

describe("getAudioService", () => {
  it("returns the same instance on subsequent calls (singleton)", () => {
    const scene = makeScene();
    const first = getAudioService(scene, baseSettings);
    const second = getAudioService(scene, baseSettings);
    // Without the registry-singleton fix, two calls would build two
    // independent AudioService instances and `second` would not === `first`.
    expect(second).toBe(first);
  });

  it("creates distinct instances for distinct registries", () => {
    // Sanity check: the singleton is scoped to the registry, not a global.
    // Different Phaser games (different registries) get different instances.
    const sceneA = makeScene();
    const sceneB = makeScene();
    const a = getAudioService(sceneA, baseSettings);
    const b = getAudioService(sceneB, baseSettings);
    expect(b).not.toBe(a);
  });

  it("calls updateSettings on the existing instance when called again with new settings", () => {
    // The mute/volume sliders in AudioSettingsScene read the latest settings
    // from localStorage, then ask for the shared AudioService. The shared
    // instance must pick up the new mute/volume values so the actually-playing
    // music gets stopped / re-volumed.
    const scene = makeScene();
    const first = getAudioService(scene, baseSettings);
    expect(first.isMusicMuted()).toBe(false);
    expect(first.getMusicVolume()).toBeCloseTo(0.5, 5);

    const second = getAudioService(scene, {
      sfxMuted: true,
      musicMuted: true,
      sfxVolume: 0.4,
      musicVolume: 0.25,
    });

    // Same instance, now reflecting the new settings.
    expect(second).toBe(first);
    expect(second.isSfxMuted()).toBe(true);
    expect(second.isMusicMuted()).toBe(true);
    expect(second.getSfxVolume()).toBeCloseTo(0.4, 5);
    expect(second.getMusicVolume()).toBeCloseTo(0.25, 5);
  });
});
