/**
 * AchievementService — evaluates unlock conditions and returns the updated
 * profile with newly-unlocked achievement ids.
 *
 * The service is **pure**: it never mutates the input profile, never touches
 * storage, and never shows UI. Callers are responsible for persisting the
 * returned `updatedProfile` and surfacing notifications for `newlyUnlocked`.
 *
 * The input profile is assumed to already reflect the post-battle state
 * (totalGames/wins/losses incremented, streak updated, map + power-up types
 * merged in, p2GamesPlayed incremented when applicable). The BattleScene
 * round-complete block does this pre-update; see the wiring code there for
 * the exact contract.
 *
 * Adding a new achievement:
 *   1. Add the definition to {@link ../config/achievements.ts ACHIEVEMENTS}.
 *   2. Add a `tryUnlock(...)` call in {@link AchievementService.checkBattleEnd}
 *      (or {@link AchievementService.checkLevel} for level-based achievements)
 *      with the matching condition.
 */

import {
  ACHIEVEMENTS,
  getAchievementById,
  type AchievementDefinition,
} from "../config/achievements";

/**
 * Snapshot of a single battle's outcome + per-battle stats. The
 * `BattleScene` round-complete block constructs this from the runtime state
 * (scores, time left, power-ups collected, etc.) before calling
 * {@link AchievementService.checkBattleEnd}.
 */
export type BattleContext = {
  outcome: "win" | "loss" | "draw";
  /** Final player score for this battle. */
  playerScore: number;
  /** Final opponent score for this battle. */
  botScore: number;
  /** Elapsed wall-clock time of the round, in milliseconds. */
  roundDurationMs: number;
  /** Number of power-ups the player collected in this battle. */
  powerUpsCollectedThisBattle: number;
  /** Distinct power-up type ids the player collected in this battle. */
  powerUpTypesThisBattle: string[];
  /** Highest combo multiplier the player reached this battle. */
  maxComboReached: number;
  /** Number of dodges the player performed this battle. */
  dodgesThisBattle: number;
  /** Number of times the player was knocked out this battle. */
  ringOutsSufferedThisBattle: number;
  /** Game mode of this battle ("1p-vs-bot" | "2p-local" | future). */
  mode: string;
  /** Map key the battle was played on. */
  mapKey: string;
};

/**
 * Subset of the player profile that the achievement system reads/writes.
 * Matches the long-term persisted shape; see
 * {@link ../config/profile.ts Profile} for the full type.
 */
export type ProfileForAchievements = {
  totalGames: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  maxWinStreak: number;
  ringOutsInflicted: number;
  ringOutsSuffered: number;
  powerUpsCollected: number;
  powerUpTypesUsed: string[];
  mapsPlayed: string[];
  p2GamesPlayed: number;
  achievements: string[];
};

export type UnlockResult = {
  /** Achievement ids unlocked by this call (in manifest order). */
  newlyUnlocked: string[];
  /** A new profile object with the `achievements` array extended. */
  updatedProfile: ProfileForAchievements;
};

/**
 * The 6 power-up type ids that must all be collected (across the player's
 * career) for the `all_powerups` achievement. The current Arena Slaps
 * PowerUpSystem exposes 3 (`speed`, `knockback`, `shield`); the remaining 3
 * are forward-looking placeholders so the achievement is meaningful once the
 * power-up roster is expanded. The achievement only checks the per-battle
 * `powerUpTypesThisBattle` collection — collecting all 6 in a single battle.
 */
export const ALL_POWERUP_TYPES: readonly string[] = [
  "speed",
  "knockback",
  "shield",
  "double_slap",
  "mega_sprint",
  "anti_gravity",
];

/**
 * The 6 map keys that must all be played for the `all_maps` achievement. The
 * current Arena Slaps codebase only ships `arena-default`; the remaining 5
 * are forward-looking placeholders for future map additions.
 */
export const ALL_MAPS: readonly string[] = [
  "arena-default",
  "arena-ice",
  "arena-lava",
  "arena-jungle",
  "arena-space",
  "arena-desert",
];

/** Speed Demon threshold: win in under this many milliseconds. */
export const SPEED_DEMON_MS = 30_000;

/** Streak threshold: win N battles in a row. */
export const STREAK_THRESHOLD = 5;

/** Power Collector threshold: collect N power-ups in one battle. */
export const POWER_COLLECTOR_THRESHOLD = 5;

/** Combo threshold: reach combo x N. */
export const COMBO_THRESHOLD = 5;

/** Dodge Master threshold: N dodges in one battle. */
export const DODGE_MASTER_THRESHOLD = 10;

/** Ring-out Master threshold: N lifetime ring-outs inflicted. */
export const RINGOUT_MASTER_THRESHOLD = 100;

/** Survivor threshold: N ring-outs suffered in one battle AND win. */
export const SURVIVOR_THRESHOLD = 3;

/** Comeback King threshold: opponent score reached before the player won. */
export const COMEBACK_OPPONENT_SCORE = 3;

/** Social threshold: N battles in 2P mode. */
export const SOCIAL_THRESHOLD = 10;

/** Veteran threshold: N total battles played. */
export const VETERAN_THRESHOLD = 50;

/** Level thresholds (used by checkLevel). */
export const LEVEL_5_THRESHOLD = 5;
export const LEVEL_10_THRESHOLD = 10;

