import { describe, expect, it } from "vitest";
import {
  COSMETICS,
  getCosmeticById,
  getCosmeticsByCategory,
  getCosmeticsForLevel,
  getCosmeticsFor2P,
  getOwnedCosmetics,
  isCosmeticAvailable,
  type CosmeticCategory,
  type CosmeticDefinition,
  type CosmeticSource,
} from "../config/CosmeticsManifest";
import type { Profile } from "../config/profile";
import { DEFAULT_PROFILE } from "../config/profile";

describe("CosmeticsManifest — structure", () => {
  it("exposes COSMETICS as a non-empty array", () => {
    expect(Array.isArray(COSMETICS)).toBe(true);
    expect(COSMETICS.length).toBeGreaterThan(0);
  });

  it("every cosmetic has a unique id", () => {
    const ids = COSMETICS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every cosmetic has a valid category", () => {
    const validCategories: CosmeticCategory[] = [
      "headwear",
      "outline",
      "trail",
      "slapFx",
      "title",
      "powerUpSkin",
      "headwear",
    ];
    for (const c of COSMETICS) {
      expect(validCategories).toContain(c.category);
    }
  });

  it("every cosmetic has a nameKey (i18n key)", () => {
    for (const c of COSMETICS) {
      expect(typeof c.nameKey).toBe("string");
      expect(c.nameKey.length).toBeGreaterThan(0);
    }
  });

  it("every cosmetic has a source (free / 2p-free / paid)", () => {
    for (const c of COSMETICS) {
      expect(c.source).toBeDefined();
      expect(["free", "2p-free", "paid"]).toContain(c.source.kind);
    }
  });

  it("free cosmetics have an optional unlockLevel (number >= 1)", () => {
    for (const c of COSMETICS) {
      if (c.source.kind === "free" && c.source.unlockLevel !== undefined) {
        expect(typeof c.source.unlockLevel).toBe("number");
        expect(c.source.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(c.source.unlockLevel).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("CosmeticsManifest — getCosmeticById", () => {
  it("returns the cosmetic for a known id", () => {
    const first = COSMETICS[0];
    expect(getCosmeticById(first.id)).toBe(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(getCosmeticById("nonexistent-id")).toBeUndefined();
  });
});

describe("CosmeticsManifest — getCosmeticsByCategory", () => {
  it("returns only cosmetics matching the category", () => {
    const colors = getCosmeticsByCategory("headwear");
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c.category).toBe("headwear");
    }
  });

  it("returns at least one cosmetic for each NON-EMPTY category", () => {
    // Issue 4 fix: powerUpSkin category is now empty (both entries
    // removed — they had no visual effect). The remaining 6 categories
    // must have at least one cosmetic each.
    const categories: CosmeticCategory[] = [
      "headwear",
      "outline",
      "trail",
      "slapFx",
      "title",
      "headwear",
    ];
    for (const cat of categories) {
      expect(getCosmeticsByCategory(cat).length).toBeGreaterThan(0);
    }
  });
});

describe("CosmeticsManifest — getCosmeticsForLevel", () => {
  it("returns cosmetics unlocked AT or BEFORE the given level", () => {
    // Level 5 should include level-1, 2, 3, 4, 5 cosmetics.
    const forLevel5 = getCosmeticsForLevel(5);
    for (const c of forLevel5) {
      expect(c.source.kind).toBe("free");
      if (c.source.kind === "free" && c.source.unlockLevel !== undefined) {
        expect(c.source.unlockLevel).toBeLessThanOrEqual(5);
      }
    }
  });

  it("includes level-1 cosmetics at level 1", () => {
    const forLevel1 = getCosmeticsForLevel(1);
    for (const c of forLevel1) {
      expect(c.source.kind).toBe("free");
      if (c.source.kind === "free" && c.source.unlockLevel !== undefined) {
        expect(c.source.unlockLevel).toBe(1);
      }
    }
  });

  it("does NOT include cosmetics unlocked at higher levels", () => {
    const forLevel3 = getCosmeticsForLevel(3);
    for (const c of forLevel3) {
      expect(c.source.kind).toBe("free");
      if (c.source.kind === "free" && c.source.unlockLevel !== undefined) {
        expect(c.source.unlockLevel).toBeLessThanOrEqual(3);
      }
    }
  });

  it("returns paid cosmetics as NEVER available by level (only via shop)", () => {
    // Since we're doing free-only first, paid cosmetics shouldn't appear
    // in getCosmeticsForLevel at all.
    for (const c of getCosmeticsForLevel(10)) {
      expect(c.source.kind).toBe("free");
    }
  });
});

describe("CosmeticsManifest — getCosmeticsFor2P", () => {
  it("returns ALL cosmetics (free + paid + 2p-free) for 2P-local mode", () => {
    // Bug-fix requirement: in 2P-local mode, both players can pick ANY
    // cosmetic, including paid ones, for free (for that session only).
    const for2P = getCosmeticsFor2P();
    expect(for2P.length).toBe(COSMETICS.length);
  });

  it("includes 2p-free cosmetics (always available in 2P)", () => {
    const for2P = getCosmeticsFor2P();
    const has2pFree = for2P.some((c) => c.source.kind === "2p-free");
    expect(has2pFree).toBe(true);
  });
});

describe("CosmeticsManifest — getOwnedCosmetics", () => {
  function profileWith(owned: string[]): Profile {
    return {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      cosmetics: {
        owned,
        equipped: {},
        p2Equipped: {},
      },
    };
  }

  it("returns the cosmetic definitions for each owned id", () => {
    const profile = profileWith(["headwear-none", "headwear-cap"]);
    const owned = getOwnedCosmetics(profile);
    expect(owned).toHaveLength(2);
    expect(owned[0].id).toBe("headwear-none");
    expect(owned[1].id).toBe("headwear-cap");
  });

  it("skips unknown ids (defensive — old saves may reference deleted cosmetics)", () => {
    const profile = profileWith(["headwear-none", "nonexistent-id"]);
    const owned = getOwnedCosmetics(profile);
    expect(owned).toHaveLength(1);
    expect(owned[0].id).toBe("headwear-none");
  });

  it("returns [] for a profile with no cosmetics field", () => {
    const profile: Profile = { ...DEFAULT_PROFILE, powerUpStats: {} };
    // No cosmetics field — should default to empty.
    expect(getOwnedCosmetics(profile)).toEqual([]);
  });
});

describe("CosmeticsManifest — isCosmeticAvailable", () => {
  function profileWith(owned: string[], level: number): Profile {
    return {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      level,
      cosmetics: {
        owned,
        equipped: {},
        p2Equipped: {},
      },
    };
  }

  it("returns true for a free cosmetic whose unlockLevel <= player level", () => {
    const profile = profileWith([], 5);
    // Find a free cosmetic with unlockLevel 1 (always available).
    const freeLvl1 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 1,
    )!;
    expect(isCosmeticAvailable(profile, freeLvl1.id, false)).toBe(true);
  });

  it("returns false for a free cosmetic whose unlockLevel > player level", () => {
    const profile = profileWith([], 1);
    const freeLvl5 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 5,
    )!;
    expect(isCosmeticAvailable(profile, freeLvl5.id, false)).toBe(false);
  });

  it("returns true for a free cosmetic that has been purchased (in owned list) regardless of level", () => {
    // Edge case: cosmetic is in owned[] even though player level < unlockLevel.
    // This shouldn't happen in normal flow, but should be defensive.
    const profile = profileWith([], 1);
    const freeLvl5 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 5,
    )!;
    // Add to owned.
    profile.cosmetics!.owned.push(freeLvl5.id);
    expect(isCosmeticAvailable(profile, freeLvl5.id, false)).toBe(true);
  });

  it("returns true for ANY cosmetic when is2P is true (2P-local free mode)", () => {
    const profile = profileWith([], 1);
    // Even paid cosmetics should be available in 2P mode.
    const paid = COSMETICS.find((c) => c.source.kind === "paid");
    if (paid) {
      expect(isCosmeticAvailable(profile, paid.id, true)).toBe(true);
    }
    // And high-level free cosmetics.
    const freeLvl10 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 10,
    );
    if (freeLvl10) {
      expect(isCosmeticAvailable(profile, freeLvl10.id, true)).toBe(true);
    }
  });

  it("returns FALSE for 2p-free cosmetics in 1P mode (progression-gated)", () => {
    // Issue 5 correct fix: in 1P-vs-bot mode, cosmetics are available
    // according to progression. 2p-free cosmetics are 2P-exclusive —
    // they're NOT available in 1P mode regardless of player level.
    const profile = profileWith([], 10);
    const twoFree = COSMETICS.find((c) => c.source.kind === "2p-free");
    if (twoFree) {
      expect(isCosmeticAvailable(profile, twoFree.id, false)).toBe(false);
    }
  });

  it("returns TRUE for 2p-free cosmetics in 2P mode (all cosmetics unlocked)", () => {
    // In 2P-local mode, ALL cosmetics are available to both players
    // regardless of progression.
    const profile = profileWith([], 1);
    const twoFree = COSMETICS.find((c) => c.source.kind === "2p-free");
    if (twoFree) {
      expect(isCosmeticAvailable(profile, twoFree.id, true)).toBe(true);
    }
  });

  it("returns FALSE for level-gated cosmetics in 1P mode when level too low", () => {
    const profile = profileWith([], 1);
    const freeLvl5 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 5,
    );
    if (freeLvl5) {
      expect(isCosmeticAvailable(profile, freeLvl5.id, false)).toBe(false);
    }
  });

  it("returns TRUE for level-gated cosmetics in 2P mode even when level too low", () => {
    // 2P mode: progression doesn't matter — everything is unlocked.
    const profile = profileWith([], 1);
    const freeLvl5 = COSMETICS.find(
      (c) => c.source.kind === "free" && c.source.unlockLevel === 5,
    );
    if (freeLvl5) {
      expect(isCosmeticAvailable(profile, freeLvl5.id, true)).toBe(true);
    }
  });

  it("returns false for an unknown cosmetic id", () => {
    const profile = profileWith([], 10);
    expect(isCosmeticAvailable(profile, "nonexistent-id", false)).toBe(false);
    expect(isCosmeticAvailable(profile, "nonexistent-id", true)).toBe(false);
  });
});

describe("CosmeticsManifest — headwear category", () => {
  it("exposes at least 3 headwear options", () => {
    const headwear = getCosmeticsByCategory("headwear");
    expect(headwear.length).toBeGreaterThanOrEqual(3);
  });

  it("headwear cosmetics have a spriteKey (PNG to overlay on the actor)", () => {
    const headwear = getCosmeticsByCategory("headwear");
    for (const h of headwear) {
      // The effect.spriteKey is the PNG key for the headwear overlay.
      expect((h.effect as { spriteKey?: string }).spriteKey).toBeDefined();
      expect(typeof (h.effect as { spriteKey?: string }).spriteKey).toBe("string");
    }
  });
});
