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
  on: (event: string, handler: (file: { key: string; url: string }) => void) => void;
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

    // Log load errors so missing assets are visible in the console instead
    // of silently hanging the loader. Phaser still calls create() after all
    // files complete (success or error), but a 404/HTML-fallback on an
    // image can make the Image element hang without firing onerror in some
    // browser/dev-server combos — hence the placeholder PNGs in
    // /public/sprites/ that guarantee every manifest entry resolves.
    this.load.on("loaderror", (file: { key: string; url: string }) => {
      console.warn(`[PreloadScene] Failed to load asset: key="${file.key}" url="${file.url}"`);
    });

    // Load image assets (placeholder UI button, etc.).
    loadAssets(this, assetManifest);

    // Load every sound from the manifest (.ogg files under /public/sounds/).
    for (const def of SOUND_MANIFEST) {
      this.load.audio(def.key, def.path);
    }

    // Load every sprite from the manifest (.png files under /public/sprites/).
    // Every manifest entry has a corresponding PNG file — if a sprite is
    // missing, the loaderror handler above will log it.
    loadAllSprites(this.load);
  },
  create(this: PreloadSceneContext) {
    this.scene.start("MainMenuScene");
  },
};
