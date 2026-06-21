import { describe, expect, it, vi } from "vitest";

// gameConfig.ts imports Phaser for the `Phaser.Scale` enum. Phaser pulls in
// `window` at import time which doesn't exist under the node test
// environment, so stub the module with just the Scale constants we touch.
vi.mock("phaser", () => {
  const Scale = {
    NONE: 0,
    FIT: 3,
    RESIZE: 5,
    CENTER_BOTH: 1,
  };
  return { default: { Scale }, Scale };
});

import { sceneClasses } from "../gameConfig";

describe("sceneClasses", () => {
  it("starts with BootScene and includes MenuScene", () => {
    expect(sceneClasses[0].name).toBe("BootScene");
    expect(sceneClasses.some((scene) => scene.name === "MenuScene")).toBe(true);
  });
});
