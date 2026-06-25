import { describe, expect, it, vi } from "vitest";

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

  it("includes ProgressScene (replaces ProgressionScene + AchievementsScene)", () => {
    expect(sceneClasses.some((scene) => scene.name === "ProgressScene")).toBe(true);
    expect(sceneClasses.some((scene) => scene.name === "ProgressionScene")).toBe(false);
    expect(sceneClasses.some((scene) => scene.name === "AchievementsScene")).toBe(false);
  });

  it("includes CosmeticsScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "CosmeticsScene")).toBe(true);
  });

  it("includes ShopScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "ShopScene")).toBe(true);
  });

  it("includes ProgressScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "ProgressScene")).toBe(true);
  });

  it("has 9 scenes in the correct order", () => {
    expect(sceneClasses).toHaveLength(9);
    expect(sceneClasses.map((s) => s.name)).toEqual([
      "BootScene",
      "PreloadScene",
      "MainMenuScene",
      "BattleSetupScene",
      "AudioSettingsScene",
      "ProfileScene",
      "ProgressScene",
      "CosmeticsScene",
      "ShopScene",
    ]);
  });
});
