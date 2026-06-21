import { describe, expect, it, vi } from "vitest";

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
  it("starts with BootScene and includes MainMenuScene", () => {
    expect(sceneClasses[0].name).toBe("BootScene");
    expect(sceneClasses.some((scene) => scene.name === "MainMenuScene")).toBe(true);
  });

  it("includes BattleSetupScene and AudioSettingsScene", () => {
    expect(sceneClasses.some((scene) => scene.name === "BattleSetupScene")).toBe(true);
    expect(sceneClasses.some((scene) => scene.name === "AudioSettingsScene")).toBe(true);
  });

  it("has 5 scenes in the correct order", () => {
    expect(sceneClasses).toHaveLength(5);
    expect(sceneClasses.map((s) => s.name)).toEqual([
      "BootScene",
      "PreloadScene",
      "MainMenuScene",
      "BattleSetupScene",
      "AudioSettingsScene",
    ]);
  });
});
