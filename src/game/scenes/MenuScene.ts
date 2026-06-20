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
  };
  scene: {
    add: (key: string, scene: unknown, autoStart?: boolean) => void;
    start: (key: string) => void;
  };
  scale?: {
    width?: number;
    height?: number;
  };
};

export const MenuScene = {
  name: "MenuScene",
  key: "MenuScene",
  create(this: MenuSceneContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    let battleSceneReady = false;
    let scenesReady = false;
    let queuedStart = false;

    const startButton = this.add
      .text(width / 2, height * 0.62, "Loading...", {
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

    const startBattle = () => {
      if (!battleSceneReady || !scenesReady) {
        queuedStart = true;
        startButton.setText("Loading...");
        return;
      }

      this.scene.start("BattleScene");
    };

    void Promise.all([import("./BattleScene"), import("./ResultsScene")]).then(
      ([battleModule, resultsModule]) => {
        this.scene.add("BattleScene", battleModule.BattleScene, false);
        this.scene.add("ResultsScene", resultsModule.ResultsScene, false);
        battleSceneReady = true;
        scenesReady = true;
        startButton.setText("Start");

        if (queuedStart) {
          startBattle();
        }
      },
    );

    this.add
      .text(width / 2, height * 0.32, "Arena Slaps", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "56px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.74, "Load-in, slap in, repeat.", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "18px",
      })
      .setOrigin(0.5);

    startButton.on?.("pointerup", startBattle);
    this.input.keyboard?.on("keydown-ENTER", startBattle);
  },
};
