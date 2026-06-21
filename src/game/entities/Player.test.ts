import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time, which doesn't exist under the node
// test environment. We only need the pure `computeMaxVelocity` helper from
// Player.ts, so stub Phaser out entirely for this test file.
vi.mock("phaser", () => ({}));

import { computeMaxVelocity, type ActorConfig } from "./Player";

const baseConfig: ActorConfig = {
  color: 0x3d405b,
  knockbackSpeed: 560,
  slapRange: 84,
  size: 36,
  speed: 260,
};

describe("computeMaxVelocity", () => {
  it("is at least knockbackSpeed * 1.5 so knockback is not capped", () => {
    const max = computeMaxVelocity(baseConfig);
    expect(max).toBeGreaterThanOrEqual(baseConfig.knockbackSpeed * 1.5);
  });

  it("is at least speed * 2 so normal movement is not capped", () => {
    const max = computeMaxVelocity(baseConfig);
    expect(max).toBeGreaterThanOrEqual(baseConfig.speed * 2);
  });

  it("picks the larger headroom value (player config: 840)", () => {
    // For the player config: speed*2 = 520, knockbackSpeed*1.5 = 840 -> 840
    expect(computeMaxVelocity(baseConfig)).toBe(840);
  });

  it("picks the larger headroom value (bot-like config: speed*2 wins)", () => {
    const botConfig: ActorConfig = {
      color: 0xe07a5f,
      knockbackSpeed: 200,
      slapRange: 74,
      size: 36,
      speed: 260,
    };
    // speed*2 = 520, knockbackSpeed*1.5 = 300 -> 520
    expect(computeMaxVelocity(botConfig)).toBe(520);
  });
});
