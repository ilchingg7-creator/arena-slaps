import { describe, expect, it } from "vitest";
import {
  createBattleResults,
  createBattleResultsSummary,
  loadBattleResults,
  saveBattleResults,
} from "./BattleResults";

describe("BattleResults", () => {
  it("serializes and restores battle results", () => {
    const storage = new Map<string, string>();
    const results = createBattleResults({
      playerScore: 3,
      botScore: 1,
      winner: "player",
      roundsPlayed: 1,
      powerUpsCollected: { player: 2, bot: 0 },
    });

    saveBattleResults(storage, results);

    expect(loadBattleResults(storage)).toEqual(results);
  });

  it("formats a readable results summary", () => {
    expect(
      createBattleResultsSummary(
        createBattleResults({
          playerScore: 2,
          botScore: 2,
          winner: "draw",
          roundsPlayed: 1,
          powerUpsCollected: { player: 1, bot: 1 },
        }),
      ),
    ).toEqual([
      "Draw",
      "Score 2 - 2",
      "Rounds 1",
      "Power-ups 1 / 1",
    ]);
  });

  it("uses P1/P2 labels in 2P-local mode", () => {
    const summary = createBattleResultsSummary(
      createBattleResults({
        mode: "2p-local",
        playerScore: 5,
        botScore: 3,
        winner: "bots",
        roundsPlayed: 1,
        powerUpsCollected: { player: 2, bot: 1 },
      }),
    );
    expect(summary[0]).toBe("P2 wins");
    expect(summary[1]).toBe("Score 5 - 3");
  });

  it("uses Player/Bot labels in 1P-vs-bot mode", () => {
    const summary = createBattleResultsSummary(
      createBattleResults({
        mode: "1p-vs-bot",
        playerScore: 5,
        botScore: 3,
        winner: "player",
        roundsPlayed: 1,
        powerUpsCollected: { player: 2, bot: 1 },
      }),
    );
    expect(summary[0]).toBe("Player wins");
  });
});
