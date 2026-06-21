import { assetManifest } from "../assets/assetManifest";
import { loadAssets } from "../assets/loader";
import { loadAllSprites } from "../assets/spriteLoader";
import { SOUND_MANIFEST } from "../assets/soundManifest";

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
  audio: (key: string, urls: string | string[]) => void;
  atlas: (key: string, textureURL: string, atlasURL: string) => void;
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

    // Load image assets (placeholder UI button, etc.).
    loadAssets(this, assetManifest);

    // Load every sound from the manifest (.ogg files under /public/sounds/).
    for (const def of SOUND_MANIFEST) {
      this.load.audio(def.key, def.path);
    }

    // Load every sprite from the manifest (.png files under /public/sprites/).
    // If a sprite file is missing, Phaser will log a warning but continue;
    // the SpriteManager will fall back to a primitive at render time.
    loadAllSprites(this.load);
  },
  create(this: PreloadSceneContext) {
    this.scene.start("MainMenuScene");
  },
};