export class AchievementService {
  /**
   * Check all battle-end achievements. The input profile is assumed to
   * already reflect the post-battle state (totalGames++, wins++, etc.).
   *
   * Returns a new profile (the input is never mutated) plus the list of
   * achievement ids that were newly unlocked by this call.
   */
  static checkBattleEnd(
    profile: ProfileForAchievements,
    ctx: BattleContext,
  ): UnlockResult {
    const alreadyUnlocked = new Set(profile.achievements);
    const newlyUnlocked: string[] = [];

    const tryUnlock = (id: string, condition: boolean): void => {
      if (!condition) {
        return;
      }
      if (alreadyUnlocked.has(id)) {
        return;
      }
      // Verify the id corresponds to a real achievement in the manifest.
      if (!getAchievementById(id)) {
        return;
      }
      alreadyUnlocked.add(id);
      newlyUnlocked.push(id);
    };

    const isWin = ctx.outcome === "win";
    const isLoss = ctx.outcome === "loss";

    // 1. first_blood — first ever win.
    tryUnlock("first_blood", isWin && profile.wins === 1);

    // 2. first_loss — first ever loss.
    tryUnlock("first_loss", isLoss && profile.losses === 1);

    // 3. streak_5 — current win streak reached 5.
    tryUnlock("streak_5", profile.currentWinStreak >= STREAK_THRESHOLD);

    // 4. comeback_king — won after being down 0-3 (bot reached >= 3 points).
    tryUnlock(
      "comeback_king",
      isWin && ctx.botScore >= COMEBACK_OPPONENT_SCORE,
    );

    // 5. flawless — won 5-0 (opponent scored 0; player reached >= 5).
    tryUnlock(
      "flawless",
      isWin && ctx.botScore === 0 && ctx.playerScore >= 5,
    );

    // 6. speed_demon — won in under 30 seconds.
    tryUnlock(
      "speed_demon",
      isWin && ctx.roundDurationMs < SPEED_DEMON_MS,
    );

    // 7. power_collector — collected >= 5 power-ups this battle.
    tryUnlock(
      "power_collector",
      ctx.powerUpsCollectedThisBattle >= POWER_COLLECTOR_THRESHOLD,
    );

    // 8. all_powerups — collected all 6 power-up types this battle.
    tryUnlock(
      "all_powerups",
      ALL_POWERUP_TYPES.every((t) =>
        ctx.powerUpTypesThisBattle.includes(t),
      ),
    );

    // 9. combo_5 — reached combo x5 this battle.
    tryUnlock("combo_5", ctx.maxComboReached >= COMBO_THRESHOLD);

    // 10. dodge_master — 10 dodges this battle.
    tryUnlock(
      "dodge_master",
      ctx.dodgesThisBattle >= DODGE_MASTER_THRESHOLD,
    );

    // 11. ringout_master — 100 lifetime ring-outs inflicted.
    tryUnlock(
      "ringout_master",
      profile.ringOutsInflicted >= RINGOUT_MASTER_THRESHOLD,
    );

    // 12. first_flight — first ever ring-out suffered.
    tryUnlock("first_flight", profile.ringOutsSuffered > 0);

    // 13. survivor — 3 ring-outs suffered this battle AND won.
    tryUnlock(
      "survivor",
      isWin && ctx.ringOutsSufferedThisBattle >= SURVIVOR_THRESHOLD,
    );

    // 14 & 15. level_5 / level_10 — handled by checkLevel.

    // 16. all_maps — played on all 6 maps.
    tryUnlock(
      "all_maps",
      ALL_MAPS.every((m) => profile.mapsPlayed.includes(m)),
    );

    // 17. social — 10 battles in 2P mode.
    tryUnlock("social", profile.p2GamesPlayed >= SOCIAL_THRESHOLD);

    // 18. veteran — 50 total battles played.
    tryUnlock("veteran", profile.totalGames >= VETERAN_THRESHOLD);

    // Build the updated profile (immutable — never mutate the input).
    const updatedProfile: ProfileForAchievements = {
      ...profile,
      achievements: Array.from(alreadyUnlocked),
      powerUpTypesUsed: [...profile.powerUpTypesUsed],
      mapsPlayed: [...profile.mapsPlayed],
    };

    return { newlyUnlocked, updatedProfile };
  }

  /**
   * Check the level-based achievements (`level_5`, `level_10`). Called by
   * the progression system after XP is applied and the new level computed.
   */
  static checkLevel(
    profile: ProfileForAchievements,
    newLevel: number,
  ): UnlockResult {
    const alreadyUnlocked = new Set(profile.achievements);
    const newlyUnlocked: string[] = [];

    const tryUnlock = (id: string, condition: boolean): void => {
      if (!condition || alreadyUnlocked.has(id)) {
        return;
      }
      if (!getAchievementById(id)) {
        return;
      }
      alreadyUnlocked.add(id);
      newlyUnlocked.push(id);
    };

    tryUnlock("level_5", newLevel >= LEVEL_5_THRESHOLD);
    tryUnlock("level_10", newLevel >= LEVEL_10_THRESHOLD);

    const updatedProfile: ProfileForAchievements = {
      ...profile,
      achievements: Array.from(alreadyUnlocked),
      powerUpTypesUsed: [...profile.powerUpTypesUsed],
      mapsPlayed: [...profile.mapsPlayed],
    };

    return { newlyUnlocked, updatedProfile };
  }

  /** Whether the given achievement id is unlocked for this profile. */
  static isUnlocked(
    profile: ProfileForAchievements,
    id: string,
  ): boolean {
    return profile.achievements.includes(id);
  }

  /** All unlocked achievement definitions (in manifest order). */
  static getUnlockedDefinitions(
    profile: ProfileForAchievements,
  ): readonly AchievementDefinition[] {
    const unlocked = new Set(profile.achievements);
    return ACHIEVEMENTS.filter((a) => unlocked.has(a.id));
  }

  /** All locked achievement definitions (in manifest order). */
  static getLockedDefinitions(
    profile: ProfileForAchievements,
  ): readonly AchievementDefinition[] {
    const unlocked = new Set(profile.achievements);
    return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id));
  }
}
