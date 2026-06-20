export type GameMode = "1p-vs-bot" | "2p-local";
export type BotDifficulty = "easy" | "medium" | "hard";

export type GameSettings = {
  mode: GameMode;
  botDifficulty: BotDifficulty;
  roundLengthSeconds: number;
  winningScore: number;
  muted: boolean;
  masterVolume: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  mode: "1p-vs-bot",
  botDifficulty: "medium",
  roundLengthSeconds: 60,
  winningScore: 5,
  muted: false,
  masterVolume: 0.7,
};

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

const storageKey = "arena-slaps:settings";

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
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
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
export const MASTER_VOLUME_OPTIONS = [0, 0.25, 0.5, 0.7, 1] as const;

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
