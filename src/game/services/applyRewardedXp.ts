/**
 * `applyRewardedXp` — pure helper that applies the SECOND half of the ×2 XP
 * rewarded-ad bonus and recalculates level-up + level-based achievements.
 *
 * Bug 7: ResultsScene's ×2 XP callback previously called
 * `ProgressionService.applyXp` directly and saved the profile, but it did
 * NOT recalculate `battleEnd.levelUp` or `battleEnd.newlyUnlocked`. This
 * meant:
 *   - If the rewarded XP caused a level-up, the "Level up!" banner didn't
 *     show (battleEnd.levelUp.leveledUp stayed false from the original
 *     battle).
 *   - If the level-up crossed level 5 or 10, the `level_5` / `level_10`
 *     achievements were NOT unlocked (AchievementService.checkLevel was
 *     never called).
 *
 * This helper fixes both issues by running the full
 * applyXp → checkLevel pipeline and returning an updated BattleEndOutput
 * that ResultsScene can write to the registry.
 */

import type { Profile } from "../config/profile";
import { ProgressionService } from "./ProgressionService";
import { AchievementService } from "./AchievementService";
import type { BattleEndOutput } from "./processBattleEnd";

export type RewardedXpResult = {
  /** Updated profile (save this to localStorage). */
  updatedProfile: Profile;
  /** Updated battle end output (write this to the registry). */
  updatedBattleEnd: BattleEndOutput;
};

/**
 * Apply the rewarded XP bonus to `profile` and return the updated profile
 * + battle end output.
 *
 * The `battleEnd.xpGained` value is used as the second XP portion (the
 * first was already applied by `processBattleEnd` in BattleScene). This
 * makes the ×2 a TRUE double — the player ends up with 2× the battle's
 * XP in their profile.
 *
 * If the rewarded XP causes a level-up, `AchievementService.checkLevel`
 * runs and may unlock `level_5` / `level_10`. The newly-unlocked ids are
 * MERGED with the original `battleEnd.newlyUnlocked` (so ResultsScene
 * shows both the battle-end achievements AND the level-up achievements).
 *
 * The `xpDoubled` flag is set to `true` on the returned battle end output
 * so ResultsScene hides the ×2 XP button on subsequent renders.
 */
export function applyRewardedXp(
  battleEnd: BattleEndOutput,
  profile: Profile,
): RewardedXpResult {
  // Apply the second XP portion.
  const { profile: xpProfile, levelUp } = ProgressionService.applyXp(
    profile,
    battleEnd.xpGained,
  );

  let finalProfile: Profile = xpProfile;
  // Merge the original battle-end newlyUnlocked with any level-up
  // achievements unlocked by the rewarded XP.
  let newlyUnlocked: string[] = [...battleEnd.newlyUnlocked];

  if (levelUp.leveledUp) {
    const levelResult = AchievementService.checkLevel(
      finalProfile,
      levelUp.newLevel,
    );
    finalProfile = {
      ...finalProfile,
      achievements: levelResult.updatedProfile.achievements,
    };
    // Merge level-unlocked achievements (deduped — if an id was already
    // in the original newlyUnlocked, don't add it twice).
    for (const id of levelResult.newlyUnlocked) {
      if (!newlyUnlocked.includes(id)) {
        newlyUnlocked.push(id);
      }
    }
  }

  const updatedBattleEnd: BattleEndOutput = {
    ...battleEnd,
    updatedProfile: finalProfile,
    levelUp: {
      leveledUp: levelUp.leveledUp,
      newLevel: levelUp.newLevel,
      newUnlocks: levelUp.newUnlocks,
      // Bug 7 fix: include the title reward so ResultsScene can display
      // "Title: X unlocked" after a rewarded-XP level-up too.
      reward: levelUp.reward,
    },
    newlyUnlocked,
    xpDoubled: true,
  };

  return { updatedProfile: finalProfile, updatedBattleEnd };
}
