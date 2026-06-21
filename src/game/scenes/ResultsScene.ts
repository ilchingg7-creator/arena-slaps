import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";

/**
 * Results scene — shows the winner, score, rounds played, and power-ups
 * collected from the last battle (loaded from localStorage). A "Back to
 * menu" button returns to the MainMenuScene.
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const results =
      typeof window !== "undefined"
        ? loadBattleResults(window.localStorage)
        : null;
    const summary = results
      ? createBattleResultsSummary(results)
      : ["No result stored yet."];

    // --- Background (arena-bg.png — same cosmic sky as the battle) ---
    createBackground(this as unknown as Phaser.Scene, { key: "arena-bg" });

    this.add
      .text(width / 2, height * 0.24, "Match Results", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "52px",
      })
      .setOrigin(0.5);

    summary.forEach((line, index) => {
      this.add
        .text(width / 2, height * 0.42 + index * 42, line, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "24px",
        })
        .setOrigin(0.5);
    });

    const goMenu = () => {
      this.scene.start("MainMenuScene");
    };

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.74,
      text: "Back to menu",
      variant: "primary",
      onClick: goMenu,
    });

    this.input.keyboard?.on("keydown-ENTER", goMenu);
  }
}
