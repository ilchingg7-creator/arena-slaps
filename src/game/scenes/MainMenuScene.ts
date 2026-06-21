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

/**
 * Main menu scene — title screen with "Начать" and "Audio Settings" buttons.
 * Plays the menu-theme music in a loop. Includes a top-right master mute
 * button that toggles both SFX and Music.
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
      if (!next.musicMuted) audio.playMenuTheme();
    });

    // --- Background (menu-bg.png with dark navy fallback) ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.25, "Arena Slaps", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "64px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.35, "Load-in, slap in, repeat.", {
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
    const goAudio = () => {
      audio.playMenuClick();
      this.scene.start("AudioSettingsScene");
    };

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.52,
      text: "Начать",
      variant: "primary",
      onClick: goStart,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.66,
      text: "Audio Settings",
      variant: "secondary",
      onClick: goAudio,
    });

    this.input.keyboard?.on("keydown-ENTER", goStart);
  }
}
