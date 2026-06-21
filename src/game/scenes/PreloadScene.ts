import Phaser from "phaser";
import { loadAllSprites } from "../assets/spriteLoader";
import { SOUND_MANIFEST } from "../assets/soundManifest";

/**
 * Preload scene — loads all sound and sprite assets declared in the
 * manifests, then transitions to the MainMenuScene.
 *
 * Diagnostic logging: every load / loaderror / complete event is logged
 * to the browser console so missing or corrupt assets are visible.
 *
 * Fallback timeout: if the loader hasn't fired "complete" within
 * LOADER_TIMEOUT_MS, the scene force-transitions to MainMenuScene so
 * the user is never stuck on "Loading..." forever.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const loadingText = this.add
      .text(width / 2, height / 2, "Loading...", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "28px",
      })
      .setOrigin(0.5);

    // --- Diagnostic logging ---
    this.load.on("load", (file: { key: string; url: string }) => {
      console.log(`[PreloadScene] loaded: key="${file.key}" url="${file.url}"`);
    });
    this.load.on("loaderror", (file: { key: string; url: string }) => {
      console.error(`[PreloadScene] LOAD ERROR: key="${file.key}" url="${file.url}"`);
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
    // If the loader doesn't fire "complete" within LOADER_TIMEOUT_MS (e.g. a
    // corrupt asset hangs the Image element without firing onload/onerror),
    // force the transition so the user is never stuck.
    const LOADER_TIMEOUT_MS = 8000;
    this.time.addEvent({
      delay: LOADER_TIMEOUT_MS,
      callback: () => {
        console.warn(
          `[PreloadScene] loader did not complete within ${LOADER_TIMEOUT_MS}ms — forcing transition to MainMenuScene`,
        );
        loadingText.setText("Loading... (timeout — continuing)");
        this.scene.start("MainMenuScene");
      },
    });
  }

  create(): void {
    console.log("[PreloadScene] create() called — transitioning to MainMenuScene");
    this.scene.start("MainMenuScene");
  }
}
