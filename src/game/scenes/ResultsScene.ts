import Phaser from "phaser";
import { createBattleResultsSummary, loadBattleResults } from "../systems/BattleResults";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";

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
  text: (
    x: number,
    y: number,
    value: string,
    style?: TextStyle,
  ) => TextObject;
  graphics: (config?: unknown) => GraphicsObject;
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

    // --- Background (arena-bg.png — same cosmic sky as the battle) ---
    createBackground(this as unknown as Phaser.Scene, { key: "arena-bg" });

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

    const goMenu = () => {
      this.scene.start("MainMenuScene");
    };

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.74,
        text: "Back to menu",
        variant: "primary",
        onClick: goMenu,
      },
    );

    this.input.keyboard?.on("keydown-ENTER", goMenu);
  },
};
