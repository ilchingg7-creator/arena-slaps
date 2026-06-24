/**
 * `processBattleEnd` — pure helper that orchestrates the end-of-battle
 * pipeline: ProfileService → ProgressionService → AchievementService.
 *
 * The BattleScene round-complete block constructs a {@link BattleEndInput}
 * from runtime state and calls this helper. The helper returns everything
 * the caller needs to:
 *   1. Persist the updated profile (`updatedProfile`).
 *   2. Show the player how much XP they earned (`xpGained`).
 *   3. Show a level-up banner if they crossed a level boundary
 *      (`levelUp`).
 *   4. Show achievement notifications for `newlyUnlocked`.
 *
 * The helper is pure: it never touches localStorage or the UI. The caller
 * owns the persistence + presentation. This makes the entire end-of-battle
 * flow unit-testable without Phaser.
 */

import type { Profile } from "../config/profile";
import type { Unlock } from "../config/progression";
import { ProfileService, type GameResult } from "./ProfileService";
import { ProgressionService } from "./ProgressionService";
import {
  AchievementService,
  type BattleContext,
} from "./AchievementService";

export type BattleEndInput = {
  /** Pre-battle profile (loaded from storage by the caller). */
  profile: Profile;
  /** Long-term game result (mode / outcome / ring-outs / power-ups / mapKey). */
  result: GameResult;
  /**
   * Per-battle context for {@link AchievementService.checkBattleEnd}. Includes
   * the round duration, max combo, dodges, ring-outs suffered this battle,
   * and the power-up types collected this battle (deduped or not — the
   * service handles either).
   */
  ctx: BattleContext;
};

export type BattleEndOutput = {
  /** Profile with game result + XP + achievements applied. Persist this. */
  updatedProfile: Profile;
  /** Total XP earned this battle (base + ring-outs + power-ups). */
  xpGained: number;
  /** Level-up result (leveledUp=false if no boundary was crossed). */
  levelUp: {
    leveledUp: boolean;
    newLevel: number;
    newUnlocks: readonly Unlock[];
  };
  /**
   * Achievement ids unlocked by this battle (in manifest order). Includes
   * both battle-end achievements and level-based achievements (if a level-up
   * crossed the level_5 / level_10 threshold).
   */
  newlyUnlocked: string[];
  /**
   * Whether the player has already used the "×2 XP" rewarded-ad bonus for
   * this battle. Starts false; ResultsScene flips it to true after granting
   * the second XP portion. The flag is part of the output so it survives
   * `scene.restart()` (the registry entry it's stored in lives across
   * same-scene restarts) — without this, the player could restart the
   * scene and click ×2 XP again to farm XP infinitely (Bug 3).
   */
  xpDoubled: boolean;
};

/**
 * Run the full end-of-battle pipeline on the given input. See the type
 * doc above for the contract.
 *
 * In 2P-local mode the function returns the input profile unchanged with
 * zero XP / no unlocks — the "player" concept doesn't apply when both
 * players are human.
 */
export function processBattleEnd(input: BattleEndInput): BattleEndOutput {
  // 2P-local mode: no profile mutations. Both players are human.
  if (input.result.mode === "2p-local") {
    return {
      updatedProfile: input.profile,
      xpGained: 0,
      levelUp: {
        leveledUp: false,
        newLevel: input.profile.level,
        newUnlocks: [],
      },
      newlyUnlocked: [],
      xpDoubled: false,
    };
  }

  // Step 1: record the game result (wins / losses / streaks / maps / etc).
  const service = new ProfileService(input.profile);
  service.recordGameResult(input.result);
  const recordedProfile = service.getProfile();

  // Step 2: calculate + apply XP.
  const xpGained = ProgressionService.calculateXp({
    outcome: input.result.outcome,
    ringOutsInflicted: input.result.ringOutsInflicted,
    powerUpsCollected: input.result.powerUpsCollected,
  });
  const { profile: xpProfile, levelUp } = ProgressionService.applyXp(
    recordedProfile,
    xpGained,
  );

  // Step 3: check battle-end achievements (uses the post-XP profile so
  // ringOutsInflicted / streaks / etc are up to date).
  const battleResult = AchievementService.checkBattleEnd(xpProfile, input.ctx);
  let finalProfile: Profile = {
    ...xpProfile,
    achievements: battleResult.updatedProfile.achievements,
  };
  let newlyUnlocked: string[] = [...battleResult.newlyUnlocked];

  // Step 4: if leveled up, check level-based achievements (level_5 / level_10).
  if (levelUp.leveledUp) {
    const levelResult = AchievementService.checkLevel(
      finalProfile,
      levelUp.newLevel,
    );
    finalProfile = {
      ...finalProfile,
      achievements: levelResult.updatedProfile.achievements,
    };
    // Merge level-unlocked achievements, preserving manifest order via
    // the AchievementService.checkBattleEnd contract (newlyUnlocked is
    // already in manifest order; we append the level unlocks after).
    for (const id of levelResult.newlyUnlocked) {
      if (!newlyUnlocked.includes(id)) {
        newlyUnlocked.push(id);
      }
    }
  }

  return {
    updatedProfile: finalProfile,
    xpGained,
    levelUp: {
      leveledUp: levelUp.leveledUp,
      newLevel: levelUp.newLevel,
      newUnlocks: levelUp.newUnlocks,
    },
    newlyUnlocked,
    // Fresh battle end — XP has not been doubled yet. ResultsScene flips
    // this to true (via the registry) once the rewarded-ad bonus is
    // applied, and hides the ×2 XP button on subsequent renders.
    xpDoubled: false,
  };
}
