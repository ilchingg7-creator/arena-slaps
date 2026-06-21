import Phaser from "phaser";
import {
  describeVolume,
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../config/gameSettings";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import { createVolumeSlider } from "../ui/VolumeSlider";
import { createStyledButton, type StyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";

type TextStyle = {
  align?: string;
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  padding?: { x?: number; y?: number };
};

function rowStyle(): TextStyle {
  return {
    color: "#f4f1de",
    fontFamily: "Arial",
    fontSize: "22px",
    padding: { x: 14, y: 6 },
  };
}

// describeVolume is exported for future UI use; keep it referenced.
void describeVolume;

/**
 * Audio settings scene — separate SFX and Music volume sliders + mute
 * toggles. Includes a top-right master mute button that toggles both.
 */
export class AudioSettingsScene extends Phaser.Scene {
  constructor() {
    super("AudioSettingsScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(this, settings);
    audio.playMenuTheme();

    let sfxMuteButton: StyledButton;
    let musicMuteButton: StyledButton;

    // --- Top-right mute button (toggles both) ---
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
      sfxMuteButton.setText(settings.sfxMuted ? "Muted" : "On");
      musicMuteButton.setText(settings.musicMuted ? "Muted" : "On");
    });

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.12, "Audio Settings", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
      })
      .setOrigin(0.5);

    // --- SFX row ---
    const labelX = width * 0.30;
    const sliderX = width * 0.58;
    const rowStartY = height * 0.28;
    const rowStep = 90;
    const muteButtonConfig = {
      variant: "warning" as const,
      width: 140,
      height: 36,
      fontSize: 18,
    };

    this.add
      .text(labelX, rowStartY - 30, "SFX Volume", rowStyle())
      .setOrigin(0, 0.5);

    const sfxSlider = createVolumeSlider(this as unknown as Parameters<typeof createVolumeSlider>[0], sliderX, rowStartY, 240, settings.sfxVolume, (nextVolume) => {
      settings = { ...settings, sfxVolume: nextVolume };
      if (nextVolume > 0 && settings.sfxMuted) {
        settings = { ...settings, sfxMuted: false };
        sfxMuteButton.setText("On");
      }
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      audio.playMenuClick();
      if (storage) saveSettings(storage, settings);
    });

    this.add
      .text(labelX, rowStartY + 30, "SFX Mute", rowStyle())
      .setOrigin(0, 0.5);
    sfxMuteButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: sliderX + 130,
      y: rowStartY + 30,
      text: settings.sfxMuted ? "Muted" : "On",
      ...muteButtonConfig,
      onClick: () => {
        const next = !settings.sfxMuted;
        settings = { ...settings, sfxMuted: next };
        sfxMuteButton.setText(next ? "Muted" : "On");
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (!next) audio.playMenuClick();
        if (storage) saveSettings(storage, settings);
      },
    });

    // --- Music row ---
    this.add
      .text(labelX, rowStartY + rowStep - 30, "Music Volume", rowStyle())
      .setOrigin(0, 0.5);

    const musicSlider = createVolumeSlider(this as unknown as Parameters<typeof createVolumeSlider>[0], sliderX, rowStartY + rowStep, 240, settings.musicVolume, (nextVolume) => {
      settings = { ...settings, musicVolume: nextVolume };
      if (nextVolume > 0 && settings.musicMuted) {
        settings = { ...settings, musicMuted: false };
        musicMuteButton.setText("On");
      }
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      audio.playMenuTheme();
      if (storage) saveSettings(storage, settings);
    });

    this.add
      .text(labelX, rowStartY + rowStep + 30, "Music Mute", rowStyle())
      .setOrigin(0, 0.5);
    musicMuteButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: sliderX + 130,
      y: rowStartY + rowStep + 30,
      text: settings.musicMuted ? "Muted" : "On",
      ...muteButtonConfig,
      onClick: () => {
        const next = !settings.musicMuted;
        settings = { ...settings, musicMuted: next };
        musicMuteButton.setText(next ? "Muted" : "On");
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (!next) audio.playMenuTheme();
        if (storage) saveSettings(storage, settings);
      },
    });

    // --- Back button ---
    const goBack = () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    };
    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.88,
      text: "Back",
      variant: "secondary",
      onClick: goBack,
    });

    this.input.keyboard?.on("keydown-ENTER", goBack);
    this.input.keyboard?.on("keydown-ESC", goBack);

    // Wire global pointermove/up for BOTH sliders (B8 fix).
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      sfxSlider.handlePointerMove(pointer);
      musicSlider.handlePointerMove(pointer);
    });
    this.input.on("pointerup", () => {
      sfxSlider.endDrag();
      musicSlider.endDrag();
    });
  }
}
