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

describe("buildPickerModel — headwear category", () => {
  it("returns all color cosmetics as cells", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    expect(model.category).toBe("headwear");
    expect(model.cells.length).toBeGreaterThan(0);
    for (const cell of model.cells) {
      expect(cell.def.category).toBe("headwear");
    }
  });

  it("marks level-1 colors as available at level 1", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const navy = model.cells.find((c) => c.def.id === "headwear-none");
    expect(navy).toBeDefined();
    expect(navy!.available).toBe(true);
  });

  it("marks level-5 headwear as locked at level 1 (lockReason=level)", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const gold = model.cells.find((c) => c.def.id === "headwear-halo");
    expect(gold).toBeDefined();
    expect(gold!.available).toBe(false);
    expect(gold!.lockReason).toEqual({ kind: "level", requiredLevel: 5 });
  });

  it("marks level-5 headwear as available at level 5", () => {
    const profile = profileWith({}, 5);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const gold = model.cells.find((c) => c.def.id === "headwear-halo");
    expect(gold!.available).toBe(true);
    expect(gold!.lockReason).toBeUndefined();
  });

  it("marks 2p-free colors as LOCKED in 1P mode (progression-gated)", () => {
    // Issue 5 correct fix: in 1P mode, 2p-free cosmetics are NOT
    // available. They're 2P-exclusive bonus cosmetics.
    const profile = profileWith({}, 10);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const azure = model.cells.find((c) => c.def.id === "headwear-2p-party-hat");
    expect(azure).toBeDefined();
    expect(azure!.available).toBe(false);
  });

  it("marks 2p-free colors as available in 2P mode", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", true, "p1");
    const azure = model.cells.find((c) => c.def.id === "headwear-2p-party-hat");
    expect(azure!.available).toBe(true);
  });

  it("marks ALL cosmetics as available in 2P mode regardless of level", () => {
    const profile = profileWith({}, 1);
    const model = buildPickerModel(profile, "headwear", true, "p1");
    for (const cell of model.cells) {
      expect(cell.available).toBe(true);
    }
  });

  it("marks the currently-equipped color as equipped=true", () => {
    const profile = profileWith({ headwear: "headwear-cap" }, 3);
    const model = buildPickerModel(profile, "headwear", false, "p1");
    const crimson = model.cells.find((c) => c.def.id === "headwear-cap");
    expect(crimson!.equipped).toBe(true);
    const navy = model.cells.find((c) => c.def.id === "headwear-none");
    expect(navy!.equipped).toBe(false);
  });
});

describe("buildPickerModel — P1 vs P2 target", () => {
  it("reads equipped state from profile.cosmetics.equipped for P1", () => {
    const profile = profileWith({ headwear: "headwear-cap" }, 3);
    profile.cosmetics.p2Equipped = { headwear: "headwear-crown" };
    const p1Model = buildPickerModel(profile, "headwear", true, "p1");
    const p2Model = buildPickerModel(profile, "headwear", true, "p2");
    const p1Crimson = p1Model.cells.find((c) => c.def.id === "headwear-cap");
    const p2Emerald = p2Model.cells.find((c) => c.def.id === "headwear-crown");
    expect(p1Crimson!.equipped).toBe(true);
    expect(p2Emerald!.equipped).toBe(true);
    // P1 doesn't have emerald equipped, P2 doesn't have crimson equipped.
    const p1Emerald = p1Model.cells.find((c) => c.def.id === "headwear-crown");
    const p2Crimson = p2Model.cells.find((c) => c.def.id === "headwear-cap");
    expect(p1Emerald!.equipped).toBe(false);
    expect(p2Crimson!.equipped).toBe(false);
  });
});

describe("equipCosmetic — basic equip", () => {
  it("equips an available color on P1", () => {
    const profile = profileWith({}, 3);
    const next = equipCosmetic({}, "headwear-cap", profile, false);
    expect(next.headwear).toBe("headwear-cap");
  });

  it("returns the input unchanged for an unavailable cosmetic", () => {
    const profile = profileWith({}, 1); // level 1, can't equip level-4 gold
    const equipped = { headwear: "headwear-none" };
    const next = equipCosmetic(equipped, "headwear-halo", profile, false);
    expect(next).toBe(equipped); // unchanged reference
    expect(next.headwear).toBe("headwear-none");
  });

  it("returns the input unchanged for an unknown cosmetic id", () => {
    const profile = profileWith({}, 10);
    const equipped = { headwear: "headwear-none" };
    const next = equipCosmetic(equipped, "nonexistent-id", profile, false);
    expect(next).toBe(equipped);
  });

  it("allows ANY cosmetic in 2P mode regardless of level", () => {
    const profile = profileWith({}, 1);
    const next = equipCosmetic({}, "headwear-halo", profile, true);
    expect(next.headwear).toBe("headwear-halo");
  });
});

describe("equipCosmetic — toggle behavior", () => {
  it("unequips a cosmetic when clicking it again (toggle off)", () => {
    const profile = profileWith({}, 3);
    const equipped = { headwear: "headwear-cap" };
    const next = equipCosmetic(equipped, "headwear-cap", profile, false);
    expect(next.headwear).toBeUndefined();
  });

  it("does NOT toggle off the 'none' variants (they're the explicit off state)", () => {
    const profile = profileWith({}, 1);
    const equipped = { outline: "outline-none" };
    const next = equipCosmetic(equipped, "outline-none", profile, false);
    expect(next.outline).toBe("outline-none");
  });

  it("replaces the equipped cosmetic with a new one in the same category", () => {
    const profile = profileWith({ headwear: "headwear-cap" }, 5);
    const next = equipCosmetic({ headwear: "headwear-cap" }, "headwear-halo", profile, false);
    expect(next.headwear).toBe("headwear-halo");
  });
});

describe("equipCosmetic — immutability", () => {
  it("returns a new object (does not mutate the input)", () => {
    const profile = profileWith({}, 3);
    const equipped = { headwear: "headwear-none" };
    const next = equipCosmetic(equipped, "headwear-cap", profile, false);
    expect(next).not.toBe(equipped);
    expect(equipped.headwear).toBe("headwear-none"); // input unchanged
    expect(next.headwear).toBe("headwear-cap");
  });
});

describe("buildPickerModel — all 6 non-empty categories", () => {
  it("returns non-empty cell arrays for every NON-EMPTY category", () => {
    // Issue 4 fix: powerUpSkin category is now empty.
    const profile = profileWith({}, 10);
    const categories = [
      "headwear",
      "outline",
      "trail",
      "slapFx",
      "title",
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
