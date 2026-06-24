import Phaser from "phaser";
import { loadAllSprites } from "../assets/spriteLoader";
import { SOUND_MANIFEST } from "../assets/soundManifest";
import { I18nService } from "../i18n/I18nService";

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
    const storage =
      typeof window !== "undefined" ? window.localStorage : null;
    const i18n = I18nService.load(storage);

    const loadingText = this.add
      .text(width / 2, height / 2, i18n.t("preload.loading"), {
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
        loadingText.setText(`${i18n.t("preload.loading")} (timeout — continuing)`);
        // Bug 1 fix: even on timeout, signal the game is "ready" so
        // YandexSDK.ready() (= LoadingAPI.ready()) fires. Without this the
        // Yandex loader would hang indefinitely waiting for the ready
        // signal that never comes.
        this.game.events.emit("ready");
        this.scene.start("MainMenuScene");
      },
    });
  }

  create(): void {
    console.log("[PreloadScene] create() called — transitioning to MainMenuScene");
    // Bug 1 fix: emit the "ready" event on the game so main.ts's
    // `game.events.once("ready", () => YandexSDK.ready())` listener fires
    // LoadingAPI.ready(). Without this, the Yandex Games platform never
    // receives the "game is playable" signal and may show its own loading
    // overlay indefinitely (Rule 1.19.2).
    this.game.events.emit("ready");
    this.scene.start("MainMenuScene");
  }
}
