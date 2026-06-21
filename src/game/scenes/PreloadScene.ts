import { loadAllSprites } from "../assets/spriteLoader";
import { SOUND_MANIFEST } from "../assets/soundManifest";

type TextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
};

type TextObject = {
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

type LoaderFile = {
  key: string;
  url: string;
  type: string;
};

type SceneLoader = {
  image: (key: string, uri: string) => void;
  audio: (key: string, urls: string | string[]) => void;
  atlas: (key: string, textureURL: string, atlasURL: string) => void;
  on: (event: string, handler: (file?: LoaderFile) => void) => void;
  once: (event: string, handler: () => void) => void;
  emit: (event: string) => void;
};

type SceneController = {
  start: (key: string) => void;
};

type TimeLike = {
  delay: number;
  callback: () => void;
};

type TimeManager = {
  add: (config: TimeLike) => unknown;
};

type PreloadSceneContext = {
  add: DisplayList;
  load: SceneLoader;
  scene: SceneController;
  scale?: {
    width?: number;
    height?: number;
  };
  time?: TimeManager;
};

/** Hard timeout in ms — if the loader hasn't completed by then, force transition. */
const LOADER_TIMEOUT_MS = 8000;

export const PreloadScene = {
  name: "PreloadScene",
  key: "PreloadScene",
  preload(this: PreloadSceneContext) {
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;

    const loadingText = this.add
      .text(width / 2, height / 2, "Loading...", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "28px",
      })
      .setOrigin(0.5);

    // --- Diagnostic logging ---
    // Logs every load / loaderror / complete event so the user can open
    // browser DevTools and see exactly which asset is hanging the loader.
    this.load.on("load", (file?: LoaderFile) => {
      console.log(`[PreloadScene] loaded: key="${file?.key}" url="${file?.url}"`);
    });
    this.load.on("loaderror", (file?: LoaderFile) => {
      console.error(`[PreloadScene] LOAD ERROR: key="${file?.key}" url="${file?.url}" type="${file?.type}"`);
    });
    this.load.on("complete", () => {
      console.log("[PreloadScene] loader complete — all assets loaded");
    });

    // --- Load sounds ---
    for (const def of SOUND_MANIFEST) {
      this.load.audio(def.key, def.path);
    }

    // --- Load sprites ---
    loadAllSprites(this.load);

    // --- Fallback timeout ---
    // If for any reason the loader doesn't fire "complete" within
    // LOADER_TIMEOUT_MS (e.g. a corrupt asset that hangs the Image element
    // without firing onload/onerror), force the transition to MainMenuScene
    // so the user isn't stuck on "Loading..." forever. This is a safety net,
    // not the primary flow.
    this.time?.add({
      delay: LOADER_TIMEOUT_MS,
      callback: () => {
        console.warn(
          `[PreloadScene] loader did not complete within ${LOADER_TIMEOUT_MS}ms — forcing transition to MainMenuScene`,
        );
        loadingText.setText("Loading... (timeout — continuing)");
        this.scene.start("MainMenuScene");
      },
    });
  },
  create(this: PreloadSceneContext) {
    console.log("[PreloadScene] create() called — transitioning to MainMenuScene");
    this.scene.start("MainMenuScene");
  },
};
