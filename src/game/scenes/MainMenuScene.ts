import type Phaser from "phaser";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../config/gameSettings";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";

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
    const buttonStyle: TextStyle = {
      align: "center",
      backgroundColor: "#3d405b",
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "32px",
      padding: { x: 40, y: 18 },
    };

    const startButton = this.add
      .text(width / 2, height * 0.52, "Начать", buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const audioButton = this.add
      .text(width / 2, height * 0.66, "Audio Settings", buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const goStart = () => {
      audio.playMenuClick();
      this.scene.start("BattleSetupScene");
    };
    const goAudio = () => {
      audio.playMenuClick();
      this.scene.start("AudioSettingsScene");
    };

    startButton.on?.("pointerup", goStart);
    audioButton.on?.("pointerup", goAudio);
    this.input.keyboard?.on("keydown-ENTER", goStart);
  },
};
