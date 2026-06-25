import { describe, expect, it } from "vitest";
import {
  buildPickerModel,
  equipCosmetic,
} from "./CosmeticsPickerState";
import type { Profile } from "../config/profile";
import { DEFAULT_PROFILE } from "../config/profile";
import { getCosmeticById } from "../config/CosmeticsManifest";

function profileWith(
  equipped: Partial<{ color: string; outline: string; headwear: string }>,
  level = 1,
  owned: string[] = [],
): Profile {
  return {
    ...DEFAULT_PROFILE,
    powerUpStats: {},
    level,
    cosmetics: {
      owned,
      equipped,
      p2Equipped: {},
    },
  };
}

describe("buildPickerModel — color category", () => {
  it("returns all color cosmetics as cells", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "color", false, "p1");
    expect(model.category).toBe("color");
    expect(model.cells.length).toBeGreaterThan(0);
    for (const cell of model.cells) {
      expect(cell.def.category).toBe("color");
    }
  });

  it("marks level-1 colors as available at level 1", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "color", false, "p1");
    const navy = model.cells.find((c) => c.def.id === "color-navy");
    expect(navy).toBeDefined();
    expect(navy!.available).toBe(true);
  });

  it("marks level-4 colors as locked at level 1 (lockReason=level)", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "color", false, "p1");
    const gold = model.cells.find((c) => c.def.id === "color-gold");
    expect(gold).toBeDefined();
    expect(gold!.available).toBe(false);
    expect(gold!.lockReason).toEqual({ kind: "level", requiredLevel: 4 });
  });

  it("marks level-4 colors as available at level 4", () => {
    const profile = profileWith({}, 4);
    const model = buildPickerModel(profile, "color", false, "p1");
    const gold = model.cells.find((c) => c.def.id === "color-gold");
    expect(gold!.available).toBe(true);
    expect(gold!.lockReason).toBeUndefined();
  });

  it("marks 2p-free colors as locked in 1P mode", () => {
    const profile = profileWith({}, 10);
    const model = buildPickerModel(profile, "color", false, "p1");
    const azure = model.cells.find((c) => c.def.id === "color-2p-azure");
    expect(azure).toBeDefined();
    expect(azure!.available).toBe(false);
  });

  it("marks 2p-free colors as available in 2P mode", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "color", true, "p1");
    const azure = model.cells.find((c) => c.def.id === "color-2p-azure");
    expect(azure!.available).toBe(true);
  });

  it("marks ALL cosmetics as available in 2P mode regardless of level", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "color", true, "p1");
    for (const cell of model.cells) {
      expect(cell.available).toBe(true);
    }
  });

  it("marks the currently-equipped color as equipped=true", () => {
    const profile = profileWith({ color: "color-crimson" }, 2);
    const model = buildPickerModel(profile, "color", false, "p1");
    const crimson = model.cells.find((c) => c.def.id === "color-crimson");
    expect(crimson!.equipped).toBe(true);
    const navy = model.cells.find((c) => c.def.id === "color-navy");
    expect(navy!.equipped).toBe(false);
  });
});

describe("buildPickerModel — P1 vs P2 target", () => {
  it("reads equipped state from profile.cosmetics.equipped for P1", () => {
    const profile = profileWith({ color: "color-crimson" }, 2);
    profile.cosmetics.p2Equipped = { color: "color-emerald" };
    const p1Model = buildPickerModel(profile, "color", true, "p1");
    const p2Model = buildPickerModel(profile, "color", true, "p2");
    const p1Crimson = p1Model.cells.find((c) => c.def.id === "color-crimson");
    const p2Emerald = p2Model.cells.find((c) => c.def.id === "color-emerald");
    expect(p1Crimson!.equipped).toBe(true);
    expect(p2Emerald!.equipped).toBe(true);
    // P1 doesn't have emerald equipped, P2 doesn't have crimson equipped.
    const p1Emerald = p1Model.cells.find((c) => c.def.id === "color-emerald");
    const p2Crimson = p2Model.cells.find((c) => c.def.id === "color-crimson");
    expect(p1Emerald!.equipped).toBe(false);
    expect(p2Crimson!.equipped).toBe(false);
  });
});

describe("equipCosmetic — basic equip", () => {
  it("equips an available color on P1", () => {
    const profile = profileWith({}, 2);
    const next = equipCosmetic({}, "color-crimson", profile, false);
    expect(next.color).toBe("color-crimson");
  });

  it("returns the input unchanged for an unavailable cosmetic", () => {
    const profile = profileWith({}, 1); // level 1, can't equip level-4 gold
    const equipped = { color: "color-navy" };
    const next = equipCosmetic(equipped, "color-gold", profile, false);
    expect(next).toBe(equipped); // unchanged reference
    expect(next.color).toBe("color-navy");
  });

  it("returns the input unchanged for an unknown cosmetic id", () => {
    const profile = profileWith({}, 10);
    const equipped = { color: "color-navy" };
    const next = equipCosmetic(equipped, "nonexistent-id", profile, false);
    expect(next).toBe(equipped);
  });

  it("allows ANY cosmetic in 2P mode regardless of level", () => {
    const profile = profileWith({}, 1);
    const next = equipCosmetic({}, "color-gold", profile, true);
    expect(next.color).toBe("color-gold");
  });
});

describe("equipCosmetic — toggle behavior", () => {
  it("unequips a cosmetic when clicking it again (toggle off)", () => {
    const profile = profileWith({}, 2);
    const equipped = { color: "color-crimson" };
    const next = equipCosmetic(equipped, "color-crimson", profile, false);
    expect(next.color).toBeUndefined();
  });

  it("does NOT toggle off the 'none' variants (they're the explicit off state)", () => {
    const profile = profileWith({}, 1);
    const equipped = { outline: "outline-none" };
    const next = equipCosmetic(equipped, "outline-none", profile, false);
    expect(next.outline).toBe("outline-none");
  });

  it("replaces the equipped cosmetic with a new one in the same category", () => {
    const profile = profileWith({ color: "color-crimson" }, 4);
    const next = equipCosmetic({ color: "color-crimson" }, "color-gold", profile, false);
    expect(next.color).toBe("color-gold");
  });
});

describe("equipCosmetic — immutability", () => {
  it("returns a new object (does not mutate the input)", () => {
    const profile = profileWith({}, 2);
    const equipped = { color: "color-navy" };
    const next = equipCosmetic(equipped, "color-crimson", profile, false);
    expect(next).not.toBe(equipped);
    expect(equipped.color).toBe("color-navy"); // input unchanged
    expect(next.color).toBe("color-crimson");
  });
});

describe("buildPickerModel — all 7 categories", () => {
  it("returns non-empty cell arrays for every documented category", () => {
    const profile = profileWith({}, 10);
    const categories = [
      "color",
      "outline",
      "trail",
      "slapFx",
      "title",
      "powerUpSkin",
      "headwear",
    ] as const;
    for (const cat of categories) {
      const model = buildPickerModel(profile, cat, false, "p1");
      expect(model.cells.length).toBeGreaterThan(0);
    }
  });
});

describe("buildPickerModel — headwear", () => {
  it("marks headwear-crown as locked at level 1", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const crown = model.cells.find((c) => c.def.id === "headwear-crown");
    expect(crown!.available).toBe(false);
    expect(crown!.lockReason).toEqual({ kind: "level", requiredLevel: 7 });
  });

  it("marks headwear-crown as available at level 7", () => {
    const profile = profileWith({}, 7);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const crown = model.cells.find((c) => c.def.id === "headwear-crown");
    expect(crown!.available).toBe(true);
  });
});
