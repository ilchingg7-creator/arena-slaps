/**
 * `formatResultsSummary` — pure helper that converts a `BattleEndOutput`
 * (produced by `processBattleEnd` and stashed in the Phaser registry) into
 * the human-readable lines the ResultsScene shows below the winner banner.
 *
 * Extracted into its own module so the line-building logic can be unit-
 * tested without instantiating Phaser / the ResultsScene.
 *
 * The lines are i18n-aware: the caller passes a `t(key, fallback)` translator
 * so this module stays decoupled from the actual translation table. When the
 * translator is omitted, the fallback strings are used directly (handy for
 * tests + dev mode).
 */

import { getAchievementById } from "../config/achievements";
import type { BattleEndOutput } from "../services/processBattleEnd";

export type FormatResultsInput = {
  /** The end-of-battle output, or null if 2P mode / no data. */
  battleEnd: BattleEndOutput | null;
  /**
   * Translator that resolves a translation key to the active language's
   * string. When omitted, `fallback` is used directly.
   */
  t?: (key: string, fallback: string) => string;
};

/**
 * Build the summary lines for the ResultsScene. Each line is a separate
 * string so the scene can stack them vertically with consistent spacing.
 *
 * The XP + level + achievement lines only appear when `battleEnd` is
 * non-null (i.e. 1P-vs-bot mode). In 2P mode the caller should display
 * only the score / winner lines from `createBattleResultsSummary`.
 */
export function formatResultsSummary(input: FormatResultsInput): string[] {
  const { battleEnd } = input;
  const t = input.t ?? ((_key: string, fallback: string) => fallback);

  if (!battleEnd) {
    return [];
  }

  const lines: string[] = [];

  // XP gained this battle.
  lines.push(`${t("results.xp", "XP")}: +${battleEnd.xpGained}`);

  // Current level (post-battle).
  lines.push(
    `${t("results.level", "Level")}: ${battleEnd.updatedProfile.level}`,
  );

  // Level-up banner.
  if (battleEnd.levelUp.leveledUp) {
    const unlockKeys = battleEnd.levelUp.newUnlocks
      .map((u) => u.key)
      .join(", ");
    if (unlockKeys) {
      lines.push(
        `${t("results.levelUp", "Level up!")} → ${battleEnd.levelUp.newLevel} (${t("results.newUnlocks", "new")}: ${unlockKeys})`,
      );
    } else {
      lines.push(
        `${t("results.levelUp", "Level up!")} → ${battleEnd.levelUp.newLevel}`,
      );
    }
  }

  // Newly-unlocked achievements (one line each).
  for (const id of battleEnd.newlyUnlocked) {
    const def = getAchievementById(id);
    if (!def) continue;
    const name = t(def.nameKey, id);
    lines.push(`${t("results.achievementUnlocked", "Achievement unlocked")}: ${def.icon} ${name}`);
  }

  return lines;
}
