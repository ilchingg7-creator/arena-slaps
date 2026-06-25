import Phaser from "phaser";
import { loadProfile, type Profile } from "../config/profile";
import {
  LEVELS,
  MAX_LEVEL,
  getAllUnlocksUpTo,
  type Unlock,
} from "../config/progression";
import { ProgressionService } from "../services/ProgressionService";
import { ACHIEVEMENTS } from "../config/achievements";
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
import { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";

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
      const unlockText = def.unlocks.length > 0
        ? def.unlocks.map((u) => i18n.t(`unlock.${u.key}` as TranslationKey)).join(", ")
        : "\u2014";
      const rewardText = def.reward
        ? ` + ${i18n.t(`unlock.title-${def.reward.key}` as TranslationKey)}`
        : "";
      const rowStr = `${mark}  ${i18n.t("progression.level")} ${def.level}: ${unlockText}${rewardText}`;
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

    const cols = 6;
    const cellW = width / (cols + 1);
    const cellH = height * 0.18;
    const gridStartX = cellW / 2 + cellW * 0.5;
    const gridStartY = height * 0.24;

    ACHIEVEMENTS.forEach((ach, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = gridStartX + col * cellW;
      const y = gridStartY + row * cellH;
      const isUnlocked = unlockedSet.has(ach.id);
      const color = isUnlocked ? "#81b29a" : "#555555";
      const alpha = isUnlocked ? 1.0 : 0.5;

      const icon = this.add.text(x, y, ach.icon, { fontSize: "28px" }).setOrigin(0.5).setAlpha(alpha);
      this.contentObjects.push(icon);

      const name = this.add
        .text(x, y + 26, i18n.t(ach.nameKey as never), {
          color, fontFamily: "Arial", fontSize: "11px",
          stroke: "#000000", strokeThickness: 2, align: "center",
        })
        .setOrigin(0.5).setAlpha(alpha);
      this.contentObjects.push(name);
    });

    // Unlocked count
    const countText = this.add
      .text(width / 2, height * 0.86, `${i18n.t("achievements.unlocked")}: ${unlockedSet.size} / ${ACHIEVEMENTS.length}`, {
        color: "#f4f1de", fontFamily: "Arial", fontSize: "16px",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.contentObjects.push(countText);
  }
}
