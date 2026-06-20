import { assetManifest } from "../assets/assetManifest";
import { loadAssets } from "../assets/loader";

type TextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
};

type TextObject = {
  setOrigin: (x?: number, y?: number) => TextObject;
};

type DisplayList = {
  text: (
    x: number,
    y: number,
    value: string,
    style?: TextStyle,
  ) => TextObject;
};

type SceneLoader = {
  image: (key: string, uri: string) => void;
};

type SceneController = {
  start: (key: string) => void;
};

type PreloadSceneContext = {
  add: DisplayList;
  load: SceneLoader;
  scene: SceneController;
  scale?: {
    width?: number;
    height?: number;
  };
};

export const PreloadScene = {
  name: "PreloadScene",
  key: "PreloadScene",
  preload(this: PreloadSceneContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;

    this.add
      .text(width / 2, height / 2, "Loading...", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "28px",
      })
      .setOrigin(0.5);

    loadAssets(this, assetManifest);
  },
  create(this: PreloadSceneContext) {
    this.scene.start("MenuScene");
  },
};
