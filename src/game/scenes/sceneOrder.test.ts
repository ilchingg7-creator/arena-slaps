import { describe, expect, it, vi } from "vitest";

// Mock Phaser: provide the Scale enum (used by gameConfig) and a Scene
// base class (extended by BootScene / PreloadScene / MainMenuScene etc.).
// The mock Scene is a minimal class with a constructor that stores the
// key and a `name` property derived from it, so sceneClasses[i].name works.
vi.mock("phaser", () => {
  class Scene {
    name: string;
    constructor(key: string) {
      this.name = key;
    }
  }
  const Scale = {
    NONE: 0,
    FIT: 3,
    RESIZE: 5,
    CENTER_BOTH: 1,
  };
  return { default: { Scale, Scene }, Scale, Scene };
});

import { sceneClasses } from "../gameConfig";

describe("sceneClasses", () => {
  it("starts with BootScene and includes MainMenuScene", () => {
    expect(sceneClasses[0].name).toBe("BootScene");
    expect(sceneClasses.some((scene) => scene.name === "MainMenuScene")).toBe(true);
  });

  it("includes BattleSetupScene and AudioSettingsScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "BattleSetupScene")).toBe(true);
    expect(sceneClasses.some((scene) => scene.name === "AudioSettingsScene")).toBe(true);
  });

  it("includes ProfileScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "ProfileScene")).toBe(true);
  });

  it("includes ProgressionScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "ProgressionScene")).toBe(true);
  });

  it("has 7 scenes in the correct order", () => {
    expect(sceneClasses).toHaveLength(7);
    expect(sceneClasses.map((s) => s.name)).toEqual([
      "BootScene",
      "PreloadScene",
      "MainMenuScene",
      "BattleSetupScene",
      "AudioSettingsScene",
      "ProfileScene",
      "ProgressionScene",
    ]);
  });
});
