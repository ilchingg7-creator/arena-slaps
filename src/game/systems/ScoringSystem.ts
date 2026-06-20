export type ScoreState = {
  player: number;
  bots: number;
};

export type ScoringSide = keyof ScoreState;
export type RoundWinner = ScoringSide | "draw";

export function createScoreState(): ScoreState {
  return {
    player: 0,
    bots: 0,
  };
}

export function awardPoint(score: ScoreState, side: ScoringSide): void {
  score[side] += 1;
}

export function resolveWinner(score: ScoreState): RoundWinner {
  if (score.player === score.bots) {
    return "draw";
  }

  return score.player > score.bots ? "player" : "bots";
}
