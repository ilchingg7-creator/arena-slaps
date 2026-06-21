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

  it("every definition path starts with /sprites/ and ends with .png", () => {
    for (const def of SPRITE_DEFINITIONS) {
      expect(def.path).toMatch(/^\/sprites\/.+\.png$/);
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
      expect(a.imagePath).toMatch(/^\/sprites\/.+\.png$/);
      expect(a.atlasPath).toMatch(/^\/sprites\/.+\.json$/);
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
});
