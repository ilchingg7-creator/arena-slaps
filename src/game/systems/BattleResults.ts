import type { GameMode } from "../config/gameSettings";
import type { RoundWinner } from "./ScoringSystem";

export type BattleResults = {
  botScore: number;
  finishedAt: number;
  mode: GameMode;
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
  mode?: GameMode;
  playerScore: number;
  powerUpsCollected: BattleResults["powerUpsCollected"];
  roundsPlayed: number;
  winner: RoundWinner;
}): BattleResults {
  return {
    botScore: input.botScore,
    finishedAt: input.finishedAt ?? Date.now(),
    mode: input.mode ?? "1p-vs-bot",
    playerScore: input.playerScore,
    powerUpsCollected: input.powerUpsCollected,
    roundsPlayed: input.roundsPlayed,
    winner: input.winner,
  };
}

function opponentLabel(mode: GameMode): string {
  return mode === "2p-local" ? "P2" : "Bot";
}

function playerLabel(mode: GameMode): string {
  return mode === "2p-local" ? "P1" : "Player";
}

export function createBattleResultsSummary(results: BattleResults): string[] {
  const p1 = playerLabel(results.mode);
  const p2 = opponentLabel(results.mode);

  const winnerLine =
    results.winner === "draw"
      ? "Draw"
      : results.winner === "player"
        ? `${p1} wins`
        : `${p2} wins`;

  return [
    winnerLine,
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
