import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../config/profile";
import type { GameResult } from "./ProfileService";
import { processBattleEnd, type BattleEndInput } from "./processBattleEnd";

function baseInput(
  overrides: Partial<BattleEndInput> = {},
): BattleEndInput {
  return {
    profile: { ...DEFAULT_PROFILE, powerUpStats: {} },
    result: {
      mode: "1p-vs-bot",
      outcome: "win",
      ringOutsInflicted: 5,
      ringOutsSuffered: 0,
      powerUpsCollected: 0,
      powerUpTypes: [],
      mapKey: "arena-default",
    },
    // Per-battle context (what AchievementService.checkBattleEnd reads).
    ctx: {
      outcome: "win",
      playerScore: 5,
      botScore: 0,
      roundDurationMs: 25_000, // < 30s → speed_demon
      powerUpsCollectedThisBattle: 0,
      powerUpTypesThisBattle: [],
      maxComboReached: 0,
      dodgesThisBattle: 0,
      ringOutsSufferedThisBattle: 0,
      mode: "1p-vs-bot",
      mapKey: "arena-default",
    },
    ...overrides,
  };
}

describe("processBattleEnd", () => {
  it("returns the original profile when mode is 2p-local (no profile mutations)", () => {
    const input = baseInput({
      result: {
        mode: "2p-local",
        outcome: "win",
        ringOutsInflicted: 5,
        ringOutsSuffered: 0,
        powerUpsCollected: 0,
        powerUpTypes: [],
        mapKey: "arena-default",
      },
      ctx: {
        outcome: "win",
        playerScore: 5,
        botScore: 0,
        roundDurationMs: 25_000,
        powerUpsCollectedThisBattle: 0,
        powerUpTypesThisBattle: [],
        maxComboReached: 0,
        dodgesThisBattle: 0,
        ringOutsSufferedThisBattle: 0,
        mode: "2p-local",
        mapKey: "arena-default",
      },
    });
    const out = processBattleEnd(input);
    // No XP awarded, no achievements, totalGames still 0.
    expect(out.xpGained).toBe(0);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.updatedProfile.totalGames).toBe(0);
    expect(out.updatedProfile.xp).toBe(0);
    expect(out.updatedProfile.level).toBe(1);
    expect(out.levelUp.leveledUp).toBe(false);
  });

  it("records the game + applies XP for a 1p-vs-bot win", () => {
    const out = processBattleEnd(baseInput());
    expect(out.xpGained).toBeGreaterThan(0);
    expect(out.updatedProfile.totalGames).toBe(1);
    expect(out.updatedProfile.wins).toBe(1);
    expect(out.updatedProfile.currentWinStreak).toBe(1);
    expect(out.updatedProfile.xp).toBe(out.xpGained);
  });

  it("unlocks first_blood + flawless + speed_demon on a fast 5-0 win", () => {
    const out = processBattleEnd(baseInput());
    expect(out.newlyUnlocked).toContain("first_blood");
    expect(out.newlyUnlocked).toContain("flawless");
    expect(out.newlyUnlocked).toContain("speed_demon");
  });

  it("persists newlyUnlocked into updatedProfile.achievements", () => {
    const out = processBattleEnd(baseInput());
    expect(out.updatedProfile.achievements).toContain("first_blood");
    expect(out.updatedProfile.achievements).toContain("flawless");
    expect(out.updatedProfile.achievements).toContain("speed_demon");
  });

  it("does NOT re-unlock already-unlocked achievements", () => {
    const input = baseInput({
      profile: {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        wins: 1,
        totalGames: 1,
        achievements: ["first_blood", "flawless", "speed_demon"],
      },
    });
    const out = processBattleEnd(input);
    expect(out.newlyUnlocked).not.toContain("first_blood");
    expect(out.newlyUnlocked).not.toContain("flawless");
    expect(out.newlyUnlocked).not.toContain("speed_demon");
  });

  it("unlocks first_loss on the first loss", () => {
    const input = baseInput({
      result: {
        mode: "1p-vs-bot",
        outcome: "loss",
        ringOutsInflicted: 0,
        ringOutsSuffered: 5,
        powerUpsCollected: 0,
        powerUpTypes: [],
        mapKey: "arena-default",
      },
      ctx: {
        outcome: "loss",
        playerScore: 0,
        botScore: 5,
        roundDurationMs: 60_000,
        powerUpsCollectedThisBattle: 0,
        powerUpTypesThisBattle: [],
        maxComboReached: 0,
        dodgesThisBattle: 0,
        ringOutsSufferedThisBattle: 5,
        mode: "1p-vs-bot",
        mapKey: "arena-default",
      },
    });
    const out = processBattleEnd(input);
    expect(out.newlyUnlocked).toContain("first_loss");
    expect(out.updatedProfile.losses).toBe(1);
    expect(out.updatedProfile.currentWinStreak).toBe(0);
  });

  it("unlocks streak_5 when the 5th consecutive win is recorded", () => {
    const input = baseInput({
      profile: {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        wins: 4,
        totalGames: 4,
        currentWinStreak: 4,
        maxWinStreak: 4,
      },
    });
    const out = processBattleEnd(input);
    expect(out.updatedProfile.currentWinStreak).toBe(5);
    expect(out.updatedProfile.maxWinStreak).toBe(5);
    expect(out.newlyUnlocked).toContain("streak_5");
  });

  it("unlocks level_5 via checkLevel when XP crosses the level-5 threshold", () => {
    // Build a profile just below the level-5 threshold. We need to know
    // the threshold — read it from progression config to stay decoupled.
    // Easier path: pre-set level=4, xp=just-below-5, and grant a big XP
    // reward via a high ringOutsInflicted + powerUpsCollected result.
    const input = baseInput({
      profile: {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        xp: 0,
        level: 1,
      },
      result: {
        mode: "1p-vs-bot",
        outcome: "win",
        ringOutsInflicted: 999,
        ringOutsSuffered: 0,
        powerUpsCollected: 999,
        powerUpTypes: [],
        mapKey: "arena-default",
      },
      ctx: {
        outcome: "win",
        playerScore: 999,
        botScore: 0,
        roundDurationMs: 5_000,
        powerUpsCollectedThisBattle: 999,
        powerUpTypesThisBattle: [],
        maxComboReached: 5,
        dodgesThisBattle: 10,
        ringOutsSufferedThisBattle: 0,
        mode: "1p-vs-bot",
        mapKey: "arena-default",
      },
    });
    const out = processBattleEnd(input);
    // With ~999 ring-outs * 50 XP each + win bonus, level should jump
    // past 5 → level_5 achievement should unlock.
    expect(out.updatedProfile.level).toBeGreaterThanOrEqual(5);
    expect(out.newlyUnlocked).toContain("level_5");
    // level_10 also unlocks if level jumped to >= 10.
    if (out.updatedProfile.level >= 10) {
      expect(out.newlyUnlocked).toContain("level_10");
    }
  });

  it("records mapsPlayed + powerUpTypesUsed into the updated profile", () => {
    const out = processBattleEnd(
      baseInput({
        result: {
          mode: "1p-vs-bot",
          outcome: "win",
          ringOutsInflicted: 5,
          ringOutsSuffered: 0,
          powerUpsCollected: 2,
          powerUpTypes: ["speed", "shield"],
          mapKey: "arena-ice",
        },
        ctx: {
          outcome: "win",
          playerScore: 5,
          botScore: 0,
          roundDurationMs: 25_000,
          powerUpsCollectedThisBattle: 2,
          powerUpTypesThisBattle: ["speed", "shield"],
          maxComboReached: 0,
          dodgesThisBattle: 0,
          ringOutsSufferedThisBattle: 0,
          mode: "1p-vs-bot",
          mapKey: "arena-ice",
        },
      }),
    );
    expect(out.updatedProfile.mapsPlayed).toContain("arena-ice");
    expect(out.updatedProfile.powerUpTypesUsed).toContain("speed");
    expect(out.updatedProfile.powerUpTypesUsed).toContain("shield");
  });

  it("does not mutate the input profile (immutability)", () => {
    const input = baseInput();
    const inputAchievementsLen = input.profile.achievements.length;
    const inputMapsLen = input.profile.mapsPlayed.length;
    const inputTypesLen = input.profile.powerUpTypesUsed.length;
    processBattleEnd(input);
    expect(input.profile.achievements).toHaveLength(inputAchievementsLen);
    expect(input.profile.mapsPlayed).toHaveLength(inputMapsLen);
    expect(input.profile.powerUpTypesUsed).toHaveLength(inputTypesLen);
    expect(input.profile.totalGames).toBe(0);
  });

  // --- RED: ×2 XP exploit fix ---
  describe("×2 XP exploit fix (Bug 3)", () => {
    it("returns xpDoubled=false on a fresh battle end", () => {
      // The output now carries an xpDoubled flag so ResultsScene can hide
      // the rewarded-ad button after the player has already doubled.
      const out = processBattleEnd(baseInput());
      expect(out.xpDoubled).toBe(false);
    });

    it("xpGained includes ring-out + power-up bonuses (not just base)", () => {
      // Bug 3b: the original ResultsScene "×2 XP" button granted only the
      // base XP (win=100/loss=30/draw=50) as a "double approximation",
      // completely ignoring ring-outs (×20) and power-ups (×10). The real
      // xpGained is what ProgressionService.calculateXp returns — we now
      // expose it on the output so ResultsScene can grant the SAME amount
      // as the second portion (true double).
      const out = processBattleEnd(
        baseInput({
          result: {
            mode: "1p-vs-bot",
            outcome: "win",
            ringOutsInflicted: 5,
            ringOutsSuffered: 0,
            powerUpsCollected: 3,
            powerUpTypes: ["speed", "shield", "knockback"],
            mapKey: "arena-default",
          },
        }),
      );
      // base(100) + ringOuts(5*20=100) + powerUps(3*10=30) = 230
      expect(out.xpGained).toBe(230);
    });

    it("xpDoubled defaults to false even when leveling up + unlocking achievements", () => {
      // Make sure the flag is present regardless of which other fields
      // are populated — ResultsScene reads it unconditionally.
      const out = processBattleEnd(
        baseInput({
          profile: {
            ...DEFAULT_PROFILE,
            powerUpStats: {},
            wins: 4,
            totalGames: 4,
            currentWinStreak: 4,
            maxWinStreak: 4,
          },
        }),
      );
      expect(out.xpDoubled).toBe(false);
      expect(out.newlyUnlocked.length).toBeGreaterThan(0);
    });
  });
});
