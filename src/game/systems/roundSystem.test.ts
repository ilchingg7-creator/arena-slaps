import { describe, expect, it } from "vitest";
import { advanceRoundState, createRoundState, registerPoint } from "./RoundSystem";

describe("createRoundState", () => {
  it("initializes a round with countdown and zero score", () => {
    const round = createRoundState(60);

    expect(round.timeLeft).toBe(60);
    expect(round.score.player).toBe(0);
    expect(round.score.bots).toBe(0);
  });

  it("counts down and ends the round when time expires", () => {
    const round = createRoundState(3);

    advanceRoundState(round, 3.5, 5);

    expect(round.timeLeft).toBe(0);
    expect(round.isComplete).toBe(true);
    expect(round.winner).toBe("draw");
  });

  it("awards points and ends early when someone reaches the winning score", () => {
    const round = createRoundState(60);

    registerPoint(round, "player", 1);

    expect(round.score.player).toBe(1);
    expect(round.isComplete).toBe(true);
    expect(round.winner).toBe("player");
  });
});
