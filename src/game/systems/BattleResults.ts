import type { RoundWinner } from "./ScoringSystem";

export type BattleResults = {
  botScore: number;
  finishedAt: number;
  playerScore: number;
  powerUpsCollected: {
    bot: number;
    player: number;
  };
  roundsPlayed: number;
  winner: RoundWinner;
};

type StorageLike = {
  getItem?: (key: string) => string | null;
  get?: (key: string) => string | undefined;
  setItem?: (key: string, value: string) => void;
  set?: (key: string, value: string) => unknown;
};

const storageKey = "arena-slaps:last-results";

export function createBattleResults(input: {
  botScore: number;
  finishedAt?: number;
  playerScore: number;
  powerUpsCollected: BattleResults["powerUpsCollected"];
  roundsPlayed: number;
  winner: RoundWinner;
}): BattleResults {
  return {
    botScore: input.botScore,
    finishedAt: input.finishedAt ?? Date.now(),
    playerScore: input.playerScore,
    powerUpsCollected: input.powerUpsCollected,
    roundsPlayed: input.roundsPlayed,
    winner: input.winner,
  };
}

export function createBattleResultsSummary(results: BattleResults): string[] {
  return [
    results.winner === "draw"
      ? "Draw"
      : results.winner === "player"
        ? "Player wins"
        : "Bot wins",
    `Score ${results.playerScore} - ${results.botScore}`,
    `Rounds ${results.roundsPlayed}`,
    `Power-ups ${results.powerUpsCollected.player} / ${results.powerUpsCollected.bot}`,
  ];
}

export function saveBattleResults(
  storage: StorageLike,
  results: BattleResults,
): void {
  const payload = JSON.stringify(results);

  if (storage.setItem) {
    storage.setItem(storageKey, payload);
    return;
  }

  storage.set?.(storageKey, payload);
}

export function loadBattleResults(storage: StorageLike): BattleResults | null {
  const raw = storage.getItem?.(storageKey) ?? storage.get?.(storageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BattleResults;
  } catch {
    return null;
  }
}
