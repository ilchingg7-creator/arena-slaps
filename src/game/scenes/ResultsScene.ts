import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";

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

type ResultsSceneContext = {
  add: DisplayList;
  input: {
    keyboard?: {
      on: (event: string, handler: () => void) => void;
    };
  };
  scene: {
    start: (key: string) => void;
  };
  scale?: {
    width?: number;
    height?: number;
  };
};

export const ResultsScene = {
  name: "ResultsScene",
  key: "ResultsScene",
  create(this: ResultsSceneContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const results =
      typeof window === "undefined"
        ? null
        : loadBattleResults(window.localStorage);
    const summary = results ? createBattleResultsSummary(results) : ["No result stored yet."];

    this.add
      .text(width / 2, height * 0.24, "Match Results", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "52px",
      })
      .setOrigin(0.5);

    summary.forEach((line, index) => {
      this.add
        .text(width / 2, height * 0.42 + index * 42, line, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "24px",
        })
        .setOrigin(0.5);
    });

    const menuButton = this.add
      .text(width / 2, height * 0.74, "Back to menu", {
        align: "center",
        backgroundColor: "#f2cc8f",
        color: "#101820",
        fontFamily: "Arial",
        fontSize: "28px",
        padding: {
          x: 24,
          y: 14,
        },
      })
      .setOrigin(0.5)
      .setInteractive();

    const goMenu = () => {
      this.scene.start("MainMenuScene");
    };

    menuButton.on?.("pointerup", goMenu);
    this.input.keyboard?.on("keydown-ENTER", goMenu);
  },
};
