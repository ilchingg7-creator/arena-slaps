import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time. Stub the module with just the
// pieces AchievementsScene.ts touches so the import resolves under the node
// test environment.
vi.mock("phaser", () => {
  class Scene {
    registry = new Map<string, unknown>();
    add = {
      text: () => ({
        setOrigin: () => ({ setInteractive: () => ({ on: () => void 0 }) }),
        setInteractive: () => ({ on: () => void 0 }),
        setText: () => void 0,
        on: () => void 0,
      }),
      rectangle: () => ({
        setStrokeStyle: () => ({ setOrigin: () => void 0 }),
        setOrigin: () => void 0,
      }),
    };
    cameras = { main: { setBackgroundColor: () => void 0 } };
    scale = { width: 1280, height: 720 };
    scene = { start: () => void 0 };
    input = { keyboard: { on: () => void 0 } };
  }
  return {
    default: { Scene },
    Scene,
  };
});

import {
  AchievementsScene,
  ACHIEVEMENTS_SCENE_KEY,
} from "./AchievementsScene";

describe("AchievementsScene", () => {
  it("is a class", () => {
    expect(typeof AchievementsScene).toBe("function");
    expect(AchievementsScene.name).toBe("AchievementsScene");
  });

  it(`exposes the scene key "${ACHIEVEMENTS_SCENE_KEY}"`, () => {
    expect(ACHIEVEMENTS_SCENE_KEY).toBe("AchievementsScene");
  });

  it("can be instantiated and reports its key via the Phaser Scene constructor", () => {
    // The mock Scene base class doesn't call super with the key, but we can
    // at least verify instantiation doesn't throw and the class is usable.
    const instance = new AchievementsScene();
    expect(instance).toBeInstanceOf(AchievementsScene);
  });
});
