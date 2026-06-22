import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";

/**
 * Results scene — shows the winner, score, rounds played, and power-ups
 * collected from the last battle (loaded from localStorage). A "Back to
 * menu" button returns to the MainMenuScene.
 *
 * M5: the BattleScene stops the battle-theme music before transitioning
 * here, so without this scene starting its own track the results screen
 * would be silent. The menu-theme fits the "post-battle lobby" feel of
 * the results screen and is also what every other menu-style scene
 * (MainMenu, AudioSettings, Profile) plays, so the audio continuity is
 * preserved across the whole navigation flow.
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage =
      typeof window !== "undefined" ? window.localStorage : null;
    const i18n = I18nService.load(storage);
    const settings = loadSettings(storage);
    // M5: start the menu-theme music on the shared AudioService so the
    // results screen isn't silent. `getAudioService` reuses the same
    // singleton the BattleScene was using, so the music volume respects
    // whatever the player set in the AudioSettings scene.
    const audio = getAudioService(this, settings);
    audio.playMenuTheme();
    const results = storage ? loadBattleResults(storage) : null;
    const summary = results
      ? createBattleResultsSummary(results)
      : [i18n.t("results.noResult")];

    // --- Background (arena-bg.png — same cosmic sky as the battle) ---
    createBackground(this as unknown as Phaser.Scene, { key: "arena-bg" });

    this.add
      .text(width / 2, height * 0.24, i18n.t("results.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "52px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
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
      text: i18n.t("results.back"),
      variant: "primary",
      onClick: goMenu,
    });

    this.input.keyboard?.on("keydown-ENTER", goMenu);
  }
}
