import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time, which doesn't exist under the
// node test environment. gameConfig.ts imports Phaser to access the
// `Phaser.Scale` enum, so we stub the module with just those constants.
// The values mirror Phaser 3.90's src/scale/const/SCALE_MODE_CONST.js
// (NONE=0, FIT=3, RESIZE=5) and CENTER_CONST.js (NO_CENTER=0, CENTER_BOTH=1).
// We also stub a minimal `Scene` class because the scene files now use
// `class FooScene extends Phaser.Scene` (converted from plain objects).
vi.mock("phaser", () => {
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
  return { default: { Scale, Scene }, Scale, Scene };
});

import Phaser from "phaser";
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
    expect(gameConfig.scale.mode).toBe(Phaser.Scale.FIT);
    expect(gameConfig.scale.autoCenter).toBe(Phaser.Scale.CENTER_BOTH);
  });
});
