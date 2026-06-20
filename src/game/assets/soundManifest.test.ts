import { describe, expect, it } from "vitest";
import {
  getSoundDefinition,
  getAllSoundPaths,
  SOUND_KEYS,
  SOUND_MANIFEST,
} from "./soundManifest";

describe("soundManifest", () => {
  it("exposes 10 sound keys", () => {
    expect(SOUND_KEYS).toHaveLength(10);
    expect(SOUND_KEYS).toContain("slap-hit");
    expect(SOUND_KEYS).toContain("menu-start");
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
  });

  it("getSoundDefinition throws for an unknown key", () => {
    expect(() =>
      getSoundDefinition("nonexistent" as never),
    ).toThrowError(/No sound definition/);
  });
});
