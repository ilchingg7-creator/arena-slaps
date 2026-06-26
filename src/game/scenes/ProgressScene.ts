import Phaser from "phaser";
import { loadProfile } from "../config/profile";
import {
  LEVELS,
  MAX_LEVEL,
} from "../config/progression";
import { ProgressionService } from "../services/ProgressionService";
import {
  ACHIEVEMENTS,
  type AchievementCategory,
} from "../config/achievements";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../config/gameSettings";
import { createStyledButton } from "../ui/StyledButton";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import { drawNeonPanel } from "../ui/neonPrimitives";
import { NEON_COLORS, getHudTextStyle } from "../ui/neonTheme";
import { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";

/**
 * Per-category accent colors for achievement card frames. Same mapping
 * as the (now-legacy) standalone AchievementsScene.
 */
const CATEGORY_COLORS: Record<AchievementCategory, number> = {
  combat: NEON_COLORS.cyan,
  collection: NEON_COLORS.lime,
  milestone: NEON_COLORS.magenta,
  progression: NEON_COLORS.cyan,
  fun: NEON_COLORS.impact,
};

/** Card grid layout — tuned for 1280×720. Card size reduced 5% from
 * 168×168 to 160×160 per user feedback (cards were slightly too large). */
const ACH_COLS = 6;
const ACH_CARD_W = 160;
const ACH_CARD_H = 160;
const ACH_GAP_X = 12;
const ACH_GAP_Y = 16;

type Tab = "levels" | "achievements";

/**
 * Progress scene — combined Levels + Achievements view with tab switching.
 *
 * Tab "Уровни": current level, XP bar, unlock ladder (from ProgressionScene).
 * Tab "Достижения": 18-achievement grid (from AchievementsScene).
 *
 * Tabs switch in-place (no scene.restart) — content objects are tracked
 * in arrays and destroyed/re-rendered on switch.
 */
export class ProgressScene extends Phaser.Scene {
  private currentTab: Tab = "levels";
  private tabTexts: { levels: Phaser.GameObjects.Text | null; achievements: Phaser.GameObjects.Text | null } = {
    levels: null,
    achievements: null,
  };
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private i18n: I18nService | null = null;
  private audio: AudioService | null = null;

  constructor() {
    super("ProgressScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let settings: GameSettings = loadSettings(storage);

    this.audio = getAudioService(this, settings);
    this.audio.playMenuTheme();
    this.i18n = I18nService.load(storage);

    // --- Top-right mute button ---
    createTopRightMuteButton(
      this as unknown as Parameters<typeof createTopRightMuteButton>[0],
      { sfxMuted: settings.sfxMuted, musicMuted: settings.musicMuted },
      (next) => {
        settings = { ...settings, sfxMuted: next.sfxMuted, musicMuted: next.musicMuted };
        this.audio!.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (storage) saveSettings(storage, settings);
        if (next.sfxMuted && next.musicMuted) this.audio!.stopAll();
        else if (!next.musicMuted) { this.audio!.hardStopMusic(); this.audio!.playMenuTheme(); }
      },
      { soundLabel: this.i18n.t("mute.sound"), mutedLabel: this.i18n.t("mute.muted") },
    );

    // --- Background: solid ink color (replaces noisy menu-bg PNG so
    // text reads on both Levels and Achievements tabs). Persistent
    // across tab switches — not in contentObjects. ---
    this.add
      .rectangle(width / 2, height / 2, width, height, NEON_COLORS.bgInk)
      .setDepth(-100);
    const outerFrame = this.add.graphics().setDepth(-99);
    outerFrame.lineStyle(2, NEON_COLORS.cyan, 0.18);
    outerFrame.strokeRect(24, 24, width - 48, height - 48);

    // --- Title (neon HUD style on a panel) ---
    const titleText = this.i18n.t("progress.title");
    const titleY = height * 0.06;
    const titlePanelW = 360;
    const titlePanelH = 56;
    const titlePanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      width / 2 - titlePanelW / 2,
      titleY - titlePanelH / 2,
      titlePanelW,
      titlePanelH,
    ) as unknown as Phaser.GameObjects.Graphics;
    titlePanel.setDepth(0);
    void titlePanel; // persisted via graphics object
    this.add
      .text(width / 2, titleY, titleText, getHudTextStyle("title"))
      .setOrigin(0.5)
      .setDepth(1);

    // --- Tab buttons (neon-styled) ---
    const tabY = height * 0.13;
    this.tabTexts.levels = this.add
      .text(width / 2 - 90, tabY, this.i18n.t("progress.tab.levels"), {
        color: this.currentTab === "levels" ? "#20f6ff" : "#92a0bb",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "levels" ? "bold" : "normal",
        stroke: "#05070d",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.achievements = this.add
      .text(width / 2 + 90, tabY, this.i18n.t("progress.tab.achievements"), {
        color: this.currentTab === "achievements" ? "#20f6ff" : "#92a0bb",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "achievements" ? "bold" : "normal",
        stroke: "#05070d",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.levels.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "levels") { this.currentTab = "levels"; this.updateTabColors(); this.refreshContent(); }
    });
    this.tabTexts.achievements.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "achievements") { this.currentTab = "achievements"; this.updateTabColors(); this.refreshContent(); }
    });

    // --- Initial content ---
    this.refreshContent();

    // --- Back button ---
    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.93,
      text: this.i18n.t("progression.back"),
      variant: "primary",
      onClick: () => { this.audio?.playMenuClick(); this.scene.start("MainMenuScene"); },
    });

    this.input.keyboard?.on("keydown-ESC", () => { this.audio?.playMenuClick(); this.scene.start("MainMenuScene"); });
    this.input.keyboard?.on("keydown-ENTER", () => { this.audio?.playMenuClick(); this.scene.start("MainMenuScene"); });
  }

  private updateTabColors(): void {
    if (this.tabTexts.levels) {
      this.tabTexts.levels.setColor(this.currentTab === "levels" ? "#20f6ff" : "#92a0bb");
      this.tabTexts.levels.setFontStyle(this.currentTab === "levels" ? "bold" : "normal");
    }
    if (this.tabTexts.achievements) {
      this.tabTexts.achievements.setColor(this.currentTab === "achievements" ? "#20f6ff" : "#92a0bb");
      this.tabTexts.achievements.setFontStyle(this.currentTab === "achievements" ? "bold" : "normal");
    }
  }

  private refreshContent(): void {
    for (const obj of this.contentObjects) obj.destroy();
    this.contentObjects = [];
    if (this.currentTab === "levels") this.renderLevels();
    else this.renderAchievements();
  }

  private renderLevels(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const profile = loadProfile(storage);
    const i18n = this.i18n!;

    const currentLevel = profile.level ?? 1;

    // --- Level number on a neon panel ---
    const levelText = `${i18n.t("progression.level")}: ${currentLevel}`;
    const levelY = height * 0.22;
    const levelPanelW = 360;
    const levelPanelH = 72;
    const levelPanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      width / 2 - levelPanelW / 2,
      levelY - levelPanelH / 2,
      levelPanelW,
      levelPanelH,
    ) as unknown as Phaser.GameObjects.Graphics;
    levelPanel.setDepth(0);
    this.contentObjects.push(levelPanel);
    const levelLabel = this.add
      .text(width / 2, levelY, levelText, {
        color: "#20f6ff",
        fontFamily: "Arial",
        fontStyle: "bold",
        fontSize: "40px",
        stroke: "#05070d",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.contentObjects.push(levelLabel);

    // --- XP bar (neon-styled) ---
    const progress = ProgressionService.getProgressToNextLevel(profile);
    const barW = width * 0.55;
    const barH = 24;
    const barX = (width - barW) / 2;
    const barY = height * 0.33;
    // Track background (bgPanel fill + cyan stroke).
    const barBg = this.add
      .rectangle(barX + barW / 2, barY + barH / 2, barW, barH, NEON_COLORS.bgPanelAlt)
      .setStrokeStyle(2, NEON_COLORS.cyan)
      .setOrigin(0.5)
      .setDepth(0);
    this.contentObjects.push(barBg);
    // Fill (lime).
    const fillW = Math.max(0, Math.min(1, progress.progress)) * barW;
    if (fillW > 0) {
      const fill = this.add
        .rectangle(barX + fillW / 2, barY + barH / 2, fillW, barH, NEON_COLORS.lime, 1)
        .setOrigin(0.5)
        .setDepth(1);
      this.contentObjects.push(fill);
    }

    // XP text
    const xpText = currentLevel >= MAX_LEVEL
      ? i18n.t("progression.maxLevel")
      : `${i18n.t("progression.xp")}: ${progress.xpIntoLevel} / ${progress.nextLevelXp - progress.currentLevelXp}`;
    const xpLabel = this.add
      .text(width / 2, height * 0.40, xpText, {
        color: "#f6fbff", fontFamily: "Arial", fontSize: "16px",
        stroke: "#05070d", strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.contentObjects.push(xpLabel);

    // --- Unlocks ladder (inside one big neon panel) ---
    const listTopY = height * 0.46;
    const rowStep = 22;
    const labelX = width * 0.18;
    const listH = (LEVELS.length + 1) * rowStep + 16;
    const listW = width * 0.64;
    const listX = (width - listW) / 2;
    const listPanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      listX,
      listTopY - 8,
      listW,
      listH,
    ) as unknown as Phaser.GameObjects.Graphics;
    listPanel.setDepth(0);
    this.contentObjects.push(listPanel);

    const header = this.add
      .text(labelX, listTopY, i18n.t("progression.unlocks"), {
        color: "#b7ff3c", fontFamily: "Arial", fontStyle: "bold", fontSize: "18px",
        stroke: "#05070d", strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setDepth(1);
    this.contentObjects.push(header);

    for (const def of LEVELS) {
      const rowY = listTopY + def.level * rowStep;
      const reached = def.level <= currentLevel;
      const mark = reached ? "\u2713" : "\u2717";
      const markColor = reached ? "#b7ff3c" : "#ff5a36";
      // For levels with only a title reward (no unlocks), show just the
      // title name without the "—" placeholder or " + " prefix.
      const unlockText = def.unlocks.length > 0
        ? def.unlocks.map((u) => i18n.t(`unlock.${u.key}` as TranslationKey)).join(", ")
        : "";
      const rewardText = def.reward
        ? i18n.t(`unlock.title-${def.reward.key}` as TranslationKey)
        : "";
      // Combine: if both unlocks and reward exist, join with " + ".
      // If only one exists, show just that. If neither, show "—".
      const combined = [unlockText, rewardText].filter(Boolean).join(" + ") || "\u2014";
      const rowStr = `${mark}  ${i18n.t("progression.level")} ${def.level}: ${combined}`;
      const row = this.add
        .text(labelX, rowY, rowStr, {
          color: reached ? "#f6fbff" : "#92a0bb",
          fontFamily: "Arial", fontSize: "15px",
          stroke: "#05070d", strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(1);
      this.contentObjects.push(row);
      void markColor; // (mark already colored via the leading glyph)
    }
  }

  private renderAchievements(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const profile = loadProfile(storage);
    const i18n = this.i18n!;
    const unlockedSet = new Set(profile.achievements ?? []);

    // --- Achievement card grid (6 cols × 3 rows = 18) ---
    const gridW = ACH_COLS * ACH_CARD_W + (ACH_COLS - 1) * ACH_GAP_X;
    const gridStartX = (width - gridW) / 2;
    const gridStartY = height * 0.22;

    ACHIEVEMENTS.forEach((ach, idx) => {
      const col = idx % ACH_COLS;
      const row = Math.floor(idx / ACH_COLS);
      const cardX = gridStartX + col * (ACH_CARD_W + ACH_GAP_X);
      const cardY = gridStartY + row * (ACH_CARD_H + ACH_GAP_Y);
      const isUnlocked = unlockedSet.has(ach.id);
      const accent = CATEGORY_COLORS[ach.category];

      // Neon card panel.
      const panel = drawNeonPanel(
        this as unknown as Phaser.Scene,
        cardX,
        cardY,
        ACH_CARD_W,
        ACH_CARD_H,
      ) as unknown as Phaser.GameObjects.Graphics;
      panel.setDepth(0);
      this.contentObjects.push(panel);

      // Accent stroke tinted by category.
      const accentStroke = this.add.graphics().setDepth(0);
      accentStroke.lineStyle(2, accent, isUnlocked ? 0.9 : 0.25);
      accentStroke.strokeRoundedRect(
        cardX + 4,
        cardY + 4,
        ACH_CARD_W - 8,
        ACH_CARD_H - 8,
        10,
      );
      this.contentObjects.push(accentStroke);

      if (!isUnlocked) {
        panel.setAlpha(0.55);
        accentStroke.setAlpha(0.55);
      }

      // Icon — 48px (was 28px in the old renderAchievements).
      const icon = this.add
        .text(cardX + ACH_CARD_W / 2, cardY + 44, ach.icon, {
          fontSize: "48px",
        })
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 1 : 0.6);
      this.contentObjects.push(icon);

      // Name — 14px bold (was 11px regular).
      const nameColor = isUnlocked ? "#f6fbff" : "#92a0bb";
      const name = this.add
        .text(cardX + ACH_CARD_W / 2, cardY + 92, i18n.t(ach.nameKey as never), {
          color: nameColor,
          fontFamily: "Arial",
          fontSize: "14px",
          fontStyle: "bold",
          stroke: "#05070d",
          strokeThickness: 3,
          align: "center",
          wordWrap: { width: ACH_CARD_W - 16 },
        })
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 1 : 0.7);
      this.contentObjects.push(name);

      // Description — NEW (was not shown before).
      const desc = this.add
        .text(
          cardX + ACH_CARD_W / 2,
          cardY + 126,
          i18n.t(ach.descKey as never),
          {
            color: "#92a0bb",
            fontFamily: "Arial",
            fontSize: "11px",
            stroke: "#05070d",
            strokeThickness: 2,
            align: "center",
            wordWrap: { width: ACH_CARD_W - 14 },
          },
        )
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 0.95 : 0.55);
      this.contentObjects.push(desc);
    });

    // --- Unlocked count on a small neon panel ---
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
    this.contentObjects.push(footerPanel);

    const countText = this.add
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
    this.contentObjects.push(countText);
  }
}
