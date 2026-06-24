/**
 * Player profile persisted in localStorage.
 *
 * Holds long-term cross-session state: total games, wins/losses, ring-outs,
 * power-ups collected, maps played, achievements unlocked, etc. Used by
 * {@link ../services/AchievementService.ts AchievementService} to evaluate
 * unlock conditions and by the AchievementsScene to render the grid.
 *
 * Storage shape is forward-compatible: {@link migrateProfile} fills in any
 * fields missing from older persisted profiles, so older clients don't break
 * when new fields are added.
 */

export type Profile = {
  /** Total battles played (1P-vs-bot + 2P-local). */
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  /** XP earned from battles. Used by the (future) progression system. */
  xp: number;
  /** Current player level (derived from xp; 1-based). */
  level: number;
  /** Active win streak; reset on any non-win. */
  currentWinStreak: number;
  /** Longest win streak ever achieved. */
  maxWinStreak: number;
  /** Lifetime ring-outs the player has inflicted on opponents. */
  ringOutsInflicted: number;
  /** Lifetime ring-outs the player has suffered. */
  ringOutsSuffered: number;
  /** Lifetime power-ups collected. */
  powerUpsCollected: number;
  /** Distinct power-up types ever collected (string ids). */
  powerUpTypesUsed: string[];
  /** Distinct map keys ever played on. */
  mapsPlayed: string[];
  /** Total battles played in 2P-local mode. */
  p2GamesPlayed: number;
  /** Unlocked achievement ids (permanent — never reset on stats reset). */
  achievements: string[];
};

export const DEFAULT_PROFILE: Profile = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  xp: 0,
  level: 1,
  currentWinStreak: 0,
  maxWinStreak: 0,
  ringOutsInflicted: 0,
  ringOutsSuffered: 0,
  powerUpsCollected: 0,
  powerUpTypesUsed: [],
  mapsPlayed: [],
  p2GamesPlayed: 0,
  achievements: [],
};

const STORAGE_KEY = "arena-slaps:profile";

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

/**
 * Apply defaults to a partially-loaded profile. Old persisted profiles that
 * pre-date the achievements system will be missing fields like
 * `currentWinStreak`, `powerUpTypesUsed`, etc. — fill them in so the rest of
 * the app can assume the full {@link Profile} shape.
 */
export function migrateProfile(input: Partial<Profile> | null | undefined): Profile {
  if (!input) {
    return { ...DEFAULT_PROFILE };
  }
  const base: Profile = { ...DEFAULT_PROFILE };
  // Spread known numeric defaults then override with whatever was persisted.
  const out: Profile = {
    ...base,
    ...input,
  };
  // Arrays: if missing or wrong type, fall back to defaults. (Spread above
  // would copy a non-array through, so we re-coerce here.)
  if (!Array.isArray(out.achievements)) {
    out.achievements = [];
  }
  if (!Array.isArray(out.powerUpTypesUsed)) {
    out.powerUpTypesUsed = [];
  }
  if (!Array.isArray(out.mapsPlayed)) {
    out.mapsPlayed = [];
  }
  // Numeric coercion: if the persisted value was a string or null, fall back.
  for (const key of [
    "totalGames",
    "wins",
    "losses",
    "draws",
    "xp",
    "level",
    "currentWinStreak",
    "maxWinStreak",
    "ringOutsInflicted",
    "ringOutsSuffered",
    "powerUpsCollected",
    "p2GamesPlayed",
  ] as const) {
    if (typeof out[key] !== "number" || Number.isNaN(out[key])) {
      out[key] = base[key];
    }
  }
  return out;
}

/** Load the profile from localStorage (or return defaults if not stored). */
export function loadProfile(
  storage: StorageLike | null | undefined,
): Profile {
  if (!storage) {
    return { ...DEFAULT_PROFILE };
  }
  const raw = storage.getItem?.(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PROFILE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return migrateProfile(parsed);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

/** Persist the profile to localStorage. No-op if storage is unavailable. */
export function saveProfile(
  storage: StorageLike,
  profile: Profile,
): void {
  storage.setItem?.(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Reset the player's transient stats (games, wins, streaks, ring-outs, etc.)
 * but KEEP unlocked achievements — achievements are permanent career records
 * and shouldn't be wiped just because the player wanted to reset their stats.
 */
export function resetProfileStats(profile: Profile): Profile {
  return {
    ...DEFAULT_PROFILE,
    achievements: [...profile.achievements],
    powerUpTypesUsed: [...profile.powerUpTypesUsed],
    mapsPlayed: [...profile.mapsPlayed],
  };
}
