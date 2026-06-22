import Phaser from "phaser";
import {
  loadProfile,
  saveProfile,
  resetProfileStats,
  type Profile,
} from "../config/profile";
import { ProfileService } from "../services/ProfileService";
import { getAudioService } from "../audio/getAudioService";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
  type GameMode,
} from "../config/gameSettings";
import { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";

/**
 * Translation keys for the 2 game-mode values.
 */
const MODE_KEYS: Record<GameMode, TranslationKey> = {
  "1p-vs-bot": "mode.1p-vs-bot",
  "2p-local": "mode.2p-local",
};

/**
 * Profile scene — displays the player's statistics (nickname, win rate,
 * total games, wins/losses/draws, ring-outs, power-ups, favorite power-up,
 * favorite mode) and lets the player change their nickname or reset all
 * stats. Reuses the shared menu theme + top-right mute button pattern
 * from MainMenuScene / AudioSettingsScene.
 *
 * Navigation:
 *   - "Change Nickname" -> browser prompt (validated to 1..20 chars)
 *   - "Reset Stats"     -> browser confirm, then resetProfileStats()
 *   - "Back"            -> MainMenuScene
 *   - ESC / ENTER       -> MainMenuScene
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super("ProfileScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let profile: Profile = loadProfile(storage);
    let settings: GameSettings = loadSettings(storage);

    const audio = getAudioService(this, settings);
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
        if (next.sfxMuted && next.musicMuted) { audio.stopAll(); } else if (!next.musicMuted) { audio.hardStopMusic(); audio.playMenuTheme(); }
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
      .text(width / 2, height * 0.1, i18n.t("profile.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
      })
      .setOrigin(0.5);

    // --- Profile content ---
    const service = new ProfileService(profile);
    const labelX = width * 0.3;
    const valueX = width * 0.7;
    const rowStartY = height * 0.22;
    const rowStep = 38;

    const addRow = (label: string, value: string, index: number): void => {
      this.add
        .text(labelX, rowStartY + index * rowStep, label, {
          color: "#81b29a",
          fontFamily: "Arial",
          fontSize: "20px",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(valueX, rowStartY + index * rowStep, value, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
        })
        .setOrigin(1, 0.5);
    };

    addRow(i18n.t("profile.nickname"), profile.nickname, 0);
    addRow(i18n.t("profile.totalGames"), String(service.getTotalGames()), 1);
    addRow(i18n.t("profile.wins"), String(profile.wins), 2);
    addRow(i18n.t("profile.losses"), String(profile.losses), 3);
    addRow(i18n.t("profile.draws"), String(profile.draws), 4);
    addRow(i18n.t("profile.winRate"), `${Math.round(service.getWinRate() * 100)}%`, 5);
    addRow(i18n.t("profile.ringOutsInflicted"), String(profile.ringOutsInflicted), 6);
    addRow(i18n.t("profile.ringOutsSuffered"), String(profile.ringOutsSuffered), 7);
    addRow(i18n.t("profile.powerUpsCollected"), String(profile.powerUpsCollected), 8);
    const favPu = service.getFavoritePowerUp();
    addRow(i18n.t("profile.favoritePowerUp"), favPu ?? "—", 9);
    addRow(
      i18n.t("profile.favoriteMode"),
      i18n.t(MODE_KEYS[service.getFavoriteMode()]),
      10,
    );

    // --- Buttons ---
    const buttonY = height * 0.85;
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.3,
        y: buttonY,
        text: i18n.t("profile.changeNickname"),
        variant: "secondary",
        width: 220,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          // Prompt for new nickname (simple browser prompt for now).
          const newName =
            typeof window !== "undefined"
              ? window.prompt(i18n.t("profile.changeNicknamePrompt"), profile.nickname)
              : null;
          if (
            newName &&
            newName.trim().length > 0 &&
            newName.trim().length <= 20
          ) {
            profile = { ...profile, nickname: newName.trim() };
            service.setNickname(newName.trim());
            if (storage) saveProfile(storage, profile);
            // Restart scene to refresh display.
            this.scene.restart();
          }
        },
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.55,
        y: buttonY,
        text: i18n.t("profile.resetStats"),
        variant: "danger",
        width: 180,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          const confirmReset =
            typeof window !== "undefined"
              ? window.confirm(i18n.t("profile.resetConfirm"))
              : false;
          if (confirmReset) {
            profile = resetProfileStats(profile);
            if (storage) saveProfile(storage, profile);
            this.scene.restart();
          }
        },
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.78,
        y: buttonY,
        text: i18n.t("profile.back"),
        variant: "primary",
        width: 160,
        height: 44,
        fontSize: 18,
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
