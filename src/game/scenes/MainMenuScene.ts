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
import { loadProfile, saveProfile } from "../config/profile";
import { LEVELS } from "../config/progression";
import { FEEDBACK_EMAIL } from "../config/gameInfo";
import { YandexSDK } from "../yandex/SDK";

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
      if (next.sfxMuted && next.musicMuted) { audio.stopAll(); } else if (!next.musicMuted) { audio.hardStopMusic(); audio.playMenuTheme(); }
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

    // --- Logo (image instead of text — can be used as a brand logo) ---
    if (this.textures.exists("logo")) {
      this.add.image(width / 2, height * 0.22, "logo").setOrigin(0.5).setScale(0.35);
    } else {
      // Fallback: text with glow shadow for readability
      this.add
        .text(width / 2, height * 0.25, i18n.t("mainmenu.title"), {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontStyle: "bold",
          fontSize: "64px",
          stroke: "#000000",
          strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 6, fill: true },
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, height * 0.33, i18n.t("mainmenu.tagline"), {
        color: "#81b29a",
        fontFamily: "Arial",
        fontSize: "20px",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 4, fill: true },
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
    const goProgression = () => {
      audio.playMenuClick();
      this.scene.start("ProgressionScene");
    };
    const goAudio = () => {
      audio.playMenuClick();
      this.scene.start("AudioSettingsScene");
    };

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.40,
      text: i18n.t("mainmenu.start"),
      variant: "primary",
      onClick: goStart,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.52,
      text: i18n.t("mainmenu.profile"),
      variant: "secondary",
      onClick: goProfile,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.64,
      text: i18n.t("mainmenu.progression"),
      variant: "secondary",
      onClick: goProgression,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.76,
      text: i18n.t("mainmenu.audioSettings"),
      variant: "secondary",
      onClick: goAudio,
    });

    // --- Feedback email (Rule 6.1) ---
    this.add
      .text(width / 2, height * 0.93, FEEDBACK_EMAIL, {
        color: "#81b29a",
        fontFamily: "Arial",
        fontSize: "14px",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        if (typeof window !== "undefined") {
          window.open(`mailto:${FEEDBACK_EMAIL}`, "_blank");
        }
      });

    this.input.keyboard?.on("keydown-ENTER", goStart);

    // --- Debug combos (disabled in production via SDK availability check) ---
    // Shift+Y → max level, Shift+U → reset level. Only active when the
    // Yandex SDK is NOT available (i.e. local dev mode). This satisfies
    // Rule 1.15 (no test/debug features in published builds) while
    // keeping the combos for local development.
    if (!YandexSDK.isAvailable()) {
      const shiftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.input.keyboard?.on("keydown-Y", () => {
        if (shiftKey?.isDown) {
          const profile = loadProfile(storage);
          const maxDef = LEVELS[LEVELS.length - 1];
          const maxProfile = { ...profile, xp: maxDef.xpRequired, level: maxDef.level };
          if (storage) saveProfile(storage, maxProfile);
          this.scene.restart();
        }
      });
      this.input.keyboard?.on("keydown-U", () => {
        if (shiftKey?.isDown) {
          const profile = loadProfile(storage);
          const resetProfile = { ...profile, xp: 0, level: 1 };
          if (storage) saveProfile(storage, resetProfile);
          this.scene.restart();
        }
      });
    }
  }
}
