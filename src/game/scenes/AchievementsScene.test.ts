import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {
    registry = new Map<string, unknown>();
    add = {
      text: () => ({
        setOrigin: () => ({ setInteractive: () => ({ on: () => void 0 }) }),
        setInteractive: () => ({ on: () => void 0 }),
        setText: () => void 0,
        on: () => void 0,
        setAlpha: () => void 0,
      }),
    };
    scale = { width: 1280, height: 720 };
    scene = { start: () => void 0 };
    input = { keyboard: { on: () => void 0 } };
    textures = { exists: () => false };
  }
  return { default: { Scene }, Scene };
});

import { AchievementsScene } from "./AchievementsScene";

describe("AchievementsScene", () => {
  it("is a class", () => {
    expect(typeof AchievementsScene).toBe("function");
    expect(AchievementsScene.name).toBe("AchievementsScene");
  });

  it("can be instantiated without throwing", () => {
    const instance = new AchievementsScene();
    expect(instance).toBeInstanceOf(AchievementsScene);
  });
});
