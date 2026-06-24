import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import { YandexSDK } from "../yandex/SDK";
import { loadProfile, saveProfile } from "../config/profile";
import { ProgressionService } from "../services/ProgressionService";

/**
 * Results scene — shows the winner, score, rounds played, and power-ups
 * collected from the last battle (loaded from localStorage).
 *
 * Features:
 * - "×2 XP" rewarded ad button (Rule 4.5: rewarded ads are optional)
 * - "Back to menu" button
 * - Menu-theme music
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
    const audio = getAudioService(this, settings);
    audio.playMenuTheme();
    const results = storage ? loadBattleResults(storage) : null;
    const summary = results
      ? createBattleResultsSummary(results, (key) => i18n.t(key as never))
      : [i18n.t("results.noResult")];

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "arena-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.20, i18n.t("results.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "52px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
      })
      .setOrigin(0.5);

    // --- Summary lines ---
    summary.forEach((line, index) => {
      this.add
        .text(width / 2, height * 0.36 + index * 38, line, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "22px",
          stroke: "#000000",
          strokeThickness: 3,
          shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 3, fill: true },
        })
        .setOrigin(0.5);
    });

    // --- ×2 XP Rewarded Ad button ---
    // Rule 4.5: rewarded advertising is optional and grants the stated reward.
    // Rule 4.5.1: UI clearly explains both viewing and reward.
    // Rule 4.5.2: the rewarded bonus is not required to continue.
    // Only show if the player actually earned XP (1P vs bot mode).
    const showRewardedButton =
      results?.mode === "1p-vs-bot" && YandexSDK.isAvailable();

    let doubledXP = false;

    if (showRewardedButton) {
      createStyledButton(
        this as unknown as Parameters<typeof createStyledButton>[0],
        {
          x: width / 2,
          y: height * 0.64,
          text: i18n.t("results.doubleXp"),
          variant: "warning",
          width: 280,
          height: 48,
          fontSize: 18,
          onClick: () => {
            if (doubledXP) return; // prevent double-click
            audio.playMenuClick();
            YandexSDK.showRewardedAd(
              () => {
                // onRewarded — double the last game's XP
                if (!storage) return;
                try {
                  const profile = loadProfile(storage);
                  // Recalculate XP from the last result (same formula as
                  // BattleScene's round-complete block). We can't read the
                  // exact XP gained because it was already applied — so we
                  // grant a bonus equal to the base XP (win=100, loss=30,
                  // draw=50) as a "double" approximation.
                  const outcome = results?.winner === "player" ? "win"
                    : results?.winner === "bots" ? "loss" : "draw";
                  const baseXp = outcome === "win" ? 100
                    : outcome === "loss" ? 30 : 50;
                  const { profile: updated } = ProgressionService.applyXp(profile, baseXp);
                  saveProfile(storage, updated);
                  doubledXP = true;
                  // Restart scene to show updated state
                  this.scene.restart();
                } catch {
                  // Non-critical
                }
              },
              () => {
                // onClose — ad closed without reward
              },
            );
          },
        },
      );
    }

    // --- Back to menu ---
    const goMenu = () => {
      this.scene.start("MainMenuScene");
    };

    const backButtonY = showRewardedButton ? height * 0.78 : height * 0.74;
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: backButtonY,
        text: i18n.t("results.back"),
        variant: "primary",
        onClick: goMenu,
      },
    );

    this.input.keyboard?.on("keydown-ENTER", goMenu);
  }
}
