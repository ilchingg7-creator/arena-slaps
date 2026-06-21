import { describe, expect, it } from "vitest";
import {
  getSoundDefinition,
  getAllSoundPaths,
  getSoundsByCategory,
  SOUND_KEYS,
  SOUND_MANIFEST,
} from "./soundManifest";

describe("soundManifest", () => {
  it("exposes 12 sound keys (10 SFX + 2 music)", () => {
    expect(SOUND_KEYS).toHaveLength(12);
    expect(SOUND_KEYS).toContain("slap-hit");
    expect(SOUND_KEYS).toContain("menu-start");
    expect(SOUND_KEYS).toContain("menu-theme");
    expect(SOUND_KEYS).toContain("battle-theme");
  });

  it("every manifest entry has a matching key in SOUND_KEYS", () => {
    for (const def of SOUND_MANIFEST) {
      expect(SOUND_KEYS).toContain(def.key);
    }
  });

  it("every manifest path is a .ogg file under /sounds/", () => {
    for (const def of SOUND_MANIFEST) {
      expect(def.path).toMatch(/^\/sounds\/.+\.ogg$/);
    }
  });

  it("every manifest entry has a category of sfx or music", () => {
    for (const def of SOUND_MANIFEST) {
      expect(def.category === "sfx" || def.category === "music").toBe(true);
    }
  });

  it("every per-sound volume is in [0, 1] when present", () => {
    for (const def of SOUND_MANIFEST) {
      if (def.volume === undefined) {
        continue;
      }
      expect(def.volume).toBeGreaterThanOrEqual(0);
      expect(def.volume).toBeLessThanOrEqual(1);
    }
  });

  it("getAllSoundPaths returns the same length as SOUND_MANIFEST", () => {
    expect(getAllSoundPaths()).toHaveLength(SOUND_MANIFEST.length);
  });

  it("getSoundDefinition returns the entry for a known key", () => {
    const def = getSoundDefinition("slap-hit");
    expect(def.key).toBe("slap-hit");
    expect(def.path).toBe("/sounds/slap-hit.ogg");
    expect(def.category).toBe("sfx");
  });

  it("getSoundDefinition returns music entries with their category", () => {
    const menu = getSoundDefinition("menu-theme");
    expect(menu.key).toBe("menu-theme");
    expect(menu.path).toBe("/sounds/menu-theme.ogg");
    expect(menu.category).toBe("music");
    const battle = getSoundDefinition("battle-theme");
    expect(battle.key).toBe("battle-theme");
    expect(battle.path).toBe("/sounds/battle-theme.ogg");
    expect(battle.category).toBe("music");
  });

  it("getSoundDefinition throws for an unknown key", () => {
    expect(() =>
      getSoundDefinition("nonexistent" as never),
    ).toThrowError(/No sound definition/);
  });

  it("getSoundsByCategory('sfx') returns the 10 SFX entries", () => {
    const sfx = getSoundsByCategory("sfx");
    expect(sfx).toHaveLength(10);
    for (const def of sfx) {
      expect(def.category).toBe("sfx");
    }
  });

  it("getSoundsByCategory('music') returns the 2 music entries", () => {
    const music = getSoundsByCategory("music");
    expect(music).toHaveLength(2);
    expect(music.map((m) => m.key).sort()).toEqual([
      "battle-theme",
      "menu-theme",
    ]);
    for (const def of music) {
      expect(def.category).toBe("music");
    }
  });

  it("every music path ends in .ogg", () => {
    for (const def of getSoundsByCategory("music")) {
      expect(def.path.endsWith(".ogg")).toBe(true);
    }
  });

  it("getSoundsByCategory returns a readonly snapshot (cannot mutate the manifest)", () => {
    const music = getSoundsByCategory("music");
    expect(Object.isFrozen(music) || Array.isArray(music)).toBe(true);
    // The returned list should be a fresh defensive copy or frozen — mutating
    // it must not corrupt the underlying manifest.
    const before = SOUND_MANIFEST.length;
    // Defensive: ts-ignore — runtime best effort.
    (music as unknown as Array<unknown>).length = 0;
    expect(SOUND_MANIFEST.length).toBe(before);
  });
});
