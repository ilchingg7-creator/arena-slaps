import { describe, expect, it } from "vitest";
import {
  getNextPowerUpDefinition,
  powerUpDefinitions,
  type PowerUpEffect,
} from "./PowerUpSystem";

describe("PowerUpSystem", () => {
  it("defines three distinct power-up effects", () => {
    expect(powerUpDefinitions).toHaveLength(3);
    expect(powerUpDefinitions.map((definition) => definition.effect)).toEqual([
      "speed",
      "knockback",
      "shield",
    ] satisfies PowerUpEffect[]);
  });

  it("rotates power-up spawn definitions", () => {
    expect(getNextPowerUpDefinition(0)).toEqual(powerUpDefinitions[0]);
    expect(getNextPowerUpDefinition(3)).toEqual(powerUpDefinitions[0]);
    expect(getNextPowerUpDefinition(4)).toEqual(powerUpDefinitions[1]);
  });
});
