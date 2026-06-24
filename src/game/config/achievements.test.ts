import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  getAchievementById,
  getAchievementCount,
  getAchievementsByCategory,
  type AchievementCategory,
  type AchievementDefinition,
} from "./achievements";

describe("achievements manifest", () => {
  it("exposes exactly 18 achievements", () => {
    expect(getAchievementCount()).toBe(18);
    expect(ACHIEVEMENTS.length).toBe(18);
  });

  it("has unique ids across all entries", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has nameKey, descKey, category, and icon", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.nameKey).toBe(`achievement.${a.id}.name`);
      expect(a.descKey).toBe(`achievement.${a.id}.desc`);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.category.length).toBeGreaterThan(0);
    }
  });

  it("only allows the documented category values", () => {
    const allowed: AchievementCategory[] = [
      "combat",
      "collection",
      "milestone",
      "progression",
      "fun",
    ];
    for (const a of ACHIEVEMENTS) {
      expect(allowed).toContain(a.category);
    }
  });

  it("getAchievementById returns the matching definition or undefined", () => {
    const first = getAchievementById("first_blood");
    expect(first?.icon).toBe("🩸");
    expect(getAchievementById("does_not_exist")).toBeUndefined();
  });

  it("getAchievementsByCategory returns matching subset only", () => {
    const combat = getAchievementsByCategory("combat");
    for (const a of combat) {
      expect(a.category).toBe("combat");
    }
    // Sanity: combat is the largest bucket and contains first_blood.
    expect(combat.length).toBeGreaterThan(0);
    expect(combat.some((a) => a.id === "first_blood")).toBe(true);

    const progression = getAchievementsByCategory("progression");
    expect(progression.map((a) => a.id).sort()).toEqual([
      "level_10",
      "level_5",
    ]);
  });

  it("getAchievementCount equals ACHIEVEMENTS.length", () => {
    expect(getAchievementCount()).toBe(ACHIEVEMENTS.length);
  });

  it("the 18 expected ids are all present", () => {
    const expected: readonly string[] = [
      "first_blood",
      "first_loss",
      "streak_5",
      "comeback_king",
      "flawless",
      "speed_demon",
      "power_collector",
      "all_powerups",
      "combo_5",
      "dodge_master",
      "ringout_master",
      "first_flight",
      "survivor",
      "level_5",
      "level_10",
      "all_maps",
      "social",
      "veteran",
    ];
    const ids = ACHIEVEMENTS.map((a) => a.id);
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("exposes a readonly tuple (callers can't mutate the manifest)", () => {
    // Type-level guarantee: ACHIEVEMENTS is `readonly AchievementDefinition[]`.
    // We assert the runtime shape is a frozen-ish array we can iterate.
    const snapshot: readonly AchievementDefinition[] = ACHIEVEMENTS;
    expect(snapshot.length).toBe(18);
  });
});
