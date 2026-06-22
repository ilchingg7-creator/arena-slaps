import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time. The ProgressionScene module
// imports Phaser transitively, so stub it out for the node test
// environment. We provide a minimal Scene base class whose constructor
// records the key passed to super() so we can assert the scene key
// without booting Phaser.
vi.mock("phaser", () => {
  class Scene {
    name: string;
    constructor(key: string) {
      this.name = key;
    }
  }
  return { default: { Scene }, Scene };
});

import { ProgressionScene } from "./ProgressionScene";

describe("ProgressionScene", () => {
  it("is a class that extends Phaser.Scene", () => {
    expect(typeof ProgressionScene).toBe("function");
    // Prototype chain must include the mock Scene base class.
    expect(ProgressionScene.prototype).toBeInstanceOf(Object);
    expect(Object.getPrototypeOf(ProgressionScene).name).toBe("Scene");
  });

  it('registers itself under the key "ProgressionScene"', () => {
    const instance = new ProgressionScene() as unknown as { name: string };
    expect(instance.name).toBe("ProgressionScene");
  });

  it("can be constructed without throwing", () => {
    expect(() => new ProgressionScene()).not.toThrow();
  });
});
