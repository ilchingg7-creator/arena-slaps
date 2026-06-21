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

type TextObject = {
  on?: (event: string, handler: () => void) => TextObject;
  setInteractive: (config?: { useHandCursor?: boolean }) => TextObject;
  setOrigin: (x?: number, y?: number) => TextObject;
  setText: (value: string) => TextObject;
};

type GraphicsObject = {
  clear: () => GraphicsObject;
  fillStyle: (color: number, alpha?: number) => GraphicsObject;
  fillGradientRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    alpha?: number,
  ) => GraphicsObject;
  fillRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius?: number,
  ) => GraphicsObject;
  lineStyle: (width: number, color: number, alpha?: number) => GraphicsObject;
  strokeRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius?: number,
  ) => GraphicsObject;
  setPosition: (x: number, y: number) => GraphicsObject;
  setScale: (x: number, y?: number) => GraphicsObject;
  setVisible: (visible: boolean) => GraphicsObject;
  setAlpha: (alpha: number) => GraphicsObject;
  setDepth: (depth: number) => GraphicsObject;
  setInteractive: (config?: { useHandCursor?: boolean }) => GraphicsObject;
  on: (event: string, handler: (pointer?: unknown) => void) => GraphicsObject;
  removeAllListeners: () => GraphicsObject;
  destroy: () => void;
};

type DisplayList = {
  text: (x: number, y: number, value: string, style?: TextStyle) => TextObject;
  graphics: (config?: unknown) => GraphicsObject;
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

    const sceneLike = this as unknown as Parameters<typeof createStyledButton>[0];

    // The SFX / Music mute toggle buttons are created below; we declare them
    // up-front so the top-right master mute button's onChange can update
    // their labels when it toggles both at once.
    let sfxMuteButton: StyledButton;
    let musicMuteButton: StyledButton;

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
        // Sync the individual mute toggle labels.
        sfxMuteButton.setText(settings.sfxMuted ? "Muted" : "On");
        musicMuteButton.setText(settings.musicMuted ? "Muted" : "On");
      },
    );

    // --- Background (menu-bg.png with dark navy fallback) ---
    createBackground(
      this as unknown as Phaser.Scene,
      { key: "menu-bg" },
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
    const muteButtonConfig = {
      variant: "warning" as const,
      width: 140,
      height: 36,
      fontSize: 18,
    };

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
      },
    );

    // SFX mute toggle (warning-variant StyledButton).
    this.add
      .text(labelX, rowStartY + 30, "SFX Mute", rowStyle())
      .setOrigin(0, 0.5);
    sfxMuteButton = createStyledButton(sceneLike, {
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

    const musicSlider = createVolumeSlider(
      this as unknown as Parameters<typeof createVolumeSlider>[0],
      sliderX,
      rowStartY + rowStep,
      240,
      settings.musicVolume,
      (nextVolume) => {
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
      },
    );

    // Music mute toggle (warning-variant StyledButton).
    this.add
      .text(labelX, rowStartY + rowStep + 30, "Music Mute", rowStyle())
      .setOrigin(0, 0.5);
    musicMuteButton = createStyledButton(sceneLike, {
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

    // --- Volume display helper ---
    void describeVolume;

    // --- Back button (secondary StyledButton) ---
    const goBack = () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    };
    createStyledButton(sceneLike, {
      x: width / 2,
      y: height * 0.88,
      text: "Back",
      variant: "secondary",
      onClick: goBack,
    });

    this.input.keyboard?.on("keydown-ENTER", goBack);
    this.input.keyboard?.on("keydown-ESC", goBack);

    // Wire global pointermove/up for BOTH sliders (B8 fix) so that drag
    // continues even when the pointer leaves the slider's narrow hit zone.
    // Without this, only the slider whose hit zone the pointer is over
    // receives pointermove events, and dragging beyond the zone freezes.
    this.input.on?.("pointermove", (pointer: unknown) => {
      const p = pointer as { x: number; y: number; isDown: boolean };
      sfxSlider.handlePointerMove(p);
      musicSlider.handlePointerMove(p);
    });
    this.input.on?.("pointerup", () => {
      sfxSlider.endDrag();
      musicSlider.endDrag();
    });
  },
};
