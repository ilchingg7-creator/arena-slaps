import {
  awardPoint,
  createScoreState,
  resolveWinner,
  type RoundWinner,
  type ScoreState,
  type ScoringSide,
} from "./ScoringSystem";

export type RoundState = {
  isComplete: boolean;
  timeLeft: number;
  score: ScoreState;
  winner: RoundWinner | null;
};

export function createRoundState(totalTime: number): RoundState {
  return {
    isComplete: false,
    timeLeft: totalTime,
    score: createScoreState(),
    winner: null,
  };
}

export function advanceRoundState(
  round: RoundState,
  deltaSeconds: number,
  winningScore: number,
): void {
  if (round.isComplete) {
    return;
  }

  round.timeLeft = Math.max(0, round.timeLeft - deltaSeconds);

  if (round.timeLeft === 0) {
    round.isComplete = true;
    round.winner = resolveWinner(round.score);
    return;
  }

  if (
    round.score.player >= winningScore ||
    round.score.bots >= winningScore
  ) {
    round.isComplete = true;
    round.winner = resolveWinner(round.score);
  }
}

export function registerPoint(
  round: RoundState,
  side: ScoringSide,
  winningScore: number,
): void {
  if (round.isComplete) {
    return;
  }

  awardPoint(round.score, side);

  if (
    round.score.player >= winningScore ||
    round.score.bots >= winningScore
  ) {
    round.isComplete = true;
    round.winner = resolveWinner(round.score);
  }
}
