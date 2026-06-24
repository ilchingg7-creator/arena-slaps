import Phaser from "phaser";
import { loadProfile, type Profile } from "../config/profile";
import {
  LEVELS,
  MAX_LEVEL,
  getAllUnlocksUpTo,
  type Unlock,
} from "../config/progression";
import { ProgressionService } from "../services/ProgressionService";
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

/**
 * Progression scene — displays the player's level, XP bar, and the full
 * unlock ladder (levels 1..MAX_LEVEL) with checkmarks for everything the
 * player has already unlocked. Reuses the shared menu theme + top-right
 * mute button + bottom Back button pattern from ProfileScene.
 *
 * Layout (fractions of screen height):
 *   - 0.08: title "Прогрессия / Progression"
 *   - 0.20: "Level: N" big number
 *   - 0.32: XP bar (rectangle) — fills based on progress to next level
 *   - 0.40: "XP: 450 / 600" text (or "Max level!" at MAX_LEVEL)
 *   - 0.48..0.86: unlocks ladder, one row per level
 *   - 0.92: Back button
 *
 * Navigation:
 *   - "Back" / ESC / ENTER -> MainMenuScene
 */
export class ProgressionScene extends Phaser.Scene {
  constructor() {
    super("ProgressionScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const profile: Profile = loadProfile(storage);
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(this, settings);
    audio.playMenuTheme();

    // --- i18n (RU/EN) ---
    const i18n = I18nService.load(storage);

    // --- Top-right mute button (toggles both SFX + Music) ---
    createTopRightMuteButton(
      this as unknown as Parameters<typeof createTopRightMuteButton>[0],
      {
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
      },
      (next) => {
        settings = {
          ...settings,
          sfxMuted: next.sfxMuted,
          musicMuted: next.musicMuted,
        };
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (storage) saveSettings(storage, settings);
        if (next.sfxMuted && next.musicMuted) {
          audio.stopAll();
        } else if (!next.musicMuted) {
          audio.hardStopMusic();
          audio.playMenuTheme();
        }
      },
      {
        soundLabel: i18n.t("mute.sound"),
        mutedLabel: i18n.t("mute.muted"),
      },
    );

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.08, i18n.t("progression.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
      })
      .setOrigin(0.5);

    // --- Level (big number) ---
    const currentLevel = profile.level ?? 1;
    this.add
      .text(width / 2, height * 0.20, `${i18n.t("progression.level")}: ${currentLevel}`, {
        color: "#f4d35e",
        fontFamily: "Arial",
        fontStyle: "bold",
        fontSize: "56px",
        stroke: "#000000",
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 6, fill: true },
      })
      .setOrigin(0.5);

    // --- XP bar ---
    const progress = ProgressionService.getProgressToNextLevel(profile);
    const barWidth = width * 0.6;
    const barHeight = 24;
    const barX = (width - barWidth) / 2;
    const barY = height * 0.30;

    // Bar background (dark track).
    const barBg = this.add.rectangle(
      barX + barWidth / 2,
      barY + barHeight / 2,
      barWidth,
      barHeight,
      0x3d405b,
    );
    barBg.setStrokeStyle(2, 0xb8b8ff);
    barBg.setOrigin(0.5);

    // Bar fill (gradient-like via solid colour). Width scales with progress
    // (0..1). At MAX_LEVEL, progress is 1 so the bar shows fully filled.
    const fillWidth = Math.max(0, Math.min(1, progress.progress)) * barWidth;
    if (fillWidth > 0) {
      this.add.rectangle(
        barX + fillWidth / 2,
        barY + barHeight / 2,
        fillWidth,
        barHeight,
        0x81b29a,
        1,
      );
    }

    // --- XP text ---
    const xpLabelText =
      currentLevel >= MAX_LEVEL
        ? i18n.t("progression.maxLevel")
        : `${i18n.t("progression.xp")}: ${progress.xpIntoLevel} / ${progress.nextLevelXp - progress.currentLevelXp}`;
    this.add
      .text(width / 2, height * 0.38, xpLabelText, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "20px",
        stroke: "#000000",
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 3, fill: true },
      })
      .setOrigin(0.5);

    // --- Unlocks ladder ---
    // For every level 1..MAX_LEVEL show its unlocks, prefixed with ✓ when
    // the player has reached that level, ✗ otherwise. Gives a clear visual
    // of the progression path that remains.
    const unlockedKeys = new Set(
      getAllUnlocksUpTo(currentLevel).map((u: Unlock) => u.key),
    );
    const listTopY = height * 0.44;
    const rowStep = 24;
    const labelX = width * 0.18;

    // Small section header.
    this.add
      .text(labelX, listTopY, i18n.t("progression.unlocks"), {
        color: "#81b29a",
        fontFamily: "Arial",
        fontStyle: "bold",
        fontSize: "20px",
        stroke: "#000000",
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 3, fill: true },
      })
      .setOrigin(0, 0.5);

    for (const def of LEVELS) {
      const rowY = listTopY + (def.level) * rowStep;
      const reached = def.level <= currentLevel;
      const mark = reached ? "\u2713" : "\u2717";
      const markColor = reached ? "#81b29a" : "#e07a5f";
      const unlockText =
        def.unlocks.length > 0
          ? def.unlocks.map((u) => {
              // Translate unlock key: "bot-easy" → "unlock.bot-easy", "title-rookie" → "unlock.title-rookie"
              const translationKey = `unlock.${u.key}` as TranslationKey;
              return i18n.t(translationKey);
            }).join(", ")
          : "\u2014";
      const rewardText = def.reward
        ? ` + ${i18n.t(`unlock.title-${def.reward.key}` as TranslationKey)}`
        : "";
      const rowStr = `${mark}  ${i18n.t("progression.level")} ${def.level}: ${unlockText}${rewardText}`;
      this.add
        .text(labelX, rowY, rowStr, {
          color: markColor,
          fontFamily: "Arial",
          fontSize: "18px",
          stroke: "#000000",
          strokeThickness: 3,
          shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 2, fill: true },
        })
        .setOrigin(0, 0.5);
    }

    // The unlockedKeys set is computed for clarity / future use (e.g. a
    // summary row). Reference it here so tsc doesn't flag it as unused —
    // and to make the intent of the set explicit to future readers.

    // --- Back button ---
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.92,
        text: i18n.t("progression.back"),
        variant: "primary",
        onClick: () => {
          audio.playMenuClick();
          this.scene.start("MainMenuScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  }
}
