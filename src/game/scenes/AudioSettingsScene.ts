import Phaser from "phaser";
import {
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
import { I18nService } from "../i18n/I18nService";

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

    // --- i18n (RU/EN) ---
    const i18n = I18nService.load(storage);

    let sfxMuteButton: StyledButton;
    let musicMuteButton: StyledButton;

    const mutedLabel = settings.sfxMuted ? i18n.t("audio.muted") : i18n.t("audio.on");
    const mutedLabelMusic = settings.musicMuted ? i18n.t("audio.muted") : i18n.t("audio.on");

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

      if (next.sfxMuted && next.musicMuted) {
        // Mute: stop ALL sounds immediately (guaranteed clean slate).
        audio.stopAll();
      } else if (!next.musicMuted) {
        // Unmute: hard-stop any lingering instances, then restart music.
        audio.hardStopMusic();
        audio.playMenuTheme();
      }
      sfxMuteButton.setText(settings.sfxMuted ? i18n.t("audio.muted") : i18n.t("audio.on"));
      musicMuteButton.setText(settings.musicMuted ? i18n.t("audio.muted") : i18n.t("audio.on"));
    }, {
      soundLabel: i18n.t("mute.sound"),
      mutedLabel: i18n.t("mute.muted"),
    });

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.12, i18n.t("audio.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
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
      .text(labelX, rowStartY - 30, i18n.t("audio.sfxVolume"), rowStyle())
      .setOrigin(0, 0.5);

    // Track the last SFX volume percentage that triggered a click sound.
    // Only play the click when the percentage actually changes (not on
    // every pointermove event while dragging).
    let lastSfxClickPercent = Math.round(settings.sfxVolume * 100);

    const sfxSlider = createVolumeSlider(this as unknown as Parameters<typeof createVolumeSlider>[0], sliderX, rowStartY, 240, settings.sfxVolume, (nextVolume) => {
      settings = { ...settings, sfxVolume: nextVolume };
      if (nextVolume > 0 && settings.sfxMuted) {
        settings = { ...settings, sfxMuted: false };
        sfxMuteButton.setText(i18n.t("audio.on"));
      }
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      // Play click sound ONLY when the rounded percentage changes.
      const newPercent = Math.round(nextVolume * 100);
      if (newPercent !== lastSfxClickPercent) {
        lastSfxClickPercent = newPercent;
        audio.playMenuClick();
      }
      if (storage) saveSettings(storage, settings);
    });

    this.add
      .text(labelX, rowStartY + 30, i18n.t("audio.sfxMute"), rowStyle())
      .setOrigin(0, 0.5);
    sfxMuteButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: sliderX + 130,
      y: rowStartY + 30,
      text: mutedLabel,
      ...muteButtonConfig,
      onClick: () => {
        const next = !settings.sfxMuted;
        settings = { ...settings, sfxMuted: next };
        sfxMuteButton.setText(next ? i18n.t("audio.muted") : i18n.t("audio.on"));
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        // Play a click sound after unmuting so the user hears immediate
        // feedback that SFX is working. The updateSettings call above
        // already cleared sfxMuted, so playMenuClick will be audible.
        if (!next) {
          audio.playMenuClick();
        }
        if (storage) saveSettings(storage, settings);
      },
    });

    // --- Music row ---
    this.add
      .text(labelX, rowStartY + rowStep - 30, i18n.t("audio.musicVolume"), rowStyle())
      .setOrigin(0, 0.5);

    const musicSlider = createVolumeSlider(this as unknown as Parameters<typeof createVolumeSlider>[0], sliderX, rowStartY + rowStep, 240, settings.musicVolume, (nextVolume) => {
      settings = { ...settings, musicVolume: nextVolume };
      if (nextVolume > 0 && settings.musicMuted) {
        settings = { ...settings, musicMuted: false };
        musicMuteButton.setText(i18n.t("audio.on"));
      }
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      // No need to call playMenuTheme() — updateSettings() live-adjusts
      // the playing track's volume via backend.setVolume(). If music was
      // unmuted by raising the volume above 0, restart the theme.
      if (nextVolume > 0 && !settings.musicMuted && audio.getCurrentMusicKey() === null) {
        audio.playMenuTheme();
      }
      if (storage) saveSettings(storage, settings);
    });

    this.add
      .text(labelX, rowStartY + rowStep + 30, i18n.t("audio.musicMute"), rowStyle())
      .setOrigin(0, 0.5);
    musicMuteButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: sliderX + 130,
      y: rowStartY + rowStep + 30,
      text: mutedLabelMusic,
      ...muteButtonConfig,
      onClick: () => {
        const next = !settings.musicMuted;
        settings = { ...settings, musicMuted: next };
        musicMuteButton.setText(next ? i18n.t("audio.muted") : i18n.t("audio.on"));
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (next) {
          // Mute: stop all sounds to guarantee music is silenced.
          audio.stopAll();
        } else {
          // Unmute: hard-stop + restart music fresh.
          audio.hardStopMusic();
          audio.playMenuTheme();
        }
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
      text: i18n.t("audio.back"),
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
