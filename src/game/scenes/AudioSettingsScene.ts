import type Phaser from "phaser";
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

type TextStyle = {
  align?: string;
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  padding?: { x?: number; y?: number };
};

type TextObject = {
  on?: (event: string, handler: () => void) => TextObject;
  setInteractive: (config?: { useHandCursor?: boolean }) => TextObject;
  setOrigin: (x?: number, y?: number) => TextObject;
  setText: (value: string) => TextObject;
};

type DisplayList = {
  text: (x: number, y: number, value: string, style?: TextStyle) => TextObject;
};

type AudioSettingsContext = {
  add: DisplayList;
  input: {
    keyboard?: { on: (event: string, handler: () => void) => void };
    on?: (event: string, handler: (pointer: unknown) => void) => void;
  };
  scene: {
    start: (key: string) => void;
  };
  scale?: { width?: number; height?: number };
  sound?: unknown;
};

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function rowStyle(): TextStyle {
  return {
    color: "#f4f1de",
    fontFamily: "Arial",
    fontSize: "22px",
    padding: { x: 14, y: 6 },
  };
}

function toggleStyle(isOn: boolean): TextStyle {
  return {
    align: "center",
    backgroundColor: isOn ? "#e07a5f" : "#3d405b",
    color: "#f4f1de",
    fontFamily: "Arial",
    fontSize: "22px",
    padding: { x: 18, y: 8 },
  };
}

export const AudioSettingsScene = {
  name: "AudioSettingsScene",
  key: "AudioSettingsScene",
  create(this: AudioSettingsContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const storage = getStorage();
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(
      this as unknown as Phaser.Scene,
      settings,
    );
    audio.playMenuTheme();

    // --- Top-right mute button (toggles both) ---
    createTopRightMuteButton(
      this as unknown as Parameters<typeof createTopRightMuteButton>[0],
      { sfxMuted: settings.sfxMuted, musicMuted: settings.musicMuted },
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
        if (!next.musicMuted) audio.playMenuTheme();
        // Update individual mute labels.
        sfxMuteValue.setText(settings.sfxMuted ? "Muted" : "On");
        musicMuteValue.setText(settings.musicMuted ? "Muted" : "On");
      },
    );

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

    this.add
      .text(labelX, rowStartY - 30, "SFX Volume", rowStyle())
      .setOrigin(0, 0.5);

    const sfxSlider = createVolumeSlider(
      this as unknown as Parameters<typeof createVolumeSlider>[0],
      sliderX,
      rowStartY,
      240,
      settings.sfxVolume,
      (nextVolume) => {
        settings = { ...settings, sfxVolume: nextVolume };
        if (nextVolume > 0 && settings.sfxMuted) {
          settings = { ...settings, sfxMuted: false };
          sfxMuteValue.setText("On");
        }
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        audio.playMenuClick();
        if (storage) saveSettings(storage, settings);
      },
    );

    // SFX mute toggle
    this.add
      .text(labelX, rowStartY + 30, "SFX Mute", rowStyle())
      .setOrigin(0, 0.5);
    const sfxMuteValue = this.add
      .text(
        sliderX + 130,
        rowStartY + 30,
        settings.sfxMuted ? "Muted" : "On",
        toggleStyle(settings.sfxMuted),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    sfxMuteValue.on?.("pointerup", () => {
      const next = !settings.sfxMuted;
      settings = { ...settings, sfxMuted: next };
      sfxMuteValue.setText(next ? "Muted" : "On");
      // Phaser text objects can't restyle backgroundColor after creation,
      // so we accept the initial style. The text label change is enough.
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      if (!next) audio.playMenuClick();
      if (storage) saveSettings(storage, settings);
    });

    // --- Music row ---
    this.add
      .text(labelX, rowStartY + rowStep - 30, "Music Volume", rowStyle())
      .setOrigin(0, 0.5);

    createVolumeSlider(
      this as unknown as Parameters<typeof createVolumeSlider>[0],
      sliderX,
      rowStartY + rowStep,
      240,
      settings.musicVolume,
      (nextVolume) => {
        settings = { ...settings, musicVolume: nextVolume };
        if (nextVolume > 0 && settings.musicMuted) {
          settings = { ...settings, musicMuted: false };
          musicMuteValue.setText("On");
        }
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        audio.playMenuTheme();
        if (storage) saveSettings(storage, settings);
      },
    );

    // Music mute toggle
    this.add
      .text(labelX, rowStartY + rowStep + 30, "Music Mute", rowStyle())
      .setOrigin(0, 0.5);
    const musicMuteValue = this.add
      .text(
        sliderX + 130,
        rowStartY + rowStep + 30,
        settings.musicMuted ? "Muted" : "On",
        toggleStyle(settings.musicMuted),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    musicMuteValue.on?.("pointerup", () => {
      const next = !settings.musicMuted;
      settings = { ...settings, musicMuted: next };
      musicMuteValue.setText(next ? "Muted" : "On");
      audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      if (!next) audio.playMenuTheme();
      if (storage) saveSettings(storage, settings);
    });

    // --- Volume display helper ---
    void describeVolume;

    // --- Back button ---
    const backButton = this.add
      .text(width / 2, height * 0.88, "Back", {
        align: "center",
        backgroundColor: "#f2cc8f",
        color: "#101820",
        fontFamily: "Arial",
        fontSize: "28px",
        padding: { x: 32, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const goBack = () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    };
    backButton.on?.("pointerup", goBack);
    this.input.keyboard?.on("keydown-ENTER", goBack);
    this.input.keyboard?.on("keydown-ESC", goBack);

    // Wire global pointermove/up for sliders (B8 fix).
    this.input.on?.("pointermove", (pointer: unknown) => {
      sfxSlider.handlePointerMove(
        pointer as { x: number; y: number; isDown: boolean },
      );
    });
    this.input.on?.("pointerup", () => {
      sfxSlider.endDrag();
    });
  },
};
