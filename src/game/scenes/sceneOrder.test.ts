import { describe, expect, it, vi } from "vitest";

// gameConfig.ts imports Phaser for the `Phaser.Scale` enum, and now also
// imports AchievementsScene which extends Phaser.Scene. Phaser pulls in
// `window` at import time which doesn't exist under the node test
// environment, so stub the module with the Scale constants + a Scene base
// class so the AchievementsScene class definition doesn't throw.
vi.mock("phaser", () => {
  const Scale = {
    NONE: 0,
    FIT: 3,
    RESIZE: 5,
    CENTER_BOTH: 1,
  };
  class Scene {}
  return { default: { Scale, Scene }, Scale, Scene };
});

import { sceneClasses } from "../gameConfig";

describe("sceneClasses", () => {
  it("starts with BootScene and includes MenuScene", () => {
    expect(sceneClasses[0].name).toBe("BootScene");
    expect(sceneClasses.some((scene) => scene.name === "MenuScene")).toBe(true);
  });

  it("includes AchievementsScene so the menu can switch to it", () => {
    expect(sceneClasses.some((scene) => scene.name === "AchievementsScene")).toBe(
      true,
    );
  });

  it("contains exactly 4 scenes (Boot, Preload, Menu, Achievements)", () => {
    expect(sceneClasses.length).toBe(4);
    expect(sceneClasses.map((s) => s.name)).toEqual([
      "BootScene",
      "PreloadScene",
      "MenuScene",
      "AchievementsScene",
    ]);
  });
});
