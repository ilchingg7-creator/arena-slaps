import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import { YandexSDK } from "../yandex/SDK";
import { loadProfile, saveProfile } from "../config/profile";
import { formatResultsSummary } from "../ui/formatResultsSummary";
import {
  createAchievementNotification,
  type AchievementNotification,
} from "../ui/AchievementNotification";
import { getAchievementById } from "../config/achievements";
import type { BattleEndOutput } from "../services/processBattleEnd";
import { applyRewardedXp } from "../services/applyRewardedXp";

/**
 * Results scene — shows the winner, score, rounds played, and power-ups
 * collected from the last battle (loaded from localStorage).
 *
 * Also displays the end-of-battle pipeline output (XP gained, current
 * level, level-up + new unlocks, achievement notifications) when the
 * previous battle was 1P-vs-bot. The output is stashed in the Phaser
 * registry under the `"lastBattleEnd"` key by BattleScene's round-
 * complete block.
 *
 * Features:
 * - "×2 XP" rewarded ad button (Rule 4.5: rewarded ads are optional)
 * - "Back to menu" button
 * - Menu-theme music
 * - Slide-in achievement notification popups for each newly-unlocked
 *   achievement (queued if multiple were unlocked by the same battle).
 */
export class ResultsScene extends Phaser.Scene {
  private notification: AchievementNotification | null = null;

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
      .text(width / 2, height * 0.13, i18n.t("results.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "46px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
      })
      .setOrigin(0.5);

    // --- Summary lines (score / rounds / power-ups) ---
    summary.forEach((line, index) => {
      this.add
        .text(width / 2, height * 0.24 + index * 32, line, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
          stroke: "#000000",
          strokeThickness: 3,
          shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 3, fill: true },
        })
        .setOrigin(0.5);
    });

    // --- End-of-battle pipeline output (XP / level / achievements) ---
    // BattleScene stashes the `BattleEndOutput` in the registry under
    // `lastBattleEnd`. It's null in 2P-local mode or when no profile data
    // could be derived.
    const battleEnd = this.registry.get("lastBattleEnd") as
      | BattleEndOutput
      | null
      | undefined;

    const endLines = formatResultsSummary({
      battleEnd: battleEnd ?? null,
      t: (key, fallback) => {
        try {
          return i18n.t(key as never);
        } catch {
          return fallback;
        }
      },
    });

    // Render the end-of-battle lines below the score summary. Use a
    // tinted background so the XP / level / achievement block is visually
    // distinct from the score block.
    const endLinesY = height * 0.24 + summary.length * 32 + 28;
    if (endLines.length > 0) {
      const blockH = endLines.length * 28 + 16;
      this.add
        .rectangle(width / 2, endLinesY + blockH / 2 - 8, width * 0.7, blockH, 0x000000, 0.35)
        .setOrigin(0.5);
      endLines.forEach((line, index) => {
        const isAchievement = line.startsWith(
          i18n.t("results.achievementUnlocked"),
        );
        const isLevelUp = line.startsWith(i18n.t("results.levelUp"));
        this.add
          .text(width / 2, endLinesY + index * 28, line, {
            color: isAchievement
              ? "#f4d35e"
              : isLevelUp
                ? "#81b29a"
                : "#f4f1de",
            fontFamily: "Arial",
            fontSize: isAchievement || isLevelUp ? "20px" : "18px",
            fontStyle: isAchievement || isLevelUp ? "bold" : "normal",
            stroke: "#000000",
            strokeThickness: 3,
            shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 2, fill: true },
          })
          .setOrigin(0.5);
      });
    }

    // --- Achievement notifications (slide-in popups) ---
    // Wire up the notification system and queue every newly-unlocked
    // achievement. The AchievementNotification component handles the
    // queue internally — calling `show()` while a popup is on screen
    // defers the new one until the current one finishes.
    this.notification = createAchievementNotification(
      this as unknown as Parameters<typeof createAchievementNotification>[0],
    );
    if (battleEnd && battleEnd.newlyUnlocked.length > 0) {
      for (const id of battleEnd.newlyUnlocked) {
        const def = getAchievementById(id);
        if (!def) continue;
        const name = (() => {
          try {
            return i18n.t(def.nameKey as never);
          } catch {
            return id;
          }
        })();
        this.notification.show(def.icon, name);
      }
    }

    // --- ×2 XP Rewarded Ad button ---
    // Rule 4.5: rewarded advertising is optional and grants the stated reward.
    // Rule 4.5.1: UI clearly explains both viewing and reward.
    // Rule 4.5.2: the rewarded bonus is not required to continue.
    // Only show if the player actually earned XP (1P vs bot mode) AND
    // has not already doubled (Bug 3a: previously the local `doubledXP`
    // flag was reset on `scene.restart()`, allowing infinite re-press).
    // The `xpDoubled` flag lives on `battleEnd` in the Phaser registry,
    // which survives `scene.restart()` of this same scene.
    const xpAlreadyDoubled = battleEnd?.xpDoubled === true;
    const showRewardedButton =
      results?.mode === "1p-vs-bot" &&
      YandexSDK.isAvailable() &&
      !xpAlreadyDoubled;

    // Compute the back-button Y based on whether the rewarded-ad button
    // is visible AND whether the end-of-battle block pushed lines down.
    const bottomButtonsY = endLines.length > 0
      ? endLinesY + endLines.length * 28 + 60
      : height * 0.74;

    if (showRewardedButton) {
      createStyledButton(
        this as unknown as Parameters<typeof createStyledButton>[0],
        {
          x: width / 2,
          y: bottomButtonsY,
          text: i18n.t("results.doubleXp"),
          variant: "warning",
          width: 280,
          height: 48,
          fontSize: 18,
          onClick: () => {
            audio.playMenuClick();
            YandexSDK.showRewardedAd(
              () => {
                // onRewarded — grant the SECOND half of the ×2 XP bonus.
                // Bug 7 fix: use the pure `applyRewardedXp` helper instead
                // of calling ProgressionService.applyXp directly. The
                // helper recalculates levelUp + newlyUnlocked (including
                // level_5 / level_10 achievements) so the player sees the
                // "Level up!" banner and achievement notifications if the
                // rewarded XP crossed a level boundary.
                if (!storage || !battleEnd) return;
                try {
                  const profile = loadProfile(storage);
                  const { updatedProfile, updatedBattleEnd } =
                    applyRewardedXp(battleEnd, profile);
                  saveProfile(storage, updatedProfile);
                  // Write the updated battle end (with new levelUp +
                  // newlyUnlocked + xpDoubled=true) to the registry so
                  // the restarted scene shows the level-up banner,
                  // achievement notifications, and hides the ×2 XP button.
                  this.registry.set("lastBattleEnd", updatedBattleEnd);
                  // Restart scene to show updated state.
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

    const backButtonY = showRewardedButton
      ? bottomButtonsY + 70
      : bottomButtonsY;
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

  shutdown(): void {
    if (this.notification) {
      this.notification.destroy();
      this.notification = null;
    }
  }
}
