import { describe, expect, it } from "vitest";
import {
  resolveCosmetics,
  resolveP1Cosmetics,
  resolveP2Cosmetics,
  type ResolveCosmeticsInput,
} from "./resolveCosmetics";
import type { EquippedCosmetics, Profile } from "../config/profile";
import { DEFAULT_PROFILE } from "../config/profile";

const DEFAULT_COLOR = 0x3d405b;

function baseInput(
  overrides: Partial<ResolveCosmeticsInput> = {},
): ResolveCosmeticsInput {
  return {
    equipped: {},
    defaultColor: DEFAULT_COLOR,
    ...overrides,
  };
}

describe("resolveCosmetics — defaults", () => {
  it("returns the default color when no color cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.color).toBe(DEFAULT_COLOR);
  });

  it("returns null outline when no outline cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.outline).toBeNull();
  });

  it("returns null trail when no trail cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.trail).toBeNull();
  });

  it("returns null slapFx when no slapFx cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.slapFx).toBeNull();
  });

  it("returns null title when no title cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.title).toBeNull();
  });

  it("returns 'default' powerUpSkin when no skin cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.powerUpSkin).toBe("default");
  });

  it("returns null headwear when no headwear cosmetic is equipped", () => {
    const result = resolveCosmetics(baseInput());
    expect(result.headwear).toBeNull();
  });
});

// Issue 1 fix: color category removed — color resolution tests removed.
// resolveCosmetics still returns the defaultColor when no color cosmetic
// is equipped, but there are no manifest entries to resolve.

describe("resolveCosmetics — outline resolution", () => {
  it("resolves outline-white to its hex value", () => {
    const equipped: EquippedCosmetics = { outline: "outline-white" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.outline).toBe(0xffffff);
  });

  it("resolves outline-cyan to its hex value", () => {
    const equipped: EquippedCosmetics = { outline: "outline-cyan" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.outline).toBe(0x00ffff);
  });

  it("returns null for outline-none (explicit none)", () => {
    const equipped: EquippedCosmetics = { outline: "outline-none" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.outline).toBeNull();
  });
});

describe("resolveCosmetics — trail resolution", () => {
  it("resolves trail-dust to its texture + color", () => {
    const equipped: EquippedCosmetics = { trail: "trail-dust" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.trail).toEqual({
      textureKey: "trail-dust",
      color: 0xaaaaaa,
    });
  });

  it("resolves trail-sparkle to its texture + color", () => {
    const equipped: EquippedCosmetics = { trail: "trail-sparkle" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.trail).toEqual({
      textureKey: "trail-sparkle",
      color: 0xffffff,
    });
  });

  it("returns null for trail-none (explicit none)", () => {
    const equipped: EquippedCosmetics = { trail: "trail-none" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.trail).toBeNull();
  });
});

describe("resolveCosmetics — slapFx resolution", () => {
  it("resolves slapfx-star to its texture key", () => {
    const equipped: EquippedCosmetics = { slapFx: "slapfx-star" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.slapFx).toBe("slapfx-star");
  });

  it("resolves slapfx-lightning to its texture key", () => {
    const equipped: EquippedCosmetics = { slapFx: "slapfx-lightning" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.slapFx).toBe("slapfx-lightning");
  });

  it("returns null for slapfx-none", () => {
    const equipped: EquippedCosmetics = { slapFx: "slapfx-none" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.slapFx).toBeNull();
  });
});

describe("resolveCosmetics — title resolution", () => {
  it("resolves title-rookie to its key", () => {
    const equipped: EquippedCosmetics = { title: "title-rookie" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.title).toBe("rookie");
  });

  it("resolves title-legend to its key", () => {
    const equipped: EquippedCosmetics = { title: "title-legend" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.title).toBe("legend");
  });

  it("returns null for title-none", () => {
    const equipped: EquippedCosmetics = { title: "title-none" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.title).toBeNull();
  });
});

// Issue 4 fix: powerUpSkin category removed (both entries had no
// visual effect). resolveCosmetics still returns powerUpSkin="default"
// when no cosmetic is equipped, but there's no manifest entry to
// resolve — so the resolveCosmetics tests for this category are
// removed. The field stays in ResolvedCosmetics for forward-compat.

