import { describe, expect, it, vi } from "vitest";

const { gameConfigs } = vi.hoisted(() => ({ gameConfigs: [] as unknown[] }));

// Phaser pulls in `window` at import time, which doesn't exist under the
// node test environment. gameConfig.ts imports Phaser to access the
// `Phaser.Scale` enum, so we stub the module with just those constants.
// The values mirror Phaser 3.90's src/scale/const/SCALE_MODE_CONST.js
// (NONE=0, FIT=3, RESIZE=5) and CENTER_CONST.js (NO_CENTER=0, CENTER_BOTH=1).
// We also stub a minimal `Scene` class because the scene files now use
// `class FooScene extends Phaser.Scene` (converted from plain objects).
vi.mock("phaser", () => {
  class Game {
    constructor(config: unknown) {
      gameConfigs.push(config);
    }
  }

  class Scene {
    name: string;
    constructor(key: string) {
      this.name = key;
    }
  }
  const Scale = {
    NONE: 0,
    WIDTH_CONTROLS_HEIGHT: 1,
    HEIGHT_CONTROLS_WIDTH: 2,
    FIT: 3,
    ENVELOP: 4,
    RESIZE: 5,
    EXPAND: 6,
    NO_CENTER: 0,
    CENTER_HORIZONTALLY: 2,
    CENTER_VERTICALLY: 4,
    CENTER_BOTH: 1,
  };
  return { default: { CANVAS: 1, Game, Scale, Scene }, CANVAS: 1, Game, Scale, Scene };
});

import Phaser from "phaser";
import { createGame } from "./createGame";
import { gameConfig } from "./gameConfig";

describe("gameConfig", () => {
  it("defines the Phaser boot config", () => {
    expect(gameConfig.width).toBeGreaterThan(0);
    expect(gameConfig.height).toBeGreaterThan(0);
    expect(Array.isArray(gameConfig.scene)).toBe(true);
  });

  it("uses named Phaser.Scale constants instead of opaque numeric enums", () => {
    // `mode: 3` is FIT in Phaser 3.90 (NONE=0, FIT=3, RESIZE=5). We assert
    // against the named constant rather than a literal so the test documents
    // the actual semantic and survives Phaser renumbering the enum.
    expect(gameConfig.scale.mode).toBe(Phaser.Scale.RESIZE);
    expect(gameConfig.scale.autoCenter).toBe(Phaser.Scale.CENTER_BOTH);
  });

  it("disables the browser context menu on the game canvas", () => {
    expect(gameConfig.disableContextMenu).toBe(true);
  });

  it("uses Canvas to avoid unstable WebGL framebuffers in Yandex Browser", () => {
    createGame({} as HTMLElement);

    expect(gameConfigs).toHaveLength(1);
    expect(gameConfigs[0]).toMatchObject({ type: Phaser.CANVAS });
  });
});
