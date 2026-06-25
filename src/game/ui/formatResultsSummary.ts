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

  // Bug 2c fix: in 2P-local mode, no XP is awarded and the player's level
  // is irrelevant to the results. Showing "XP: +0" and "Level: X" after a
  // 2P battle is misleading, so skip those lines entirely. Achievement
  // lines (e.g. `social` just unlocked) are still shown below.
  const is2P = battleEnd.mode === "2p-local";

  // XP gained this battle (1P only).
  if (!is2P) {
    lines.push(`${t("results.xp", "XP")}: +${battleEnd.xpGained}`);
  }

  // Current level (1P only — 2P doesn't change level).
  if (!is2P) {
    lines.push(
      `${t("results.level", "Level")}: ${battleEnd.updatedProfile.level}`,
    );
  }

  // Level-up banner (won't fire for 2P since no XP, but defensive).
  if (battleEnd.levelUp.leveledUp) {
    // Translate each unlock key to its display name via the
    // `unlock.<key>` translation table (e.g. "bot-medium" → "Bot: Medium",
    // "arena-neon" → "Map: Neon", "title-master" → "Title: Master").
    // Falls back to the raw key if no translation exists (defensive —
    // shouldn't happen in practice, but a future unlock type without a
    // translation entry shouldn't crash the results screen).
    const unlockNames = battleEnd.levelUp.newUnlocks
      .map((u) => t(`unlock.${u.key}`, u.key))
      .join(", ");
    if (unlockNames) {
      lines.push(
        `${t("results.levelUp", "Level up!")} → ${battleEnd.levelUp.newLevel} (${t("results.newUnlocks", "new")}: ${unlockNames})`,
      );
    } else {
      lines.push(
        `${t("results.levelUp", "Level up!")} → ${battleEnd.levelUp.newLevel}`,
      );
    }
  }

  // Newly-unlocked achievements (one line each). Shown for ALL modes —
  // 2P can unlock `social` / `all_maps` / `veteran`.
  for (const id of battleEnd.newlyUnlocked) {
    const def = getAchievementById(id);
    if (!def) continue;
    const name = t(def.nameKey, id);
    lines.push(`${t("results.achievementUnlocked", "Achievement unlocked")}: ${def.icon} ${name}`);
  }

  return lines;
}
