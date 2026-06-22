export type GameMode = "1p-vs-bot" | "2p-local";
export type BotDifficulty = "easy" | "medium" | "hard";

export type GameSettings = {
  mode: GameMode;
  botDifficulty: BotDifficulty;
  roundLengthSeconds: number;
  winningScore: number;
  sfxMuted: boolean;
  musicMuted: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
};

export const DEFAULT_SETTINGS: GameSettings = {
  mode: "1p-vs-bot",
  botDifficulty: "medium",
  roundLengthSeconds: 60,
  winningScore: 5,
  sfxMuted: false,
  musicMuted: false,
  sfxVolume: 0.7,
  musicVolume: 0.5,
};

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

const storageKey = "arena-slaps:settings";

/**
 * Legacy shape persisted by older versions of the game. Used by
 * {@link loadSettings} to migrate existing users forward.
 */
type LegacySettings = {
  muted?: boolean;
  masterVolume?: number;
};

/**
 * Parse and migrate a stored settings JSON blob into the current
 * {@link GameSettings} shape.
 *
 * Migration rules:
 *   - If the payload already has the new `sfxMuted` / `musicMuted` /
 *     `sfxVolume` / `musicVolume` fields, use them as-is (drop legacy).
 *   - Otherwise, if legacy `muted` / `masterVolume` are present, map them:
 *       `muted: true`  -> `sfxMuted: true, musicMuted: true`
 *       `masterVolume: X` -> `sfxVolume: X, musicVolume: X`
 *   - Anything missing falls back to {@link DEFAULT_SETTINGS}.
 */
function migrateSettings(parsed: Record<string, unknown>): GameSettings {
  const base: GameSettings = { ...DEFAULT_SETTINGS };

  const hasNewFields =
    "sfxMuted" in parsed ||
    "musicMuted" in parsed ||
    "sfxVolume" in parsed ||
    "musicVolume" in parsed;

  const legacy = parsed as unknown as LegacySettings;

  // Non-audio settings always come through directly.
  if (typeof parsed.mode === "string") {
    base.mode = parsed.mode as GameMode;
  }
  if (typeof parsed.botDifficulty === "string") {
    base.botDifficulty = parsed.botDifficulty as BotDifficulty;
  }
  if (typeof parsed.roundLengthSeconds === "number") {
    base.roundLengthSeconds = parsed.roundLengthSeconds;
  }
  if (typeof parsed.winningScore === "number") {
    base.winningScore = parsed.winningScore;
  }

  if (hasNewFields) {
    if (typeof parsed.sfxMuted === "boolean") base.sfxMuted = parsed.sfxMuted;
    if (typeof parsed.musicMuted === "boolean")
      base.musicMuted = parsed.musicMuted;
    if (typeof parsed.sfxVolume === "number") base.sfxVolume = parsed.sfxVolume;
    if (typeof parsed.musicVolume === "number")
      base.musicVolume = parsed.musicVolume;
  } else if (legacy) {
    // Migrate legacy fields when no new fields are present.
    if (typeof legacy.muted === "boolean") {
      base.sfxMuted = legacy.muted;
      base.musicMuted = legacy.muted;
    }
    if (typeof legacy.masterVolume === "number") {
      base.sfxVolume = legacy.masterVolume;
      base.musicVolume = legacy.masterVolume;
    }
  }

  return base;
}

export function loadSettings(
  storage: StorageLike | null | undefined,
): GameSettings {
  if (!storage) {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = storage.getItem?.(storageKey);

  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  storage: StorageLike,
  settings: GameSettings,
): void {
  storage.setItem?.(storageKey, JSON.stringify(settings));
}

export const ROUND_LENGTH_OPTIONS = [30, 60, 90, 120] as const;
export const WINNING_SCORE_OPTIONS = [3, 5, 7, 10] as const;
export const BOT_DIFFICULTY_OPTIONS: readonly BotDifficulty[] = [
  "easy",
  "medium",
  "hard",
];
export const MODE_OPTIONS: readonly GameMode[] = ["1p-vs-bot", "2p-local"];

export function cycleOption<T extends string | number>(
  options: readonly T[],
  current: T,
): T {
  const idx = options.indexOf(current);

  if (idx === -1) {
    return options[0];
  }

  return options[(idx + 1) % options.length];
}

export function describeMode(mode: GameMode): string {
  return mode === "1p-vs-bot" ? "1P vs Bot" : "2P Local";
}

export function describeDifficulty(difficulty: BotDifficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function describeVolume(volume: number): string {
  return `${Math.round(volume * 100)}%`;
}
