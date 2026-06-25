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
    // Variant B layout: levels 1-4 unlock bot-easy, bot-medium,
    // arena-neon (NOT arena-default — that's always available via
    // mapManifest.unlockKey=null), bot-hard.
    const unlocks = getAllUnlocksUpTo(4);
    expect(unlocks).toHaveLength(4);
    expect(unlocks.map((u) => u.key)).toEqual([
      "bot-easy",
      "bot-medium",
      "arena-neon",
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

  // --- RED: Variant B — fix fake + redundant map unlocks ---
  describe("Variant B: honest map progression", () => {
    it("Level 3 unlocks arena-neon (NOT arena-default — that's always available)", () => {
      const def = getLevelDefinition(3);
      expect(def.unlocks.some((u) => u.key === "arena-neon")).toBe(true);
      expect(def.unlocks.some((u) => u.key === "arena-default")).toBe(false);
    });

    it("Level 5 unlocks arena-cosmic (was neon in old layout)", () => {
      const def = getLevelDefinition(5);
      expect(def.unlocks.some((u) => u.key === "arena-cosmic")).toBe(true);
    });

    it("Level 6 unlocks arena-volcano (was cosmic in old layout)", () => {
      const def = getLevelDefinition(6);
      expect(def.unlocks.some((u) => u.key === "arena-volcano")).toBe(true);
    });

    it("Level 7 unlocks arena-ice (was volcano in old layout)", () => {
      const def = getLevelDefinition(7);
      expect(def.unlocks.some((u) => u.key === "arena-ice")).toBe(true);
    });

    it("Level 8 unlocks arena-grass (was ice in old layout)", () => {
      const def = getLevelDefinition(8);
      expect(def.unlocks.some((u) => u.key === "arena-grass")).toBe(true);
    });

    it("Level 9 gives the veteran title (was grass + no reward in old layout)", () => {
      const def = getLevelDefinition(9);
      expect(def.unlocks).toHaveLength(0);
      expect(def.reward).toEqual({ type: "title", key: "veteran" });
    });

    it("Level 10 gives only the legend title (NOT all-maps — redundant)", () => {
      const def = getLevelDefinition(10);
      // all-maps removed: by level 8 all 5 non-default maps are already
      // unlocked individually, so a "master key" makes no sense.
      expect(def.unlocks.some((u) => u.key === "all-maps")).toBe(false);
      expect(def.unlocks).toHaveLength(0);
      expect(def.reward).toEqual({ type: "title", key: "legend" });
    });

    it("arena-default is NOT in any level's unlocks (always available via mapManifest)", () => {
      // The arena-default map has unlockKey=null in mapManifest.ts, so
      // it's available from level 1 without needing a progression unlock.
      // Listing it as a level-3 unlock was misleading — players saw
      // "opened: arena-default" but the map was already selectable.
      for (const def of LEVELS) {
        expect(def.unlocks.some((u) => u.key === "arena-default")).toBe(false);
      }
    });

    it("all-maps is NOT in any level's unlocks (redundant master key)", () => {
      for (const def of LEVELS) {
        expect(def.unlocks.some((u) => u.key === "all-maps")).toBe(false);
      }
    });

    it("each of the 5 non-default maps unlocks exactly once across all levels", () => {
      const expectedMaps = [
        "arena-neon",
        "arena-cosmic",
        "arena-volcano",
        "arena-ice",
        "arena-grass",
      ];
      for (const mapKey of expectedMaps) {
        const occurrences = LEVELS.filter((def) =>
          def.unlocks.some((u) => u.key === mapKey),
        ).length;
        expect(occurrences, `${mapKey} should unlock exactly once`).toBe(1);
      }
    });

    it("levels 3-8 unlock one new map each (the 5 non-default maps)", () => {
      // Verify the spread: levels 3, 5, 6, 7, 8 each have exactly one
      // map unlock (level 4 has a bot, not a map).
      const mapUnlockLevels = LEVELS.filter(
        (def) => def.unlocks.some((u) => u.type === "map"),
      ).map((def) => def.level);
      expect(mapUnlockLevels).toEqual([3, 5, 6, 7, 8]);
    });
  });

  it("Each level has at least one unlock or a reward", () => {
    for (const def of LEVELS) {
      const hasUnlocks = def.unlocks.length > 0;
      const hasReward = def.reward !== null;
      expect(hasUnlocks || hasReward).toBe(true);
    }
  });
});
