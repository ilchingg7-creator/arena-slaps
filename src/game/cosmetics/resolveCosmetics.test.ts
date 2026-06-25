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

describe("resolveCosmetics — color resolution", () => {
  it("resolves color-crimson to its hex value", () => {
    const equipped: EquippedCosmetics = { color: "color-crimson" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.color).toBe(0xc0392b);
  });

  it("resolves color-gold to its hex value", () => {
    const equipped: EquippedCosmetics = { color: "color-gold" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.color).toBe(0xf1c40f);
  });

  it("falls back to defaultColor for an unknown color id", () => {
    const equipped: EquippedCosmetics = { color: "nonexistent-color" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.color).toBe(DEFAULT_COLOR);
  });
});

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

describe("resolveCosmetics — powerUpSkin resolution", () => {
  it("resolves powerup-skin-default to 'default'", () => {
    const equipped: EquippedCosmetics = { powerUpSkin: "powerup-skin-default" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.powerUpSkin).toBe("default");
  });

  it("resolves powerup-skin-rounded to 'rounded'", () => {
    const equipped: EquippedCosmetics = { powerUpSkin: "powerup-skin-rounded" };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.powerUpSkin).toBe("rounded");
  });
});

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
  it("resolves all 7 categories at once", () => {
    const equipped: EquippedCosmetics = {
      color: "color-violet",
      outline: "outline-cyan",
      trail: "trail-sparkle",
      slapFx: "slapfx-lightning",
      title: "title-master",
      powerUpSkin: "powerup-skin-rounded",
      headwear: "headwear-crown",
    };
    const result = resolveCosmetics(baseInput({ equipped }));
    expect(result.color).toBe(0x8e44ad);
    expect(result.outline).toBe(0x00ffff);
    expect(result.trail).toEqual({ textureKey: "trail-sparkle", color: 0xffffff });
    expect(result.slapFx).toBe("slapfx-lightning");
    expect(result.title).toBe("master");
    expect(result.powerUpSkin).toBe("rounded");
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
  ): Profile {
    return {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      cosmetics: { owned: [], equipped, p2Equipped },
    };
  }

  it("resolveP1Cosmetics reads from profile.cosmetics.equipped", () => {
    const profile = profileWith({ color: "color-crimson" });
    const result = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    expect(result.color).toBe(0xc0392b);
  });

  it("resolveP2Cosmetics reads from profile.cosmetics.p2Equipped", () => {
    const profile = profileWith({}, { color: "color-emerald" });
    const result = resolveP2Cosmetics(profile, DEFAULT_COLOR);
    expect(result.color).toBe(0x27ae60);
  });

  it("P1 and P2 can have different colors in 2P mode", () => {
    const profile = profileWith(
      { color: "color-crimson" },
      { color: "color-emerald" },
    );
    const p1 = resolveP1Cosmetics(profile, DEFAULT_COLOR);
    const p2 = resolveP2Cosmetics(profile, DEFAULT_COLOR);
    expect(p1.color).toBe(0xc0392b);
    expect(p2.color).toBe(0x27ae60);
    expect(p1.color).not.toBe(p2.color);
  });
});
