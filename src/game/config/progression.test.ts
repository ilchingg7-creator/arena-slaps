import { describe, expect, it } from "vitest";
import {
  XP_REWARDS,
  LEVELS,
  MAX_LEVEL,
  getLevelDefinition,
  getLevelForXp,
  getXpForNextLevel,
  getAllUnlocksUpTo,
  isUnlocked,
} from "./progression";

describe("progression", () => {
  it("XP_REWARDS has all 5 keys with positive values", () => {
    expect(XP_REWARDS.win).toBeGreaterThan(0);
    expect(XP_REWARDS.loss).toBeGreaterThan(0);
    expect(XP_REWARDS.draw).toBeGreaterThan(0);
    expect(XP_REWARDS.ringOut).toBeGreaterThan(0);
    expect(XP_REWARDS.powerUpCollected).toBeGreaterThan(0);
  });

  it("LEVELS has exactly 10 entries in ascending xpRequired order", () => {
    expect(LEVELS).toHaveLength(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xpRequired).toBeGreaterThan(LEVELS[i - 1].xpRequired);
    }
  });

  it("Level 1 requires 0 XP", () => {
    expect(LEVELS[0].xpRequired).toBe(0);
  });

  it("MAX_LEVEL is 10", () => {
    expect(MAX_LEVEL).toBe(10);
  });

  it("getLevelDefinition returns the correct definition", () => {
    const def = getLevelDefinition(1);
    expect(def.level).toBe(1);
    expect(def.xpRequired).toBe(0);
  });

  it("getLevelDefinition throws for level 0", () => {
    expect(() => getLevelDefinition(0)).toThrow();
  });

  it("getLevelDefinition throws for level 11", () => {
    expect(() => getLevelDefinition(11)).toThrow();
  });

  it("getLevelForXp returns correct levels", () => {
    expect(getLevelForXp(0)).toBe(1);
    expect(getLevelForXp(99)).toBe(1);
    expect(getLevelForXp(100)).toBe(2);
    expect(getLevelForXp(299)).toBe(2);
    expect(getLevelForXp(300)).toBe(3);
    expect(getLevelForXp(5499)).toBe(9);
    expect(getLevelForXp(5500)).toBe(10);
    expect(getLevelForXp(99999)).toBe(10);
  });

  it("getXpForNextLevel returns correct values", () => {
    expect(getXpForNextLevel(1)).toBe(100);
    expect(getXpForNextLevel(2)).toBe(200);
    expect(getXpForNextLevel(10)).toBe(0);
  });

  it("getAllUnlocksUpTo(1) returns 1 unlock", () => {
    const unlocks = getAllUnlocksUpTo(1);
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0].key).toBe("bot-easy");
  });

  it("getAllUnlocksUpTo(4) returns 4 unlocks", () => {
    const unlocks = getAllUnlocksUpTo(4);
    expect(unlocks).toHaveLength(4);
    expect(unlocks.map((u) => u.key)).toEqual([
      "bot-easy",
      "bot-medium",
      "arena-default",
      "bot-hard",
    ]);
  });

  it("isUnlocked returns true for a key in the list", () => {
    const unlocks = getAllUnlocksUpTo(2);
    expect(isUnlocked(unlocks, "bot-easy")).toBe(true);
    expect(isUnlocked(unlocks, "bot-medium")).toBe(true);
  });

  it("isUnlocked returns false for a key NOT in the list", () => {
    const unlocks = getAllUnlocksUpTo(1);
    expect(isUnlocked(unlocks, "bot-hard")).toBe(false);
    expect(isUnlocked(unlocks, "nonexistent")).toBe(false);
  });

  it("Level 10 unlocks all-maps + gives legend title", () => {
    const def = getLevelDefinition(10);
    expect(def.unlocks.some((u) => u.key === "all-maps")).toBe(true);
    expect(def.reward).toEqual({ type: "title", key: "legend" });
  });

  it("Each level has at least one unlock or a reward", () => {
    for (const def of LEVELS) {
      const hasUnlocks = def.unlocks.length > 0;
      const hasReward = def.reward !== null;
      expect(hasUnlocks || hasReward).toBe(true);
    }
  });
});
