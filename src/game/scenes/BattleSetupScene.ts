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

function valueStyle(): TextStyle {
  return {
    align: "center",
    backgroundColor: "#3d405b",
    color: "#f4f1de",
    fontFamily: "Arial",
    fontSize: "22px",
    padding: { x: 18, y: 8 },
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

    const modeValue = this.add
      .text(valueX, rowStartY, describeMode(settings.mode), valueStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(labelX, rowStartY, "Mode", rowStyle())
      .setOrigin(0, 0.5);

    const difficultyValue = this.add
      .text(
        valueX,
        rowStartY + rowStep,
        describeDifficulty(settings.botDifficulty),
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const difficultyLabel = this.add
      .text(labelX, rowStartY + rowStep, "Bot Difficulty", rowStyle())
      .setOrigin(0, 0.5);

    const roundValue = this.add
      .text(
        valueX,
        rowStartY + rowStep * 2,
        `${settings.roundLengthSeconds}s`,
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(labelX, rowStartY + rowStep * 2, "Round Length", rowStyle())
      .setOrigin(0, 0.5);

    const scoreValue = this.add
      .text(
        valueX,
        rowStartY + rowStep * 3,
        String(settings.winningScore),
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(labelX, rowStartY + rowStep * 3, "Win Score", rowStyle())
      .setOrigin(0, 0.5);

    const refreshDifficultyVisibility = () => {
      const visible = settings.mode === "1p-vs-bot";
      difficultyLabel.setText(visible ? "Bot Difficulty" : "");
      difficultyValue.setText(
        visible ? describeDifficulty(settings.botDifficulty) : "—",
      );
    };
    refreshDifficultyVisibility();

    const persist = () => {
      if (storage) saveSettings(storage, settings);
    };

    const clickPlay = () => audio.playMenuClick();

    modeValue.on?.("pointerup", () => {
      clickPlay();
      const nextMode = cycleOption(
        MODE_OPTIONS as readonly GameMode[],
        settings.mode,
      );
      settings = { ...settings, mode: nextMode };
      modeValue.setText(describeMode(nextMode));
      refreshDifficultyVisibility();
      persist();
    });

    difficultyValue.on?.("pointerup", () => {
      if (settings.mode !== "1p-vs-bot") return;
      clickPlay();
      const next: BotDifficulty = cycleOption(
        BOT_DIFFICULTY_OPTIONS as readonly BotDifficulty[],
        settings.botDifficulty,
      );
      settings = { ...settings, botDifficulty: next };
      difficultyValue.setText(describeDifficulty(next));
      persist();
    });

    roundValue.on?.("pointerup", () => {
      clickPlay();
      const next = cycleOption(
        ROUND_LENGTH_OPTIONS,
        settings.roundLengthSeconds,
      );
      settings = { ...settings, roundLengthSeconds: next };
      roundValue.setText(`${next}s`);
      persist();
    });

    scoreValue.on?.("pointerup", () => {
      clickPlay();
      const next = cycleOption(WINNING_SCORE_OPTIONS, settings.winningScore);
      settings = { ...settings, winningScore: next };
      scoreValue.setText(String(next));
      persist();
    });

    // --- Start + Back buttons ---
    const startButton = this.add
      .text(width / 2, height * 0.78, "Start Battle", {
        align: "center",
        backgroundColor: "#e07a5f",
        color: "#101820",
        fontFamily: "Arial",
        fontSize: "32px",
        padding: { x: 36, y: 16 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const backButton = this.add
      .text(width / 2, height * 0.90, "Back", {
        align: "center",
        backgroundColor: "#3d405b",
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "22px",
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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

    startButton.on?.("pointerup", startBattle);
    backButton.on?.("pointerup", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", startBattle);
    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  },
};
