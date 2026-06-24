import { describe, expect, it } from "vitest";

import {
  AchievementService,
  ALL_MAPS,
  ALL_POWERUP_TYPES,
  type BattleContext,
  type ProfileForAchievements,
} from "./AchievementService";
import { ACHIEVEMENTS, getAchievementCount } from "../config/achievements";
import { POWERUP_DEFINITIONS } from "../config/powerUpConfig";
import { MAPS } from "../config/mapManifest";

function baseProfile(
  overrides: Partial<ProfileForAchievements> = {},
): ProfileForAchievements {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    currentWinStreak: 0,
    maxWinStreak: 0,
    ringOutsInflicted: 0,
    ringOutsSuffered: 0,
    powerUpsCollected: 0,
    powerUpTypesUsed: [],
    mapsPlayed: [],
    p2GamesPlayed: 0,
    achievements: [],
    ...overrides,
  };
}

function baseCtx(overrides: Partial<BattleContext> = {}): BattleContext {
  return {
    outcome: "win",
    playerScore: 5,
    botScore: 0,
    roundDurationMs: 60_000,
    powerUpsCollectedThisBattle: 0,
    powerUpTypesThisBattle: [],
    maxComboReached: 0,
    dodgesThisBattle: 0,
    ringOutsSufferedThisBattle: 0,
    mode: "1p-vs-bot",
    mapKey: "arena-default",
    ...overrides,
  };
}

