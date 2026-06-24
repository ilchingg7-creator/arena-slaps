import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../config/profile";
import { applyRewardedXp } from "./applyRewardedXp";
import type { BattleEndOutput } from "./processBattleEnd";
import { LEVELS } from "../config/progression";

function makeBattleEnd(
  overrides: Partial<BattleEndOutput> = {},
): BattleEndOutput {
  return {
    updatedProfile: { ...DEFAULT_PROFILE, powerUpStats: {} },
    xpGained: 100,
    levelUp: {
      leveledUp: false,
      newLevel: 1,
      newUnlocks: [],
    },
    newlyUnlocked: [],
    xpDoubled: false,
    mode: "1p-vs-bot",
    ...overrides,
  };
}

describe("applyRewardedXp — Bug 7: ×2 XP must recalculate level-up + achievements", () => {
  it("returns a new BattleEndOutput with xpDoubled=true", () => {
    const battleEnd = makeBattleEnd({ xpGained: 100 });
    const profile = { ...DEFAULT_PROFILE, powerUpStats: {}, xp: 100, level: 1 };
    const { updatedBattleEnd } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.xpDoubled).toBe(true);
  });

  it("applies the second XP portion to the profile (true ×2)", () => {
    const battleEnd = makeBattleEnd({ xpGained: 150 });
    const profile = { ...DEFAULT_PROFILE, powerUpStats: {}, xp: 150, level: 1 };
    const { updatedProfile } = applyRewardedXp(battleEnd, profile);
    // 150 (already in profile) + 150 (rewarded) = 300
    expect(updatedProfile.xp).toBe(300);
  });

  it("sets levelUp.leveledUp=true when the rewarded XP crosses a level boundary", () => {
    // Level 1 → 2 threshold. Find the XP required for level 2.
    const level2Xp = LEVELS[1].xpRequired; // LEVELS[0] is level 1
    // Profile is 1 XP below the level-2 threshold.
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: level2Xp - 1,
      level: 1,
    };
    // battleEnd.xpGained = 10 → profile goes from (level2Xp - 1) to
    // (level2Xp + 9), crossing the level-2 boundary.
    const battleEnd = makeBattleEnd({ xpGained: 10 });
    const { updatedBattleEnd, updatedProfile } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.levelUp.leveledUp).toBe(true);
    expect(updatedBattleEnd.levelUp.newLevel).toBe(2);
    expect(updatedProfile.level).toBe(2);
  });

  it("sets levelUp.leveledUp=false when the rewarded XP does NOT cross a boundary", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: 0,
      level: 1,
    };
    const battleEnd = makeBattleEnd({ xpGained: 10 });
    const { updatedBattleEnd } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.levelUp.leveledUp).toBe(false);
  });

  it("unlocks level_5 achievement when the rewarded XP crosses level 5", () => {
    // Find the level-5 XP threshold.
    const level5Index = LEVELS.findIndex((l) => l.level === 5);
    const level5Xp = LEVELS[level5Index].xpRequired;
    // Profile is 1 XP below level 5, already at level 4.
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: level5Xp - 1,
      level: 4,
      // Player already has some achievements but NOT level_5.
      achievements: ["first_blood"],
    };
    // Grant enough XP to cross level 5.
    const battleEnd = makeBattleEnd({ xpGained: 100 });
    const { updatedBattleEnd, updatedProfile } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.levelUp.leveledUp).toBe(true);
    expect(updatedBattleEnd.levelUp.newLevel).toBeGreaterThanOrEqual(5);
    expect(updatedBattleEnd.newlyUnlocked).toContain("level_5");
    expect(updatedProfile.achievements).toContain("level_5");
  });

  it("unlocks level_10 achievement when the rewarded XP crosses level 10", () => {
    const level10Index = LEVELS.findIndex((l) => l.level === 10);
    const level10Xp = LEVELS[level10Index].xpRequired;
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: level10Xp - 1,
      level: 9,
      achievements: ["first_blood", "level_5"],
    };
    const battleEnd = makeBattleEnd({ xpGained: 100 });
    const { updatedBattleEnd, updatedProfile } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.levelUp.newLevel).toBeGreaterThanOrEqual(10);
    expect(updatedBattleEnd.newlyUnlocked).toContain("level_10");
    expect(updatedProfile.achievements).toContain("level_10");
  });

  it("does NOT re-unlock level_5 if it was already unlocked before the rewarded XP", () => {
    const level5Index = LEVELS.findIndex((l) => l.level === 5);
    const level5Xp = LEVELS[level5Index].xpRequired;
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: level5Xp - 1,
      level: 4,
      achievements: ["first_blood", "level_5"],
    };
    const battleEnd = makeBattleEnd({ xpGained: 100 });
    const { updatedBattleEnd } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.newlyUnlocked).not.toContain("level_5");
  });

  it("preserves previously-unlocked achievements from the original battleEnd", () => {
    // The original battle unlocked "first_blood". The rewarded XP unlocks
    // "level_5". The updatedBattleEnd.newlyUnlocked should contain BOTH
    // so ResultsScene shows both notifications.
    const level5Index = LEVELS.findIndex((l) => l.level === 5);
    const level5Xp = LEVELS[level5Index].xpRequired;
    const profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: {},
      xp: level5Xp - 1,
      level: 4,
      achievements: ["first_blood"],
    };
    const battleEnd = makeBattleEnd({
      xpGained: 100,
      newlyUnlocked: ["first_blood"],
    });
    const { updatedBattleEnd } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.newlyUnlocked).toContain("first_blood");
    expect(updatedBattleEnd.newlyUnlocked).toContain("level_5");
  });

  it("updates updatedBattleEnd.updatedProfile to reflect the new XP + level + achievements", () => {
    const battleEnd = makeBattleEnd({ xpGained: 50 });
    const profile = { ...DEFAULT_PROFILE, powerUpStats: {}, xp: 0, level: 1 };
    const { updatedBattleEnd } = applyRewardedXp(battleEnd, profile);
    expect(updatedBattleEnd.updatedProfile.xp).toBe(50);
    expect(updatedBattleEnd.updatedProfile.level).toBe(1);
  });

  it("does NOT mutate the input battleEnd (immutability)", () => {
    const battleEnd = makeBattleEnd({ xpGained: 100 });
    const originalXpDoubled = battleEnd.xpDoubled;
    const originalNewlyUnlocked = [...battleEnd.newlyUnlocked];
    const profile = { ...DEFAULT_PROFILE, powerUpStats: {}, xp: 0, level: 1 };
    applyRewardedXp(battleEnd, profile);
    expect(battleEnd.xpDoubled).toBe(originalXpDoubled);
    expect(battleEnd.newlyUnlocked).toEqual(originalNewlyUnlocked);
  });
});
