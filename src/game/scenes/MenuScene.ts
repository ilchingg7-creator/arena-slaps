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
import { createAudioService } from "../audio/createAudioService";
import { createVolumeSlider } from "../ui/VolumeSlider";

type TextStyle = {
  align?: string;
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  padding?: {
    x?: number;
    y?: number;
  };
};

type TextObject = {
  on?: (event: string, handler: () => void) => TextObject;
  setInteractive: () => TextObject;
  setOrigin: (x?: number, y?: number) => TextObject;
  setText: (value: string) => TextObject;
};

type DisplayList = {
  text: (
    x: number,
    y: number,
    value: string,
    style?: TextStyle,
  ) => TextObject;
};

type MenuSceneContext = {
  add: DisplayList;
  input: {
    keyboard?: {
      on: (event: string, handler: () => void) => void;
    };
    on?: (event: string, handler: (pointer: unknown) => void) => void;
  };
  scene: {
    add: (key: string, scene: unknown, autoStart?: boolean) => void;
    /** Returns the scene registered under `key`, or null if none. Used to guard against re-adding scenes on every menu visit (B6). */
    get: (key: string) => unknown;
    start: (key: string, data?: unknown) => void;
  };
  scale?: {
    width?: number;
    height?: number;
  };
  /** Phaser SoundManager duck-type. Widened from `unknown` so createAudioService can route through PhaserAudioBackend (B1). */
  sound?: {
    get?: (key: string) => unknown;
    play: (
      key: string,
      config?: { volume?: number },
    ) => unknown;
    stopAll?: () => void;
  };
};

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
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

