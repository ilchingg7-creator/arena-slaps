import Phaser from "phaser";
import {
  ACHIEVEMENTS,
  type AchievementCategory,
} from "../config/achievements";
import { loadProfile } from "../config/profile";
import { createStyledButton } from "../ui/StyledButton";
import { drawNeonPanel } from "../ui/neonPrimitives";
import {
  NEON_COLORS,
  getHudTextStyle,
} from "../ui/neonTheme";
import { I18nService } from "../i18n/I18nService";

/**
 * AchievementsScene — neon card grid showing all 18 achievements.
 *
 * Visual structure (top to bottom):
 *   - Dark ink background (NEON_COLORS.bgInk) — replaces the old
 *     `menu-bg` PNG which made text unreadable.
 *   - Decorative outer frame (cyan stroke, 24px inset).
 *   - Title "Достижения" on a neon panel.
 *   - 6 × 3 grid of neon achievement cards. Each card:
 *       - drawNeonPanel background tinted by category.
 *       - Large 48px emoji icon.
 *       - Bold 14px name text.
 *       - 11px muted description (word-wrapped within the card).
 *       - Locked cards rendered at 0.55 alpha with desaturated frame.
 *   - Unlocked count footer (e.g. "Открыто: 5 / 18") on a small panel.
 *   - Back button (existing StyledButton, already neon-aware).
 *
 * The scene reads the player's unlocked set from
 * {@link loadProfile} and NEVER modifies it — this is a read-only
 * display surface.
 */

/** Per-category accent colors for card frames. */
const CATEGORY_COLORS: Record<AchievementCategory, number> = {
  combat: NEON_COLORS.cyan,
  collection: NEON_COLORS.lime,
  milestone: NEON_COLORS.magenta,
  progression: NEON_COLORS.cyan,
  fun: NEON_COLORS.impact,
};

/** Layout constants — tuned for 1280×720 (the game's design resolution). */
const COLS = 6;
const ROWS = 3;
const CARD_W = 168;
const CARD_H = 168;
const CARD_GAP_X = 12;
const CARD_GAP_Y = 16;

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

    // --- Background: solid ink color (replaces noisy menu-bg PNG) ---
    this.add
      .rectangle(width / 2, height / 2, width, height, NEON_COLORS.bgInk)
      .setDepth(-100);

    // Subtle outer decorative frame.
    const frame = this.add.graphics().setDepth(-99);
    frame.lineStyle(2, NEON_COLORS.cyan, 0.18);
    frame.strokeRect(24, 24, width - 48, height - 48);

    // --- Title panel + title text ---
    const titleText = i18n.t("achievements.title");
    const titleY = height * 0.09;
    const titlePanelW = 420;
    const titlePanelH = 64;
    const titlePanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      width / 2 - titlePanelW / 2,
      titleY - titlePanelH / 2,
      titlePanelW,
      titlePanelH,
    ) as unknown as Phaser.GameObjects.Graphics;
    titlePanel.setDepth(0);
    this.add
      .text(width / 2, titleY, titleText, getHudTextStyle("title"))
      .setOrigin(0.5)
      .setDepth(1);

    // --- Achievement card grid ---
    // Compute grid block size and center it horizontally.
    const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP_X;
    const gridH = ROWS * CARD_H + (ROWS - 1) * CARD_GAP_Y;
    const gridStartX = (width - gridW) / 2;
    const gridStartY = height * 0.22;

    ACHIEVEMENTS.forEach((ach, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cardX = gridStartX + col * (CARD_W + CARD_GAP_X);
      const cardY = gridStartY + row * (CARD_H + CARD_GAP_Y);
      const isUnlocked = unlockedSet.has(ach.id);

      const accent = CATEGORY_COLORS[ach.category];
      const panel = drawNeonPanel(
        this as unknown as Phaser.Scene,
        cardX,
        cardY,
        CARD_W,
        CARD_H,
      ) as unknown as Phaser.GameObjects.Graphics;
      panel.setDepth(0);
      // Tint the panel slightly toward the category accent by drawing
      // an additional ultra-faint accent stroke over it. We can't
      // recolor the existing Graphics — draw a fresh one.
      const accentStroke = this.add.graphics().setDepth(0);
      accentStroke.lineStyle(2, accent, isUnlocked ? 0.9 : 0.25);
      accentStroke.strokeRoundedRect(
        cardX + 4,
        cardY + 4,
        CARD_W - 8,
        CARD_H - 8,
        10,
      );

      if (!isUnlocked) {
        panel.setAlpha(0.55);
        accentStroke.setAlpha(0.55);
      }

      // Icon — large 48px (was 32px), centered horizontally.
      this.add
        .text(cardX + CARD_W / 2, cardY + 46, ach.icon, {
          fontSize: "48px",
        })
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 1 : 0.6);

      // Name — bold 14px (was 12px regular).
      const nameColor = isUnlocked ? "#f6fbff" : "#92a0bb";
      this.add
        .text(cardX + CARD_W / 2, cardY + 96, i18n.t(ach.nameKey as never), {
          color: nameColor,
          fontFamily: "Arial",
          fontSize: "14px",
          fontStyle: "bold",
          stroke: "#05070d",
          strokeThickness: 3,
          align: "center",
          wordWrap: { width: CARD_W - 16 },
        })
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 1 : 0.7);

      // Description — NEW (was not shown before). 11px muted.
      this.add
        .text(
          cardX + CARD_W / 2,
          cardY + 132,
          i18n.t(ach.descKey as never),
          {
            color: "#92a0bb",
            fontFamily: "Arial",
            fontSize: "11px",
            stroke: "#05070d",
            strokeThickness: 2,
            align: "center",
            wordWrap: { width: CARD_W - 14 },
          },
        )
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 0.95 : 0.55);
    });

    // --- Unlocked count footer (on a small neon panel) ---
    const unlockedCount = unlockedSet.size;
    const footerText = `${i18n.t("achievements.unlocked")}: ${unlockedCount} / ${ACHIEVEMENTS.length}`;
    const footerY = height * 0.88;
    const footerPanelW = 320;
    const footerPanelH = 44;
    const footerPanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      width / 2 - footerPanelW / 2,
      footerY - footerPanelH / 2,
      footerPanelW,
      footerPanelH,
    ) as unknown as Phaser.GameObjects.Graphics;
    footerPanel.setDepth(0);
    this.add
      .text(width / 2, footerY, footerText, {
        color: "#f6fbff",
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        stroke: "#05070d",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // --- Back button (existing neon-aware StyledButton) ---
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.95,
        text: i18n.t("achievements.back"),
        variant: "primary",
        onClick: () => {
          this.scene.start("MainMenuScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.scene.start("MainMenuScene");
    });
  }
}

// Exported layout constants — lets tests assert grid shape without
// hardcoding magic numbers.
export const ACHIEVEMENT_CARD_LAYOUT = {
  cols: COLS,
  rows: ROWS,
  cardW: CARD_W,
  cardH: CARD_H,
  gapX: CARD_GAP_X,
  gapY: CARD_GAP_Y,
} as const;
