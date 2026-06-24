/**
 * Achievements manifest for Arena Slaps.
 *
 * Single source of truth for the 18 unique achievement definitions. Each
 * definition is purely declarative — the unlock conditions live in
 * {@link ../services/AchievementService.ts AchievementService} and the
 * user-facing strings live in {@link ./translations.ts translations} under
 * the `nameKey` / `descKey` keys referenced here.
 *
 * Adding a new achievement:
 *   1. Append an entry to {@link ACHIEVEMENTS} below with a stable unique id.
 *   2. Add the matching `achievement.<id>.name` + `achievement.<id>.desc`
 *      keys to {@link ./translations.ts translations.ts}.
 *   3. Implement the unlock condition inside
 *      {@link ../services/AchievementService.ts AchievementService.checkBattleEnd}
 *      (or `checkLevel` for level-based achievements).
 */

export type AchievementCategory =
  | "combat"
  | "collection"
  | "milestone"
  | "progression"
  | "fun";

export type AchievementDefinition = {
  /** Stable unique identifier (used in profile.achievements + storage). */
  id: string;
  /** i18n key for the achievement name (e.g. "achievement.first_blood.name"). */
  nameKey: string;
  /** i18n key for the achievement description. */
  descKey: string;
  /** Coarse category used for grouping in the achievements grid UI. */
  category: AchievementCategory;
  /** Emoji glyph used as a temporary icon (future: sprite key). */
  icon: string;
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: "first_blood", nameKey: "achievement.first_blood.name", descKey: "achievement.first_blood.desc", category: "combat", icon: "🩸" },
  { id: "first_loss", nameKey: "achievement.first_loss.name", descKey: "achievement.first_loss.desc", category: "combat", icon: "🤕" },
  { id: "streak_5", nameKey: "achievement.streak_5.name", descKey: "achievement.streak_5.desc", category: "combat", icon: "🔥" },
  { id: "comeback_king", nameKey: "achievement.comeback_king.name", descKey: "achievement.comeback_king.desc", category: "combat", icon: "👑" },
  { id: "flawless", nameKey: "achievement.flawless.name", descKey: "achievement.flawless.desc", category: "combat", icon: "💎" },
  { id: "speed_demon", nameKey: "achievement.speed_demon.name", descKey: "achievement.speed_demon.desc", category: "combat", icon: "⚡" },
  { id: "power_collector", nameKey: "achievement.power_collector.name", descKey: "achievement.power_collector.desc", category: "collection", icon: "🎁" },
  { id: "all_powerups", nameKey: "achievement.all_powerups.name", descKey: "achievement.all_powerups.desc", category: "collection", icon: "📚" },
  { id: "combo_5", nameKey: "achievement.combo_5.name", descKey: "achievement.combo_5.desc", category: "combat", icon: "💥" },
  { id: "dodge_master", nameKey: "achievement.dodge_master.name", descKey: "achievement.dodge_master.desc", category: "combat", icon: "🌀" },
  { id: "ringout_master", nameKey: "achievement.ringout_master.name", descKey: "achievement.ringout_master.desc", category: "milestone", icon: "🎯" },
  { id: "first_flight", nameKey: "achievement.first_flight.name", descKey: "achievement.first_flight.desc", category: "fun", icon: "✈️" },
  { id: "survivor", nameKey: "achievement.survivor.name", descKey: "achievement.survivor.desc", category: "fun", icon: "🛡️" },
  { id: "level_5", nameKey: "achievement.level_5.name", descKey: "achievement.level_5.desc", category: "progression", icon: "⭐" },
  { id: "level_10", nameKey: "achievement.level_10.name", descKey: "achievement.level_10.desc", category: "progression", icon: "🏆" },
  { id: "all_maps", nameKey: "achievement.all_maps.name", descKey: "achievement.all_maps.desc", category: "milestone", icon: "🗺️" },
  { id: "social", nameKey: "achievement.social.name", descKey: "achievement.social.desc", category: "milestone", icon: "🎮" },
  { id: "veteran", nameKey: "achievement.veteran.name", descKey: "achievement.veteran.desc", category: "milestone", icon: "🎖️" },
];

/** Look up a single achievement by id. Returns `undefined` if not found. */
export function getAchievementById(
  id: string,
): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** All achievements matching a given category (stable order: manifest order). */
export function getAchievementsByCategory(
  category: AchievementCategory,
): readonly AchievementDefinition[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

/** Total number of achievement definitions in the manifest. */
export function getAchievementCount(): number {
  return ACHIEVEMENTS.length;
}
