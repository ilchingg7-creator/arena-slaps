import Phaser from "phaser";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../config/gameSettings";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { I18nService } from "../i18n/I18nService";
import { createLanguageToggle } from "../ui/LanguageToggle";

/**
 * Main menu scene — title screen with "Начать", "Профиль", and
 * "Audio Settings" buttons. Plays the menu-theme music in a loop.
 * Includes a top-right master mute button that toggles both SFX and
 * Music, and a top-left language toggle that switches between RU and EN
 * (persisted to localStorage).
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(this, settings);

    // Start menu music (no-op if already playing via shared AudioService).
    audio.playMenuTheme();

    // --- i18n (RU/EN) ---
    const i18n = I18nService.load(storage);

    // --- Top-right mute button (toggles both SFX + Music) ---
    createTopRightMuteButton(this as unknown as Parameters<typeof createTopRightMuteButton>[0], {
      sfxMuted: settings.sfxMuted,
      musicMuted: settings.musicMuted,
    }, (next) => {
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
      if (!next.musicMuted && audio.getCurrentMusicKey() === null) audio.playMenuTheme();
    }, {
      soundLabel: i18n.t("mute.sound"),
      mutedLabel: i18n.t("mute.muted"),
    });

    // --- Top-left language toggle (RU <-> EN) ---
    createLanguageToggle(
      this as unknown as Parameters<typeof createLanguageToggle>[0],
      i18n,
      () => {
        // Persist the new language preference.
        if (storage) i18n.save(storage);
        // Restart the scene so every text re-renders in the new language.
        this.scene.restart();
      },
    );

    // --- Background (menu-bg.png with dark navy fallback) ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.25, i18n.t("mainmenu.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "64px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.35, i18n.t("mainmenu.tagline"), {
        color: "#81b29a",
        fontFamily: "Arial",
        fontSize: "20px",
      })
      .setOrigin(0.5);

    // --- Navigation buttons ---
    const goStart = () => {
      audio.playMenuClick();
      this.scene.start("BattleSetupScene");
    };
    const goProfile = () => {
      audio.playMenuClick();
      this.scene.start("ProfileScene");
    };
    const goAudio = () => {
      audio.playMenuClick();
      this.scene.start("AudioSettingsScene");
    };

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.45,
      text: i18n.t("mainmenu.start"),
      variant: "primary",
      onClick: goStart,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.58,
      text: i18n.t("mainmenu.profile"),
      variant: "secondary",
      onClick: goProfile,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.71,
      text: i18n.t("mainmenu.audioSettings"),
      variant: "secondary",
      onClick: goAudio,
    });

    this.input.keyboard?.on("keydown-ENTER", goStart);
  }
}
