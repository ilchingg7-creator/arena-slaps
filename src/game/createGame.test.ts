import { describe, expect, it } from "vitest";
import { gameConfig } from "./gameConfig";

describe("gameConfig", () => {
  it("defines the Phaser boot config", () => {
    expect(gameConfig.width).toBeGreaterThan(0);
    expect(gameConfig.height).toBeGreaterThan(0);
    expect(Array.isArray(gameConfig.scene)).toBe(true);
  });
});
