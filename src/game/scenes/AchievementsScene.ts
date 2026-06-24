import Phaser from "phaser";
import {
  ACHIEVEMENTS,
  getAchievementById,
  getAchievementsByCategory,
  type AchievementCategory,
} from "../config/achievements";
import { loadProfile } from "../config/profile";
import { createBackground } from "../ui/Background";
import { createStyledButton } from "../ui/StyledButton";
import { I18nService } from "../i18n/I18nService";

/**
 * Achievements scene — shows a grid of all 18 achievements.
 * Unlocked = bright (green text), locked = dimmed (grey text).
 */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super("AchievementsScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const i18n = I18nService.load(storage);
    const profile = loadProfile(storage);
    const unlockedSet = new Set(profile.achievements ?? []);

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.10, i18n.t("achievements.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
      })
      .setOrigin(0.5);

    // --- Grid: 6 columns × 3 rows ---
    const cols = 6;
    const rows = 3;
    const cellW = width / (cols + 1);
    const cellH = height * 0.20;
    const gridStartX = cellW / 2 + cellW * 0.5;
    const gridStartY = height * 0.28;

    const categories: AchievementCategory[] = ["combat", "collection", "milestone", "progression", "fun"];

    ACHIEVEMENTS.forEach((ach, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = gridStartX + col * cellW;
      const y = gridStartY + row * cellH;
      const isUnlocked = unlockedSet.has(ach.id);
      const color = isUnlocked ? "#81b29a" : "#555555";
      const alpha = isUnlocked ? 1.0 : 0.5;

      // Icon
      this.add
        .text(x, y, ach.icon, {
          fontSize: "32px",
        })
        .setOrigin(0.5)
        .setAlpha(alpha);

      // Name
      this.add
        .text(x, y + 28, i18n.t(ach.nameKey as never), {
          color,
          fontFamily: "Arial",
          fontSize: "12px",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
    });

    // --- Unlocked count ---
    const unlockedCount = unlockedSet.size;
    this.add
      .text(width / 2, height * 0.92, `${i18n.t("achievements.unlocked")}: ${unlockedCount} / ${ACHIEVEMENTS.length}`, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "18px",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // --- Back button ---
    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.86,
      text: i18n.t("achievements.back"),
      variant: "primary",
      onClick: () => {
        this.scene.start("MainMenuScene");
      },
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.scene.start("MainMenuScene");
    });
  }
}