export const MenuScene = {
  name: "MenuScene",
  key: "MenuScene",
  create(this: MenuSceneContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const storage = getStorage();
    let settings: GameSettings = loadSettings(storage);

    // AudioService for menu click/start sounds. Use the shared factory so
    // the real PhaserAudioBackend is wired up in the browser (B1) — the
    // previous code hardcoded a NoopAudioBackend, which meant menu sounds
    // never played. The cast is needed because MenuSceneContext is a
    // minimal duck type, while createAudioService expects the PhaserSceneLike
    // shape used by PhaserAudioBackend (load + sound + cache).
    const audio = createAudioService(
      this as unknown as Parameters<typeof createAudioService>[0],
      settings,
    );

    let battleSceneReady = false;
    let scenesReady = false;
    let queuedStart = false;

    const startButton = this.add
      .text(width / 2, height * 0.82, "Loading...", {
        align: "center",
        backgroundColor: "#e07a5f",
        color: "#101820",
        fontFamily: "Arial",
        fontSize: "32px",
        padding: {
          x: 28,
          y: 16,
        },
      })
      .setOrigin(0.5)
      .setInteractive();

    // --- Settings rows ---
    const labelX = width * 0.32;
    const valueX = width * 0.58;
    const rowStartY = height * 0.40;
    const rowStep = 44;

    const modeRow = this.add
      .text(labelX, rowStartY, "Mode", rowStyle())
      .setOrigin(0, 0.5);
    const modeValue = this.add
      .text(valueX, rowStartY, describeMode(settings.mode), valueStyle())
      .setOrigin(0.5)
      .setInteractive();

    const difficultyRow = this.add
      .text(labelX, rowStartY + rowStep, "Bot Difficulty", rowStyle())
      .setOrigin(0, 0.5);
    const difficultyValue = this.add
      .text(
        valueX,
        rowStartY + rowStep,
        describeDifficulty(settings.botDifficulty),
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive();

    const roundRow = this.add
      .text(labelX, rowStartY + rowStep * 2, "Round Length", rowStyle())
      .setOrigin(0, 0.5);
    const roundValue = this.add
      .text(
        valueX,
        rowStartY + rowStep * 2,
        `${settings.roundLengthSeconds}s`,
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive();

    const scoreRow = this.add
      .text(labelX, rowStartY + rowStep * 3, "Win Score", rowStyle())
      .setOrigin(0, 0.5);
    const scoreValue = this.add
      .text(
        valueX,
        rowStartY + rowStep * 3,
        String(settings.winningScore),
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive();

    // Volume slider row — replaces the cycle button with a graphical
    // slider showing percentage (0% – 100%). See ui/VolumeSlider.ts.
    this.add
      .text(labelX, rowStartY + rowStep * 4, "Volume", rowStyle())
      .setOrigin(0, 0.5);
    const volumeSlider = createVolumeSlider(
      this as unknown as Parameters<typeof createVolumeSlider>[0],
      valueX,
      rowStartY + rowStep * 4,
      220,
      settings.masterVolume,
      (nextVolume) => {
        settings = { ...settings, masterVolume: nextVolume };
        // Bumping volume above 0 implicitly unmutes so the user hears it.
        if (nextVolume > 0 && settings.muted) {
          settings = { ...settings, muted: false };
          muteValue.setText("No");
        }
        audio.updateSettings({
          muted: settings.muted,
          masterVolume: settings.masterVolume,
        });
        audio.playMenuClick();
        persist();
      },
    );

    const muteRow = this.add
      .text(labelX, rowStartY + rowStep * 5, "Mute", rowStyle())
      .setOrigin(0, 0.5);
    const muteValue = this.add
      .text(
        valueX,
        rowStartY + rowStep * 5,
        settings.muted ? "Yes" : "No",
        valueStyle(),
      )
      .setOrigin(0.5)
      .setInteractive();

    const refreshDifficultyVisibility = () => {
      const visible = settings.mode === "1p-vs-bot";
      difficultyRow.setText(visible ? "Bot Difficulty" : "");
      difficultyValue.setText(
        visible ? describeDifficulty(settings.botDifficulty) : "—",
      );
    };
    refreshDifficultyVisibility();

    const persist = () => {
      if (storage) {
        saveSettings(storage, settings);
      }
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
      if (settings.mode !== "1p-vs-bot") {
        return;
      }
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

    muteValue.on?.("pointerup", () => {
      const next = !settings.muted;
      settings = { ...settings, muted: next };
      muteValue.setText(next ? "Yes" : "No");
      audio.updateSettings({
        muted: settings.muted,
        masterVolume: settings.masterVolume,
      });
      if (!next) {
        audio.playMenuClick();
      }
      persist();
    });

    // --- Title + tagline ---
    this.add
      .text(width / 2, height * 0.16, "Arena Slaps", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "56px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.25, "Load-in, slap in, repeat.", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "18px",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.31,
        "Click any setting to cycle. Drag the volume slider. Press Enter to start.",
        {
          color: "#81b29a",
          fontFamily: "Arial",
          fontSize: "14px",
        },
      )
      .setOrigin(0.5);

    // --- Battle flow ---
    const startBattle = () => {
      if (!battleSceneReady || !scenesReady) {
        queuedStart = true;
        startButton.setText("Loading...");
        return;
      }
      audio.playMenuStart();
      this.scene.start("BattleScene", settings);
    };

    void Promise.all([
      import("./BattleScene"),
      import("./ResultsScene"),
    ]).then(([battleModule, resultsModule]) => {
      // Guard against re-adding scenes on every menu visit (B6). On the
      // second playthrough Phaser would otherwise log "Scene already
      // exists" and silently no-op, which is harmless but noisy.
      if (!this.scene.get("BattleScene")) {
        this.scene.add("BattleScene", battleModule.BattleScene, false);
      }
      if (!this.scene.get("ResultsScene")) {
        this.scene.add("ResultsScene", resultsModule.ResultsScene, false);
      }
      battleSceneReady = true;
      scenesReady = true;
      startButton.setText("Start");

      if (queuedStart) {
        startBattle();
      }
    });

    startButton.on?.("pointerup", startBattle);
    this.input.keyboard?.on("keydown-ENTER", startBattle);

    // Wire global pointermove + pointerup so the volume slider keeps
    // updating even when the pointer leaves the slider's narrow hit zone
    // (B8). The slider's own hit zone stops receiving pointermove once the
    // pointer exits it; these global listeners forward the events to the
    // slider's handlePointerMove / endDrag methods.
    this.input.on?.("pointermove", (pointer: unknown) => {
      volumeSlider.handlePointerMove(
        pointer as { x: number; y: number; isDown: boolean },
      );
    });
    this.input.on?.("pointerup", () => {
      volumeSlider.endDrag();
    });
  },
};
