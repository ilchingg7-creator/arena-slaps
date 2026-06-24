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

export type Translator = (key: string) => string;

export function createBattleResultsSummary(
  results: BattleResults,
  t?: Translator,
): string[] {
  const tr = (key: string, fallback: string) => t ? t(key) : fallback;
  const p1 = results.mode === "2p-local"
    ? tr("battle.p1", "P1")
    : tr("battle.player", "Player");
  const p2 = results.mode === "2p-local"
    ? tr("battle.p2", "P2")
    : tr("battle.bot", "Bot");

  const winnerLine =
    results.winner === "draw"
      ? tr("battle.draw", "Draw")
      : results.winner === "player"
        ? `${p1} ${tr("results.wins", "wins")}`
        : `${p2} ${tr("results.wins", "wins")}`;

  return [
    winnerLine,
    `${tr("results.score", "Score")} ${results.playerScore} - ${results.botScore}`,
    `${tr("results.rounds", "Rounds")} ${results.roundsPlayed}`,
    `${tr("results.powerUps", "Power-ups")} ${results.powerUpsCollected.player} / ${results.powerUpsCollected.bot}`,
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
