import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {
    name: string;
    scene: { start: (key: string) => void };
    game: {
      events: {
        emit: (event: string, ...args: unknown[]) => void;
        once: (event: string, cb: () => void) => void;
      };
    };
    constructor(key: string) {
      this.name = key;
      this.scene = { start: () => void 0 };
      this.game = {
        events: {
          emit: () => void 0,
          once: () => void 0,
        },
      };
    }
  }
  return { default: { Scene }, Scene };
});

import { PreloadScene } from "./PreloadScene";

describe("PreloadScene — Bug 1: LoadingAPI.ready() signal", () => {
  it("emits 'ready' on game.events when create() is called", () => {
    // Bug 1: main.ts listens for game.events.once("ready", () => YandexSDK.ready())
    // but PreloadScene.create() never emitted the event. This meant
    // LoadingAPI.ready() was never called on the Yandex platform, so the
    // Yandex loader would hang or show its own loading overlay indefinitely.
    const scene = new PreloadScene();
    const emitSpy = vi.spyOn(scene.game.events, "emit");
    scene.create();
    expect(emitSpy).toHaveBeenCalledWith("ready");
  });

  it("transitions to MainMenuScene after emitting 'ready' (order doesn't matter, both must happen)", () => {
    const scene = new PreloadScene();
    const startSpy = vi.spyOn(scene.scene, "start");
    scene.create();
    expect(startSpy).toHaveBeenCalledWith("MainMenuScene");
  });
});