describe("AchievementService.checkBattleEnd", () => {
  it("unlocks first_blood on first win", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({ outcome: "win" });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("first_blood");
  });

  it("unlocks first_loss on first loss", () => {
    const profile = baseProfile({ losses: 1, totalGames: 1 });
    const ctx = baseCtx({ outcome: "loss" });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("first_loss");
  });

  it("unlocks streak_5 when currentWinStreak reaches 5", () => {
    const profile = baseProfile({ currentWinStreak: 5, wins: 5, totalGames: 5 });
    const ctx = baseCtx({ outcome: "win" });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("streak_5");
  });

  it("unlocks comeback_king when score was 0-3 and player wins", () => {
    // Final score: player 5, bot 3 — bot reached >= 3 before player won.
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({ outcome: "win", playerScore: 5, botScore: 3 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("comeback_king");
  });

  it("unlocks flawless when 5-0", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({ outcome: "win", playerScore: 5, botScore: 0 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("flawless");
  });

  it("unlocks speed_demon when roundDurationMs < 30000 and win", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({
      outcome: "win",
      roundDurationMs: 25_000,
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("speed_demon");
  });

  it("unlocks power_collector when powerUpsCollectedThisBattle >= 5", () => {
    const profile = baseProfile();
    const ctx = baseCtx({
      powerUpsCollectedThisBattle: 5,
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("power_collector");
  });

  it("unlocks all_powerups when powerUpTypesThisBattle has all 6", () => {
    const profile = baseProfile();
    const ctx = baseCtx({
      powerUpTypesThisBattle: [...ALL_POWERUP_TYPES],
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("all_powerups");
  });

  it("unlocks combo_5 when maxComboReached >= 5", () => {
    const profile = baseProfile();
    const ctx = baseCtx({
      maxComboReached: 5,
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("combo_5");
  });

  it("unlocks dodge_master when dodgesThisBattle >= 10", () => {
    const profile = baseProfile();
    const ctx = baseCtx({
      dodgesThisBattle: 10,
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("dodge_master");
  });

  it("unlocks ringout_master when ringOutsInflicted >= 100", () => {
    const profile = baseProfile({
      ringOutsInflicted: 100,
      wins: 1,
      totalGames: 1,
    });
    const ctx = baseCtx({ outcome: "win", botScore: 2 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("ringout_master");
  });

  it("unlocks first_flight when ringOutsSuffered becomes > 0", () => {
    const profile = baseProfile({
      ringOutsSuffered: 1,
      totalGames: 1,
      losses: 1,
    });
    const ctx = baseCtx({
      outcome: "loss",
      ringOutsSufferedThisBattle: 1,
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("first_flight");
  });

  it("unlocks survivor when ringOutsSufferedThisBattle >= 3 and win", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({
      outcome: "win",
      ringOutsSufferedThisBattle: 3,
      botScore: 2, // avoid flawless
      // ringOutsSuffered > 0 would also unlock first_flight; that's fine.
      playerScore: 5,
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("survivor");
  });

  it("unlocks social when p2GamesPlayed >= 10", () => {
    const profile = baseProfile({ p2GamesPlayed: 10, totalGames: 10, wins: 1 });
    const ctx = baseCtx({
      outcome: "win",
      mode: "2p-local",
      botScore: 2, // avoid flawless
    });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("social");
  });

  it("unlocks veteran when totalGames >= 50", () => {
    const profile = baseProfile({ totalGames: 50, wins: 1 });
    const ctx = baseCtx({ outcome: "win", botScore: 2 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("veteran");
  });

  it("unlocks all_maps when mapsPlayed has all 6", () => {
    const profile = baseProfile({
      mapsPlayed: [...ALL_MAPS],
      totalGames: 1,
      wins: 1,
    });
    const ctx = baseCtx({ outcome: "win", botScore: 2 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toContain("all_maps");
  });

  it("does NOT re-unlock already unlocked achievements", () => {
    const profile = baseProfile({
      wins: 1,
      totalGames: 1,
      achievements: ["first_blood"],
    });
    const ctx = baseCtx({ outcome: "win", botScore: 2 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).not.toContain("first_blood");
    expect(result.updatedProfile.achievements).toContain("first_blood");
  });

  it("returns empty newlyUnlocked when nothing new", () => {
    // Profile already has all achievements unlocked.
    const allIds = ACHIEVEMENTS.map((a) => a.id);
    const profile = baseProfile({
      wins: 100,
      totalGames: 100,
      losses: 50,
      currentWinStreak: 10,
      ringOutsInflicted: 200,
      ringOutsSuffered: 50,
      p2GamesPlayed: 50,
      mapsPlayed: [...ALL_MAPS],
      achievements: allIds,
    });
    const ctx = baseCtx({ outcome: "win", botScore: 2 });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.newlyUnlocked).toEqual([]);
  });
});

describe("AchievementService.checkLevel", () => {
  it("unlocks level_5 at level 5", () => {
    const profile = baseProfile();
    const result = AchievementService.checkLevel(profile, 5);
    expect(result.newlyUnlocked).toContain("level_5");
    expect(result.newlyUnlocked).not.toContain("level_10");
  });

  it("unlocks level_10 at level 10", () => {
    const profile = baseProfile({ achievements: ["level_5"] });
    const result = AchievementService.checkLevel(profile, 10);
    expect(result.newlyUnlocked).toContain("level_10");
  });

  it("does not unlock level_5 before level 5", () => {
    const profile = baseProfile();
    const result = AchievementService.checkLevel(profile, 4);
    expect(result.newlyUnlocked).not.toContain("level_5");
    expect(result.newlyUnlocked).not.toContain("level_10");
  });
});

describe("AchievementService.isUnlocked", () => {
  it("returns true for existing, false for missing", () => {
    const profile = baseProfile({ achievements: ["first_blood", "streak_5"] });
    expect(AchievementService.isUnlocked(profile, "first_blood")).toBe(true);
    expect(AchievementService.isUnlocked(profile, "streak_5")).toBe(true);
    expect(AchievementService.isUnlocked(profile, "flawless")).toBe(false);
    expect(AchievementService.isUnlocked(profile, "veteran")).toBe(false);
  });
});

describe("AchievementService.getUnlockedDefinitions / getLockedDefinitions", () => {
  it("getUnlockedDefinitions returns correct count", () => {
    const profile = baseProfile({
      achievements: ["first_blood", "streak_5", "veteran"],
    });
    const unlocked = AchievementService.getUnlockedDefinitions(profile);
    expect(unlocked.length).toBe(3);
    expect(unlocked.map((a) => a.id).sort()).toEqual(
      ["first_blood", "streak_5", "veteran"].sort(),
    );
  });

  it("getLockedDefinitions returns correct count", () => {
    const profile = baseProfile({
      achievements: ["first_blood", "streak_5", "veteran"],
    });
    const locked = AchievementService.getLockedDefinitions(profile);
    expect(locked.length).toBe(getAchievementCount() - 3);
    expect(locked.map((a) => a.id)).not.toContain("first_blood");
  });

  it("unlocked + locked partition the full manifest", () => {
    const profile = baseProfile({
      achievements: ["first_blood", "veteran"],
    });
    const unlocked = AchievementService.getUnlockedDefinitions(profile);
    const locked = AchievementService.getLockedDefinitions(profile);
    expect(unlocked.length + locked.length).toBe(getAchievementCount());
  });
});

describe("AchievementService immutability", () => {
  it("checkBattleEnd does not mutate the input profile", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const snapshot = {
      ...profile,
      achievements: [...profile.achievements],
      powerUpTypesUsed: [...profile.powerUpTypesUsed],
      mapsPlayed: [...profile.mapsPlayed],
    };
    const ctx = baseCtx({ outcome: "win" });
    AchievementService.checkBattleEnd(profile, ctx);
    expect(profile).toEqual(snapshot);
  });

  it("checkBattleEnd returns a new achievements array (no shared reference)", () => {
    const profile = baseProfile({ wins: 1, totalGames: 1 });
    const ctx = baseCtx({ outcome: "win" });
    const result = AchievementService.checkBattleEnd(profile, ctx);
    expect(result.updatedProfile.achievements).not.toBe(profile.achievements);
    expect(result.updatedProfile.powerUpTypesUsed).not.toBe(
      profile.powerUpTypesUsed,
    );
    expect(result.updatedProfile.mapsPlayed).not.toBe(profile.mapsPlayed);
  });

  // --- RED: Bug 3+4 — ALL_POWERUP_TYPES / ALL_MAPS must match real keys ---
  describe("Bug 3+4: achievement keys match real manifest keys", () => {
    it("ALL_POWERUP_TYPES contains exactly the real power-up keys from powerUpConfig", () => {
      // Bug 3: ALL_POWERUP_TYPES had "double_slap", "mega_sprint",
      // "anti_gravity" — none of which exist as PowerUpEffect keys. The
      // real keys (from POWERUP_DEFINITIONS) are "speed", "knockback",
      // "shield", "mega-knockback", "freeze", "double-slap". Without
      // this match, `all_powerups` is mathematically unreachable.
      const realKeys = POWERUP_DEFINITIONS.map((d) => d.key).sort();
      const achievementKeys = [...ALL_POWERUP_TYPES].sort();
      expect(achievementKeys).toEqual(realKeys);
    });

    it("ALL_MAPS contains exactly the real map keys from mapManifest", () => {
      // Bug 4: ALL_MAPS had "arena-lava", "arena-jungle", "arena-space",
      // "arena-desert" — none of which exist in MAPS. The real keys are
      // "arena-default", "arena-neon", "arena-cosmic", "arena-volcano",
      // "arena-ice", "arena-grass". Without this match, `all_maps` is
      // mathematically unreachable.
      const realKeys = MAPS.map((m) => m.key).sort();
      const achievementKeys = [...ALL_MAPS].sort();
      expect(achievementKeys).toEqual(realKeys);
    });

    it("unlocks all_powerups when the player collects ALL real power-up types in one battle", () => {
      // Use the real keys (not ALL_POWERUP_TYPES directly) to prove the
      // achievement is reachable in practice.
      const realKeys = POWERUP_DEFINITIONS.map((d) => d.key);
      const profile = baseProfile();
      const ctx = baseCtx({
        powerUpTypesThisBattle: [...realKeys],
        botScore: 2, // avoid flawless
      });
      const result = AchievementService.checkBattleEnd(profile, ctx);
      expect(result.newlyUnlocked).toContain("all_powerups");
    });

    it("unlocks all_maps when the player has played on ALL real maps", () => {
      const realKeys = MAPS.map((m) => m.key);
      const profile = baseProfile({
        mapsPlayed: [...realKeys],
        totalGames: realKeys.length,
        wins: 1,
      });
      const ctx = baseCtx({ outcome: "win" });
      const result = AchievementService.checkBattleEnd(profile, ctx);
      expect(result.newlyUnlocked).toContain("all_maps");
    });

    it("does NOT unlock all_powerups when only the OLD (wrong) keys are collected", () => {
      // Regression guard: the old wrong keys must NOT satisfy the condition.
      const profile = baseProfile();
      const ctx = baseCtx({
        powerUpTypesThisBattle: [
          "speed",
          "knockback",
          "shield",
          "double_slap", // wrong — real is "double-slap"
          "mega_sprint", // wrong — real is "mega-knockback"
          "anti_gravity", // wrong — real is "freeze"
        ],
        botScore: 2,
      });
      const result = AchievementService.checkBattleEnd(profile, ctx);
      expect(result.newlyUnlocked).not.toContain("all_powerups");
    });

    it("does NOT unlock all_maps when only the OLD (wrong) map keys are played", () => {
      const profile = baseProfile({
        mapsPlayed: [
          "arena-default",
          "arena-ice",
          "arena-lava", // wrong
          "arena-jungle", // wrong
          "arena-space", // wrong
          "arena-desert", // wrong
        ],
        totalGames: 6,
        wins: 1,
      });
      const ctx = baseCtx({ outcome: "win" });
      const result = AchievementService.checkBattleEnd(profile, ctx);
      expect(result.newlyUnlocked).not.toContain("all_maps");
    });
  });
});
