export type GameMode = "1p-vs-bot" | "2p-local";

export type Profile = {
  nickname: string;
  avatar: "player-idle"; // only one option for now
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  ringOutsInflicted: number;
  ringOutsSuffered: number;
  powerUpsCollected: number;
  powerUpStats: Record<string, number>; // by power-up type
  favoriteMode: GameMode;
  createdAt: number; // set on first creation
  lastPlayedAt: number;
  xp: number; // total XP accumulated across all games
  level: number; // current progression level (1..MAX_LEVEL)
};

export const DEFAULT_PROFILE: Profile = {
  nickname: "Player",
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
};

const STORAGE_KEY = "arena-slaps:profile";

const MODE_VALUES: readonly GameMode[] = ["1p-vs-bot", "2p-local"];

export type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

function isGameMode(value: unknown): value is GameMode {
  return (
    typeof value === "string" &&
    (MODE_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Returns a fresh copy of {@link DEFAULT_PROFILE} with its own
 * `powerUpStats` object so callers can mutate the result without affecting
 * the shared default.
 */
function freshDefault(): Profile {
  return { ...DEFAULT_PROFILE, powerUpStats: {} };
}

/**
 * Merge a parsed stored profile over {@link DEFAULT_PROFILE}. Missing or
 * type-mismatched fields fall back to the defaults so that older persisted
 * payloads (or partial / corrupt writes) are migrated forward gracefully.
 *
 * `powerUpStats` is rebuilt entry-by-entry — only string keys with numeric
 * values survive — so the returned profile always owns a fresh object.
 */
function migrateProfile(parsed: Record<string, unknown>): Profile {
  const base = freshDefault();

  if (typeof parsed.nickname === "string") {
    base.nickname = parsed.nickname;
  }
  if (parsed.avatar === "player-idle") {
    base.avatar = "player-idle";
  }
  if (typeof parsed.totalGames === "number") {
    base.totalGames = parsed.totalGames;
  }
  if (typeof parsed.wins === "number") {
    base.wins = parsed.wins;
  }
  if (typeof parsed.losses === "number") {
    base.losses = parsed.losses;
  }
  if (typeof parsed.draws === "number") {
    base.draws = parsed.draws;
  }
  if (typeof parsed.ringOutsInflicted === "number") {
    base.ringOutsInflicted = parsed.ringOutsInflicted;
  }
  if (typeof parsed.ringOutsSuffered === "number") {
    base.ringOutsSuffered = parsed.ringOutsSuffered;
  }
  if (typeof parsed.powerUpsCollected === "number") {
    base.powerUpsCollected = parsed.powerUpsCollected;
  }
  if (parsed.powerUpStats && typeof parsed.powerUpStats === "object") {
    const stats = parsed.powerUpStats as Record<string, unknown>;
    const cleaned: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === "number") {
        cleaned[key] = value;
      }
    }
    base.powerUpStats = cleaned;
  }
  if (isGameMode(parsed.favoriteMode)) {
    base.favoriteMode = parsed.favoriteMode;
  }
  if (typeof parsed.createdAt === "number") {
    base.createdAt = parsed.createdAt;
  }
  if (typeof parsed.lastPlayedAt === "number") {
    base.lastPlayedAt = parsed.lastPlayedAt;
  }
  if (typeof parsed.xp === "number" && Number.isFinite(parsed.xp)) {
    base.xp = Math.max(0, parsed.xp);
  }
  if (
    typeof parsed.level === "number" &&
    Number.isFinite(parsed.level) &&
    Number.isInteger(parsed.level)
  ) {
    base.level = Math.max(1, Math.floor(parsed.level));
  }

  return base;
}

/**
 * Load a {@link Profile} from the supplied storage. Returns a fresh
 * {@link DEFAULT_PROFILE} (with its own `powerUpStats` object) when:
 *   - storage is null/undefined (no persistence layer available),
 *   - storage has no entry under {@link STORAGE_KEY},
 *   - the stored JSON is corrupt / unparseable,
 *   - the stored payload is partial — missing fields fall back to defaults.
 */
export function loadProfile(
  storage: StorageLike | null | undefined,
): Profile {
  if (!storage) {
    return freshDefault();
  }

  const raw = storage.getItem?.(STORAGE_KEY);

  if (!raw) {
    return freshDefault();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateProfile(parsed);
  } catch {
    return freshDefault();
  }
}

/**
 * Serialize {@link profile} to JSON and persist it via `storage.setItem`.
 * Mirrors the {@link loadProfile} storage key so the two stay in sync.
 */
export function saveProfile(storage: StorageLike, profile: Profile): void {
  storage.setItem?.(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Returns a fresh {@link DEFAULT_PROFILE} with `createdAt` set to the current
 * time. Used the first time a player launches the game (or after a full wipe).
 */
export function createDefaultProfile(): Profile {
  return {
    ...DEFAULT_PROFILE,
    powerUpStats: {},
    createdAt: Date.now(),
  };
}

/**
 * Returns a NEW profile with all gameplay stats zeroed. Preserves the
 * player's identity fields (`nickname`, `avatar`, `createdAt`) — `createdAt`
 * reflects when the profile was first created, not when stats were last
 * reset, so it survives a stats wipe. Progression fields (`xp`, `level`) are
 * also preserved — a stats reset only wipes per-game counters, not the
 * player's long-term level progression. Does NOT mutate the input.
 */
export function resetProfileStats(profile: Profile): Profile {
  return {
    ...DEFAULT_PROFILE,
    powerUpStats: {},
    nickname: profile.nickname,
    avatar: profile.avatar,
    createdAt: profile.createdAt,
    xp: profile.xp,
    level: profile.level,
  };
}
