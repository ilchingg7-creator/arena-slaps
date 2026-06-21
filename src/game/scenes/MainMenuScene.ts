import type Phaser from "phaser";
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

type MainMenuContext = {
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

export const MainMenuScene = {
  name: "MainMenuScene",
  key: "MainMenuScene",
  create(this: MainMenuContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const storage = getStorage();
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(
      this as unknown as Phaser.Scene,
      settings,
    );

    // Start menu music (no-op if already playing).
    audio.playMenuTheme();

    // --- Top-right mute button ---
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
        // If unmuted, restart menu music.
        if (!next.musicMuted) audio.playMenuTheme();
      },
    );

    // --- Background (menu-bg.png with dark navy fallback) ---
    createBackground(
      this as unknown as Phaser.Scene,
      { key: "menu-bg" },
    );

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

    // --- Navigation buttons (modern StyledButton) ---
    const goStart = () => {
      audio.playMenuClick();
      this.scene.start("BattleSetupScene");
    };
    const goAudio = () => {
      audio.playMenuClick();
      this.scene.start("AudioSettingsScene");
    };

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.52,
        text: "Начать",
        variant: "primary",
        onClick: goStart,
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.66,
        text: "Audio Settings",
        variant: "secondary",
        onClick: goAudio,
      },
    );

    this.input.keyboard?.on("keydown-ENTER", goStart);
  },
};
