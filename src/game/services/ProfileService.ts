import type { GameMode, Profile } from "../config/profile";

export type GameResult = {
  mode: GameMode;
  outcome: "win" | "loss" | "draw";
  ringOutsInflicted: number;
  ringOutsSuffered: number;
  powerUpsCollected: number;
  powerUpTypes: string[]; // one entry per power-up collected
};

const MODE_VALUES: readonly GameMode[] = ["1p-vs-bot", "2p-local"];

/**
 * In-memory wrapper around a {@link Profile} that owns the mutation logic for
 * recording game results and deriving aggregate stats (win rate, favorite
 * power-up, favorite mode).
 *
 * The service keeps its own private copy of the profile so callers can't
 * mutate the persisted state by holding on to a reference. Getters return
 * fresh copies for the same reason.
 *
 * Per-mode game counts are tracked in memory because the persisted Profile
 * only stores the current `favoriteMode`. On construction we attribute all
 * prior games to that mode — going forward each recorded game increments its
 * own mode's counter and the favorite is recomputed (ties keep the current
 * favorite, so the value is stable across equal-count flips).
 */
export class ProfileService {
  private profile: Profile;
  private modeCounts: Record<GameMode, number>;

  constructor(profile: Profile) {
    this.profile = {
      ...profile,
      powerUpStats: { ...profile.powerUpStats },
    };
    this.modeCounts = { "1p-vs-bot": 0, "2p-local": 0 };
    if (this.profile.totalGames > 0) {
      this.modeCounts[this.profile.favoriteMode] = this.profile.totalGames;
    }
  }

  /** Returns a deep-enough copy: a new Profile object with its own powerUpStats. */
  getProfile(): Profile {
    return {
      ...this.profile,
      powerUpStats: { ...this.profile.powerUpStats },
    };
  }

  setNickname(name: string): void {
    this.profile.nickname = name;
  }

  recordGameResult(result: GameResult): void {
    this.profile.totalGames += 1;

    if (result.outcome === "win") {
      this.profile.wins += 1;
    } else if (result.outcome === "loss") {
      this.profile.losses += 1;
    } else {
      this.profile.draws += 1;
    }

    this.profile.ringOutsInflicted += result.ringOutsInflicted;
    this.profile.ringOutsSuffered += result.ringOutsSuffered;
    this.profile.powerUpsCollected += result.powerUpsCollected;

    for (const type of result.powerUpTypes) {
      this.profile.powerUpStats[type] =
        (this.profile.powerUpStats[type] ?? 0) + 1;
    }

    this.profile.lastPlayedAt = Date.now();

    this.modeCounts[result.mode] += 1;
    this.profile.favoriteMode = this.computeFavoriteMode();
  }

  /**
   * Returns the highest-count mode, breaking ties in favor of the current
   * `favoriteMode` so the value stays stable when counts are equal.
   */
  private computeFavoriteMode(): GameMode {
    let best: GameMode = this.profile.favoriteMode;
    let bestCount = this.modeCounts[best];
    for (const mode of MODE_VALUES) {
      const count = this.modeCounts[mode];
      if (count > bestCount) {
        best = mode;
        bestCount = count;
      }
    }
    return best;
  }

  /** Win rate as a 0..1 fraction. Returns 0 when no games have been played. */
  getWinRate(): number {
    if (this.profile.totalGames === 0) {
      return 0;
    }
    return this.profile.wins / this.profile.totalGames;
  }

  getTotalGames(): number {
    return this.profile.totalGames;
  }

  /**
   * Returns the most-collected power-up type, or `null` when no power-ups
   * have been collected yet. Ties resolve to the first-inserted type
   * (deterministic via `Object.entries` iteration order).
   */
  getFavoritePowerUp(): string | null {
    const stats = this.profile.powerUpStats;
    let best: string | null = null;
    let bestCount = 0;
    for (const [type, count] of Object.entries(stats)) {
      if (count > bestCount) {
        best = type;
        bestCount = count;
      }
    }
    return best;
  }

  /** Returns the mode with the most games played (kept in sync on each game). */
  getFavoriteMode(): GameMode {
    return this.profile.favoriteMode;
  }
}
