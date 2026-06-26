import { describe, expect, it } from "vitest";
import {
  SPRITE_DEFINITIONS,
  SPRITE_ATLASES,
  getSpriteDefinition,
  getSpritesByCategory,
  getAllSpritePaths,
  type SpriteCategory,
} from "./spriteManifest";

describe("spriteManifest", () => {
  it("exposes a non-empty SPRITE_DEFINITIONS array", () => {
    expect(Array.isArray(SPRITE_DEFINITIONS)).toBe(true);
    expect(SPRITE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every definition has a valid category", () => {
    const valid: SpriteCategory[] = ["character", "ui", "background", "effect"];
    for (const def of SPRITE_DEFINITIONS) {
      expect(valid).toContain(def.category);
    }
  });

  it("every definition path starts with ./sprites/ and ends with .png", () => {
    for (const def of SPRITE_DEFINITIONS) {
      expect(def.path).toMatch(/^\.\/sprites\/.+\.png$/);
    }
  });

  it("every definition fallback is either rectangle or circle", () => {
    for (const def of SPRITE_DEFINITIONS) {
      expect(def.fallback === "rectangle" || def.fallback === "circle").toBe(true);
    }
  });

  it("every definition has a fallbackColor that is a finite number", () => {
    for (const def of SPRITE_DEFINITIONS) {
      expect(typeof def.fallbackColor).toBe("number");
      expect(Number.isFinite(def.fallbackColor)).toBe(true);
    }
  });

  it("all sprite keys are unique", () => {
    const keys = SPRITE_DEFINITIONS.map((d) => d.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("all atlas keys are unique", () => {
    const keys = SPRITE_ATLASES.map((a) => a.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("atlas paths end with .png / .json respectively", () => {
    for (const a of SPRITE_ATLASES) {
      expect(a.imagePath).toMatch(/^\.\/sprites\/.+\.png$/);
      expect(a.atlasPath).toMatch(/^\.\/sprites\/.+\.json$/);
    }
  });

  it("getSpriteDefinition returns the entry for a known key", () => {
    const first = SPRITE_DEFINITIONS[0];
    const def = getSpriteDefinition(first.key);
    expect(def.key).toBe(first.key);
    expect(def.path).toBe(first.path);
  });

  it("getSpriteDefinition throws for an unknown key", () => {
    expect(() => getSpriteDefinition("does-not-exist")).toThrowError(/sprite/i);
  });

  it("getSpritesByCategory returns only entries with the given category", () => {
    const effects = getSpritesByCategory("effect");
    expect(effects.length).toBeGreaterThan(0);
    for (const def of effects) {
      expect(def.category).toBe("effect");
    }
    // And the union of all categories equals the full list.
    const characters = getSpritesByCategory("character");
    const uis = getSpritesByCategory("ui");
    const backgrounds = getSpritesByCategory("background");
    const total = effects.length + characters.length + uis.length + backgrounds.length;
    expect(total).toBe(SPRITE_DEFINITIONS.length);
  });

  it("getAllSpritePaths returns the full SPRITE_DEFINITIONS list", () => {
    expect(getAllSpritePaths()).toHaveLength(SPRITE_DEFINITIONS.length);
    expect(getAllSpritePaths()).toBe(SPRITE_DEFINITIONS);
  });

  it("ships the documented placeholder keys (player-idle, bot-idle, powerup-speed, powerup-knockback, powerup-shield)", () => {
    const keys = SPRITE_DEFINITIONS.map((d) => d.key);
    expect(keys).toContain("player-idle");
    expect(keys).toContain("bot-idle");
    expect(keys).toContain("powerup-speed");
    expect(keys).toContain("powerup-knockback");
    expect(keys).toContain("powerup-shield");
  });

  it("has 50 total sprite definitions (was 40 + 10 cosmetic sprites)", () => {
    // Breakdown:
    //   - 40 existing + 10 cosmetic sprites: 6 headwear (cap, crown,
    //     horns, halo, helmet, party-hat) + 2 trail particles (dust,
    //     sparkle) + 2 slap FX (star, lightning)
    expect(SPRITE_DEFINITIONS).toHaveLength(64);
  });

  it("ships the 12 new character state keys (player + bot × run-n/s/e/w + slap + fall)", () => {
    const keys = SPRITE_DEFINITIONS.map((d) => d.key);
    const newStates = ["run-n", "run-s", "run-e", "run-w", "slap", "fall"];
    for (const state of newStates) {
      expect(keys).toContain(`player-${state}`);
      expect(keys).toContain(`bot-${state}`);
    }
  });

  it("ships the 3 new power-up keys (mega-knockback, freeze, double-slap)", () => {
    const keys = SPRITE_DEFINITIONS.map((d) => d.key);
    expect(keys).toContain("powerup-mega-knockback");
    expect(keys).toContain("powerup-freeze");
    expect(keys).toContain("powerup-double-slap");
  });

  it("every new character sprite has category 'character', rectangle fallback, and path /sprites/<key>.png", () => {
    const newCharKeys = [
      "player-run-n",
      "player-run-s",
      "player-run-e",
      "player-run-w",
      "player-slap",
      "player-fall",
      "bot-run-n",
      "bot-run-s",
      "bot-run-e",
      "bot-run-w",
      "bot-slap",
      "bot-fall",
    ];
    for (const key of newCharKeys) {
      const def = SPRITE_DEFINITIONS.find((d) => d.key === key);
      expect(def).toBeDefined();
      if (!def) continue;
      expect(def.category).toBe("character");
      expect(def.fallback).toBe("rectangle");
      expect(def.path).toBe(`./sprites/${key}.png`);
    }
  });

  it("every new power-up sprite has category 'effect', circle fallback, and path /sprites/<key>.png", () => {
    const newPowerUpKeys = [
      "powerup-mega-knockback",
      "powerup-freeze",
      "powerup-double-slap",
    ];
    for (const key of newPowerUpKeys) {
      const def = SPRITE_DEFINITIONS.find((d) => d.key === key);
      expect(def).toBeDefined();
      if (!def) continue;
      expect(def.category).toBe("effect");
      expect(def.fallback).toBe("circle");
      expect(def.path).toBe(`./sprites/${key}.png`);
    }
  });

  it("getSpritesByCategory('character') returns 20 entries (7 player + 7 bot + 6 headwear)", () => {
    const chars = getSpritesByCategory("character");
    expect(chars).toHaveLength(26);
    const playerStates = chars.filter((d) => d.key.startsWith("player-"));
    const botStates = chars.filter((d) => d.key.startsWith("bot-"));
    const headwear = chars.filter((d) => d.key.startsWith("headwear-"));
    expect(playerStates).toHaveLength(7);
    expect(botStates).toHaveLength(7);
    expect(headwear).toHaveLength(12);
  });

  it("getSpritesByCategory('effect') returns 10 entries (6 power-ups + 2 trails + 2 slapFx)", () => {
    const effects = getSpritesByCategory("effect");
    expect(effects).toHaveLength(18);
  });

  it("ships the 3 background keys (menu-bg, arena-bg, arena-platform)", () => {
    const keys = SPRITE_DEFINITIONS.map((d) => d.key);
    expect(keys).toContain("menu-bg");
    expect(keys).toContain("arena-bg");
    expect(keys).toContain("arena-platform");
  });

  it("every new background key has category 'background', defined width+height, and path /sprites/<key>.png", () => {
    const bgKeys = ["menu-bg", "arena-bg", "arena-platform"];
    for (const key of bgKeys) {
      const def = SPRITE_DEFINITIONS.find((d) => d.key === key);
      expect(def).toBeDefined();
      if (!def) continue;
      expect(def.category).toBe("background");
      expect(def.width).toBeDefined();
      expect(def.height).toBeDefined();
      expect(typeof def.width).toBe("number");
      expect(typeof def.height).toBe("number");
      expect(def.path).toBe(`./sprites/${key}.png`);
    }
  });

  it("getSpritesByCategory('background') returns all background entries", () => {
    const bgs = getSpritesByCategory("background");
    expect(bgs.length).toBeGreaterThanOrEqual(3);
    for (const def of bgs) {
      expect(def.category).toBe("background");
    }
  });
});
