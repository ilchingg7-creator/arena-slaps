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
import { createBackground } from "../ui/Background";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import { drawNeonPanel } from "../ui/neonPrimitives";
import { NEON_COLORS } from "../ui/neonTheme";
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

/** Card grid layout — tuned for 1280×720. */
const ACH_COLS = 6;
const ACH_CARD_W = 168;
const ACH_CARD_H = 168;
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

    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.06, this.i18n.t("progress.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "36px",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // --- Tab buttons ---
    const tabY = height * 0.13;
    this.tabTexts.levels = this.add
      .text(width / 2 - 90, tabY, this.i18n.t("progress.tab.levels"), {
        color: this.currentTab === "levels" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "levels" ? "bold" : "normal",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.achievements = this.add
      .text(width / 2 + 90, tabY, this.i18n.t("progress.tab.achievements"), {
        color: this.currentTab === "achievements" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "achievements" ? "bold" : "normal",
        stroke: "#000000",
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
      this.tabTexts.levels.setColor(this.currentTab === "levels" ? "#f4d35e" : "#f4f1de");
      this.tabTexts.levels.setFontStyle(this.currentTab === "levels" ? "bold" : "normal");
    }
    if (this.tabTexts.achievements) {
      this.tabTexts.achievements.setColor(this.currentTab === "achievements" ? "#f4d35e" : "#f4f1de");
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

    // Level number
    const levelText = this.add
      .text(width / 2, height * 0.22, `${i18n.t("progression.level")}: ${currentLevel}`, {
        color: "#f4d35e", fontFamily: "Arial", fontStyle: "bold", fontSize: "48px",
        stroke: "#000000", strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.contentObjects.push(levelText);

    // XP bar
    const progress = ProgressionService.getProgressToNextLevel(profile);
    const barW = width * 0.55;
    const barH = 22;
    const barX = (width - barW) / 2;
    const barY = height * 0.31;
    const barBg = this.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x3d405b)
      .setStrokeStyle(2, 0xb8b8ff).setOrigin(0.5);
    this.contentObjects.push(barBg);
    const fillW = Math.max(0, Math.min(1, progress.progress)) * barW;
    if (fillW > 0) {
      const fill = this.add.rectangle(barX + fillW / 2, barY + barH / 2, fillW, barH, 0x81b29a, 1);
      this.contentObjects.push(fill);
    }

    // XP text
    const xpText = currentLevel >= MAX_LEVEL
      ? i18n.t("progression.maxLevel")
      : `${i18n.t("progression.xp")}: ${progress.xpIntoLevel} / ${progress.nextLevelXp - progress.currentLevelXp}`;
    const xpLabel = this.add
      .text(width / 2, height * 0.38, xpText, {
        color: "#f4f1de", fontFamily: "Arial", fontSize: "18px",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.contentObjects.push(xpLabel);

    // Unlocks ladder
    const listTopY = height * 0.44;
    const rowStep = 22;
    const labelX = width * 0.18;
    const header = this.add
      .text(labelX, listTopY, i18n.t("progression.unlocks"), {
        color: "#81b29a", fontFamily: "Arial", fontStyle: "bold", fontSize: "18px",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.contentObjects.push(header);

    for (const def of LEVELS) {
      const rowY = listTopY + def.level * rowStep;
      const reached = def.level <= currentLevel;
      const mark = reached ? "\u2713" : "\u2717";
      const markColor = reached ? "#81b29a" : "#e07a5f";
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
          color: markColor, fontFamily: "Arial", fontSize: "16px",
          stroke: "#000000", strokeThickness: 3,
        })
        .setOrigin(0, 0.5);
      this.contentObjects.push(row);
    }
  }

  private renderAchievements(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const profile = loadProfile(storage);
    const i18n = this.i18n!;
    const unlockedSet = new Set(profile.achievements ?? []);

    // --- Ink overlay over the noisy menu-bg PNG so card text reads ---
    // Without this, achievement names were unreadable against the arena
    // crowd / neon lights. The overlay is added to contentObjects so it
    // is destroyed on tab switch, restoring the menu-bg for the levels
    // tab.
    const inkOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, NEON_COLORS.bgInk, 0.94)
      .setDepth(-50)
      .setOrigin(0.5);
    this.contentObjects.push(inkOverlay);

    // Subtle outer decorative frame (same as standalone AchievementsScene).
    const frame = this.add.graphics().setDepth(-49);
    frame.lineStyle(2, NEON_COLORS.cyan, 0.18);
    frame.strokeRect(24, 24, width - 48, height - 48);
    this.contentObjects.push(frame);

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
        .text(cardX + ACH_CARD_W / 2, cardY + 46, ach.icon, {
          fontSize: "48px",
        })
        .setOrigin(0.5)
        .setDepth(1)
        .setAlpha(isUnlocked ? 1 : 0.6);
      this.contentObjects.push(icon);

      // Name — 14px bold (was 11px regular).
      const nameColor = isUnlocked ? "#f6fbff" : "#92a0bb";
      const name = this.add
        .text(cardX + ACH_CARD_W / 2, cardY + 96, i18n.t(ach.nameKey as never), {
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
          cardY + 132,
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
