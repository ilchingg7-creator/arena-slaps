import Phaser from "phaser";
import {
  BOT_DIFFICULTY_OPTIONS,
  cycleOption,
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
import { getRandomNickname } from "../config/nicknames";
import { loadProfile } from "../config/profile";
import { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";

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
 * Translation keys for the 3 bot-difficulty values. Indexed by the same
 * string literal type used in gameSettings so the mapping stays
 * type-checked at compile time.
 */
const DIFFICULTY_KEYS: Record<BotDifficulty, TranslationKey> = {
  easy: "battlesetup.difficulty.easy",
  medium: "battlesetup.difficulty.medium",
  hard: "battlesetup.difficulty.hard",
};

/**
 * Translation keys for the 2 game-mode values.
 */
const MODE_KEYS: Record<GameMode, TranslationKey> = {
  "1p-vs-bot": "battlesetup.mode.1p",
  "2p-local": "battlesetup.mode.2p",
};

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

    // --- i18n (RU/EN) ---
    const i18n = I18nService.load(storage);

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
      if (next.sfxMuted && next.musicMuted) { audio.stopAll(); } else if (!next.musicMuted) { audio.hardStopMusic(); audio.playMenuTheme(); }
    }, {
      soundLabel: i18n.t("mute.sound"),
      mutedLabel: i18n.t("mute.muted"),
    });

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.12, i18n.t("battlesetup.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
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
      .text(labelX, rowStartY, i18n.t("battlesetup.mode"), rowStyle())
      .setOrigin(0, 0.5);

    const modeButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: valueX,
      y: rowStartY,
      text: i18n.t(MODE_KEYS[settings.mode]),
      ...valueButtonConfig,
      onClick: () => {
        clickPlay();
        const nextMode = cycleOption(
          MODE_OPTIONS as readonly GameMode[],
          settings.mode,
        );
        settings = { ...settings, mode: nextMode };
        modeButton.setText(i18n.t(MODE_KEYS[nextMode]));
        refreshDifficultyVisibility();
        persist();
      },
    });

    const difficultyLabel = this.add
      .text(labelX, rowStartY + rowStep, i18n.t("battlesetup.botDifficulty"), rowStyle())
      .setOrigin(0, 0.5);

    const difficultyButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: valueX,
      y: rowStartY + rowStep,
      text: i18n.t(DIFFICULTY_KEYS[settings.botDifficulty]),
      ...valueButtonConfig,
      onClick: () => {
        clickPlay();
        const next: BotDifficulty = cycleOption(
          BOT_DIFFICULTY_OPTIONS as readonly BotDifficulty[],
          settings.botDifficulty,
        );
        settings = { ...settings, botDifficulty: next };
        difficultyButton.setText(i18n.t(DIFFICULTY_KEYS[next]));
        persist();
      },
    });

    this.add
      .text(labelX, rowStartY + rowStep * 2, i18n.t("battlesetup.roundLength"), rowStyle())
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
      .text(labelX, rowStartY + rowStep * 3, i18n.t("battlesetup.winScore"), rowStyle())
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
      difficultyLabel.setText(visible ? i18n.t("battlesetup.botDifficulty") : "");
      difficultyButton.setText(
        visible ? i18n.t(DIFFICULTY_KEYS[settings.botDifficulty]) : "—",
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
        startButton.setText(i18n.t("battlesetup.loading"));
        return;
      }
      audio.playMenuStart();
      audio.stopMusic();
      // --- Nicknames (Task 3b) ---
      // In 1P-vs-bot mode the player carries their profile nickname and the
      // bot gets a random nickname (drawn from the 500-name pool, excluding
      // the player's name so the two never collide). In 2P-local mode both
      // humans get random unique nicknames — P1 keeps the profile name, P2
      // gets a random one (also excluding P1's name). BattleScene.init
      // resolves these into the { player, opponent } pair shown in the HUD
      // and as floating labels above each actor.
      const profile = loadProfile(storage);
      const playerNickname = profile.nickname;
      if (settings.mode === "1p-vs-bot") {
        const botNickname = getRandomNickname([playerNickname]);
        this.scene.start("BattleScene", {
          settings,
          playerNickname,
          botNickname,
        });
      } else {
        const player2Nickname = getRandomNickname([playerNickname]);
        this.scene.start("BattleScene", {
          settings,
          playerNickname,
          player2Nickname,
        });
      }
    };

    startButton = createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.78,
      text: i18n.t("battlesetup.startBattle"),
      variant: "success",
      onClick: startBattle,
    });

    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2,
      y: height * 0.90,
      text: i18n.t("battlesetup.back"),
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
      startButton.setText(i18n.t("battlesetup.startBattle"));
      if (queuedStart) startBattle();
    });

    this.input.keyboard?.on("keydown-ENTER", startBattle);
    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  }
}
