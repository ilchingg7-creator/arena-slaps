import type Phaser from "phaser";
import {
  BOT_DIFFICULTY_OPTIONS,
  cycleOption,
  describeDifficulty,
  describeMode,
  loadSettings,
  MODE_OPTIONS,
  ROUND_LENGTH_OPTIONS,
  saveSettings,
  WINNING_SCORE_OPTIONS,
  type BotDifficulty,
  type GameMode,
  type GameSettings,
} from "../config/gameSettings";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
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

type BattleSetupContext = {
  add: DisplayList;
  input: {
    keyboard?: { on: (event: string, handler: () => void) => void };
    on?: (event: string, handler: (pointer: unknown) => void) => void;
  };
  scene: {
    add: (key: string, scene: unknown, autoStart?: boolean) => void;
    get: (key: string) => unknown;
    start: (key: string, data?: unknown) => void;
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

export const BattleSetupScene = {
  name: "BattleSetupScene",
  key: "BattleSetupScene",
  create(this: BattleSetupContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const storage = getStorage();
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(
      this as unknown as Phaser.Scene,
      settings,
    );
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
      .text(width / 2, height * 0.12, "Battle Setup", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
      })
      .setOrigin(0.5);

    // --- Settings rows ---
    const labelX = width * 0.32;
    const valueX = width * 0.58;
    const rowStartY = height * 0.28;
    const rowStep = 50;

    // Small "secondary" StyledButtons for the 4 setting value labels.
    // width=180, height=40, fontSize=18 per task spec.
    const valueButtonConfig = {
      variant: "secondary" as const,
      width: 180,
      height: 40,
      fontSize: 18,
    };

    const sceneLike = this as unknown as Parameters<typeof createStyledButton>[0];

    // Row labels (plain text, left-aligned).
    this.add
      .text(labelX, rowStartY, "Mode", rowStyle())
      .setOrigin(0, 0.5);

    const modeButton = createStyledButton(sceneLike, {
      x: valueX,
      y: rowStartY,
      text: describeMode(settings.mode),
      ...valueButtonConfig,
      onClick: () => {
        clickPlay();
        const nextMode = cycleOption(
          MODE_OPTIONS as readonly GameMode[],
          settings.mode,
        );
        settings = { ...settings, mode: nextMode };
        modeButton.setText(describeMode(nextMode));
        refreshDifficultyVisibility();
        persist();
      },
    });

    const difficultyLabel = this.add
      .text(labelX, rowStartY + rowStep, "Bot Difficulty", rowStyle())
      .setOrigin(0, 0.5);

    const difficultyButton = createStyledButton(sceneLike, {
      x: valueX,
      y: rowStartY + rowStep,
      text: describeDifficulty(settings.botDifficulty),
      ...valueButtonConfig,
      onClick: () => {
        // onClick is only reachable when enabled (mode === "1p-vs-bot").
        clickPlay();
        const next: BotDifficulty = cycleOption(
          BOT_DIFFICULTY_OPTIONS as readonly BotDifficulty[],
          settings.botDifficulty,
        );
        settings = { ...settings, botDifficulty: next };
        difficultyButton.setText(describeDifficulty(next));
        persist();
      },
    });

    this.add
      .text(labelX, rowStartY + rowStep * 2, "Round Length", rowStyle())
      .setOrigin(0, 0.5);

    const roundButton = createStyledButton(sceneLike, {
      x: valueX,
      y: rowStartY + rowStep * 2,
      text: `${settings.roundLengthSeconds}s`,
      ...valueButtonConfig,
      onClick: () => {
        clickPlay();
        const next = cycleOption(
          ROUND_LENGTH_OPTIONS,
          settings.roundLengthSeconds,
        );
        settings = { ...settings, roundLengthSeconds: next };
        roundButton.setText(`${next}s`);
        persist();
      },
    });

    this.add
      .text(labelX, rowStartY + rowStep * 3, "Win Score", rowStyle())
      .setOrigin(0, 0.5);

    const scoreButton = createStyledButton(sceneLike, {
      x: valueX,
      y: rowStartY + rowStep * 3,
      text: String(settings.winningScore),
      ...valueButtonConfig,
      onClick: () => {
        clickPlay();
        const next = cycleOption(WINNING_SCORE_OPTIONS, settings.winningScore);
        settings = { ...settings, winningScore: next };
        scoreButton.setText(String(next));
        persist();
      },
    });

    const refreshDifficultyVisibility = () => {
      const visible = settings.mode === "1p-vs-bot";
      difficultyLabel.setText(visible ? "Bot Difficulty" : "");
      difficultyButton.setText(
        visible ? describeDifficulty(settings.botDifficulty) : "—",
      );
      // Dim + disable the difficulty control when it doesn't apply.
      difficultyButton.setEnabled(visible);
    };
    refreshDifficultyVisibility();

    const persist = () => {
      if (storage) saveSettings(storage, settings);
    };

    const clickPlay = () => audio.playMenuClick();

    // --- Start + Back buttons (modern StyledButton) ---
    let startButton: StyledButton;
    let battleSceneReady = false;
    let queuedStart = false;

    const startBattle = () => {
      if (!battleSceneReady) {
        queuedStart = true;
        startButton.setText("Loading...");
        return;
      }
      audio.playMenuStart();
      // Stop menu music before entering battle (battle scene plays its own).
      audio.stopMusic();
      this.scene.start("BattleScene", settings);
    };

    startButton = createStyledButton(sceneLike, {
      x: width / 2,
      y: height * 0.78,
      text: "Start Battle",
      variant: "success",
      onClick: startBattle,
    });

    const backButton = createStyledButton(sceneLike, {
      x: width / 2,
      y: height * 0.90,
      text: "Back",
      variant: "secondary",
      onClick: () => {
        audio.playMenuClick();
        this.scene.start("MainMenuScene");
      },
    });

    // Dynamically import BattleScene + ResultsScene (code-splitting).
    void Promise.all([
      import("./BattleScene"),
      import("./ResultsScene"),
    ]).then(([battleModule, resultsModule]) => {
      if (!this.scene.get("BattleScene")) {
        this.scene.add("BattleScene", battleModule.BattleScene, false);
      }
      if (!this.scene.get("ResultsScene")) {
        this.scene.add("ResultsScene", resultsModule.ResultsScene, false);
      }
      battleSceneReady = true;
      startButton.setText("Start Battle");
      if (queuedStart) startBattle();
    });

    this.input.keyboard?.on("keydown-ENTER", startBattle);
    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  },
};
