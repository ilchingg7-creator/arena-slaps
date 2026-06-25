import { describe, expect, it } from "vitest";
import { ProgressionService, type GameResultForXp } from "./ProgressionService";
import type { Profile } from "../config/profile";

function mockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    nickname: "TestPlayer",
    avatar: "player-idle",
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    ringOutsInflicted: 0,
    ringOutsSuffered: 0,
    powerUpsCollected: 0,
    powerUpStats: {},
    favoriteMode: "1p-vs-bot",
    createdAt: 0,
    lastPlayedAt: 0,
    xp: 0,
    level: 1,
    achievements: [],
    currentWinStreak: 0,
    maxWinStreak: 0,
    powerUpTypesUsed: [],
    mapsPlayed: [],
    p2GamesPlayed: 0,
    cosmetics: { owned: [], equipped: {}, p2Equipped: {} },
    ...overrides,
  };
}

describe("ProgressionService", () => {
  describe("calculateXp", () => {
    it("win with 3 ring-outs and 2 power-ups", () => {
      const result: GameResultForXp = {
        outcome: "win",
        ringOutsInflicted: 3,
        powerUpsCollected: 2,
      };
      expect(ProgressionService.calculateXp(result)).toBe(100 + 60 + 20);
    });

    it("loss with 0 ring-outs and 0 power-ups", () => {
      const result: GameResultForXp = {
        outcome: "loss",
        ringOutsInflicted: 0,
        powerUpsCollected: 0,
      };
      expect(ProgressionService.calculateXp(result)).toBe(30);
    });

    it("draw with 1 ring-out and 1 power-up", () => {
      const result: GameResultForXp = {
        outcome: "draw",
        ringOutsInflicted: 1,
        powerUpsCollected: 1,
      };
      expect(ProgressionService.calculateXp(result)).toBe(50 + 20 + 10);
    });
  });

  describe("applyXp", () => {
    it("does not mutate the input profile", () => {
      const profile = mockProfile({ xp: 0, level: 1 });
      const { profile: result } = ProgressionService.applyXp(profile, 100);
      expect(profile.xp).toBe(0);
      expect(profile.level).toBe(1);
      expect(result.xp).toBe(100);
      expect(result.level).toBe(2);
    });

    it("0 XP: no level up", () => {
      const profile = mockProfile({ xp: 0, level: 1 });
      const { levelUp } = ProgressionService.applyXp(profile, 0);
      expect(levelUp.leveledUp).toBe(false);
    });

    it("crosses level boundary: leveledUp=true", () => {
      const profile = mockProfile({ xp: 50, level: 1 });
      const { levelUp } = ProgressionService.applyXp(profile, 100);
      expect(levelUp.leveledUp).toBe(true);
      expect(levelUp.newLevel).toBe(2);
    });

    it("crosses multiple levels: newUnlocks includes all", () => {
      const profile = mockProfile({ xp: 0, level: 1 });
      const { levelUp } = ProgressionService.applyXp(profile, 600);
      expect(levelUp.newLevel).toBe(4);
      expect(levelUp.newUnlocks.length).toBeGreaterThanOrEqual(3);
    });

    it("at max level: level stays 10", () => {
      const profile = mockProfile({ xp: 5500, level: 10 });
      const { profile: result, levelUp } = ProgressionService.applyXp(profile, 500);
      expect(levelUp.leveledUp).toBe(false);
      expect(result.level).toBe(10);
      expect(result.xp).toBe(6000);
    });

    it("returns the reward for the new level", () => {
      const profile = mockProfile({ xp: 50, level: 1 });
      const { levelUp } = ProgressionService.applyXp(profile, 100);
      expect(levelUp.reward).toEqual({ type: "title", key: "rookie" });
    });
  });

  describe("isFeatureUnlocked", () => {
    it("returns false for a locked feature", () => {
      const profile = mockProfile({ level: 1 });
      expect(ProgressionService.isFeatureUnlocked(profile, "bot-hard")).toBe(false);
    });

    it("returns true for an unlocked feature", () => {
      const profile = mockProfile({ level: 4 });
      expect(ProgressionService.isFeatureUnlocked(profile, "bot-hard")).toBe(true);
    });
  });

  describe("getUnlockedFeatures", () => {
    it("returns all unlocks up to the profile's level", () => {
      const profile = mockProfile({ level: 3 });
      const features = ProgressionService.getUnlockedFeatures(profile);
      expect(features).toHaveLength(3);
    });
  });

  describe("getProgressToNextLevel", () => {
    it("level 1 with 0 XP: progress=0, xpRemaining=100", () => {
      const profile = mockProfile({ xp: 0, level: 1 });
      const info = ProgressionService.getProgressToNextLevel(profile);
      expect(info.progress).toBe(0);
      expect(info.xpRemaining).toBe(100);
    });

    it("level 1 with 50 XP: progress=0.5, xpRemaining=50", () => {
      const profile = mockProfile({ xp: 50, level: 1 });
      const info = ProgressionService.getProgressToNextLevel(profile);
      expect(info.progress).toBe(0.5);
      expect(info.xpRemaining).toBe(50);
    });

    it("level 10 (max): progress=1, xpRemaining=0", () => {
      const profile = mockProfile({ xp: 5500, level: 10 });
      const info = ProgressionService.getProgressToNextLevel(profile);
      expect(info.progress).toBe(1);
      expect(info.xpRemaining).toBe(0);
    });
  });
});