describe("resolveCosmetics — headwear resolution", () => {
  it("resolves headwear-cap to its sprite + offset", () => {
    const equipped: EquippedCosmetics = { headwear: "headwear-cap" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.headwear).toEqual({
      spriteKey: "headwear-cap",
      offsetY: -28,
    });
  });

  it("resolves headwear-crown to its sprite + offset", () => {
    const equipped: EquippedCosmetics = { headwear: "headwear-crown" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.headwear).toEqual({
      spriteKey: "headwear-crown",
      offsetY: -28,
    });
  });

  it("returns null for headwear-none", () => {
    const equipped: EquippedCosmetics = { headwear: "headwear-none" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.headwear).toBeNull();
  });
});

describe("resolveCosmetics — combined loadout", () => {
  it("resolves all 5 non-empty categories at once (Issue 1 + 4)", () => {
    // Issue 1 fix: color category removed.
    // Issue 4 fix: powerUpSkin category removed.
    const equipped: EquippedCosmetics = {
      outline: "outline-cyan",
      trail: "trail-sparkle",
      slapFx: "slapfx-lightning",
      title: "title-master",
      headwear: "headwear-crown",
    };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.outline).toBe(0x00ffff);
    expect(result.trail).toEqual({ textureKey: "trail-sparkle", color: 0xffffff });
    expect(result.slapFx).toBe("slapfx-lightning");
    expect(result.title).toBe("master");
    expect(result.headwear).toEqual({
      spriteKey: "headwear-crown",
      offsetY: -28,
    });
  });
});

describe("resolveP1Cosmetics / resolveP2Cosmetics", () => {
  function profileWith(
    equipped: EquippedCosmetics,
    p2Equipped: EquippedCosmetics = {},
    level = 10,
  ): Profile {
    return {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      level,
      cosmetics: { owned: [], equipped, p2Equipped },
    };
  }

  it("resolveP1Cosmetics reads from profile.cosmetics.equipped", () => {
    // Bug 4 fix: P1 cosmetics are filtered by ownership. headwear-cap
    // requires level 3 — use level 10 so it passes.
    const profile = profileWith({ headwear: "headwear-cap" });
    const result = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    expect(result.headwear).toEqual({
      spriteKey: "headwear-cap",
      offsetY: -28,
    });
  });

  it("resolveP2Cosmetics reads from profile.cosmetics.p2Equipped", () => {
    const profile = profileWith({}, { headwear: "headwear-crown" });
    const result = resolveP2Cosmetics(profile, DEFAULT_COLOR);
    expect(result.headwear).toEqual({
      spriteKey: "headwear-crown",
      offsetY: -28,
    });
  });

  it("P1 and P2 can have different headwear in 2P mode", () => {
    const profile = profileWith(
      { headwear: "headwear-cap" },
      { headwear: "headwear-crown" },
    );
    const p1 = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    const p2 = resolveP2Cosmetics(profile, DEFAULT_COLOR);
    expect(p1.headwear?.spriteKey).toBe("headwear-cap");
    expect(p2.headwear?.spriteKey).toBe("headwear-crown");
    expect(p1.headwear).not.toEqual(p2.headwear);
  });

  it("Bug 4: P1 paid cosmetics are filtered out if not owned", () => {
    // After the 2026-06-25 headwear swap, headwear-halo is a paid
    // cosmetic. P1 doesn't own it (not in owned list). Even if it's
    // in equipped (e.g. leaked from 2P), resolveP1Cosmetics should
    // return null for headwear.
    const profile = profileWith({ headwear: "headwear-halo" });
    const result = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    expect(result.headwear).toBeNull();
  });

  it("Bug 4: P1 paid cosmetics work when owned", () => {
    const profile = profileWith({ headwear: "headwear-halo" });
    profile.cosmetics.owned.push("headwear-halo");
    const result = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    expect(result.headwear).toEqual({
      spriteKey: "headwear-halo",
      offsetY: -28,
    });
  });
});
