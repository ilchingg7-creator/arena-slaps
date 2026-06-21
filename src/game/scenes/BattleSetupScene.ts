import Phaser from "phaser";
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

function rowStyle(): TextStyle {
  return {
    color: "#f4f1de",
    fontFamily: "Arial",
    fontSize: "22px",
    padding: { x: 14, y: 6 },
  };
}

/**
 * Battle setup scene — choose game mode, bot difficulty, round length, and
 * winning score. The "Start Battle" button dynamically imports BattleScene
 * + ResultsScene (code-splitting) and transitions to the battle.
 */
export class BattleSetupScene extends Phaser.Scene {
  constructor() {
    super("BattleSetupScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let settings: GameSettings = loadSettings(storage);

    const audio: AudioService = getAudioService(this, settings);
    audio.playMenuTheme();

    // --- Top-right mute button ---
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

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

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

    const valueButtonConfig = {
      variant: "secondary" as const,
      width: 180,
      height: 40,
      fontSize: 18,
    };

    this.add
      .text(labelX, rowStartY, "Mode", rowStyle())
      .setOrigin(0, 0.5);

    const modeButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
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

    const difficultyButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: valueX,
      y: rowStartY + rowStep,
      text: describeDifficulty(settings.botDifficulty),
      ...valueButtonConfig,
      onClick: () => {
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

    const roundButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
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

    const scoreButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
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
      difficultyButton.setEnabled(visible);
    };
    refreshDifficultyVisibility();

    const persist = () => {
      if (storage) saveSettings(storage, settings);
    };

    const clickPlay = () => audio.playMenuClick();

    // --- Start + Back buttons ---
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
      audio.stopMusic();
      this.scene.start("BattleScene", settings);
    };

    startButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.78,
      text: "Start Battle",
      variant: "success",
      onClick: startBattle,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
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
  }
}
