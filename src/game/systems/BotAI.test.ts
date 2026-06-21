import { describe, expect, it } from "vitest";
import type { ActorState } from "../entities/Player";
import type { PowerUpState } from "./PowerUpSystem";
import {
  computeBotDirection,
  computeRawBotDirection,
  createBotAI,
  getDifficultyParams,
  shouldBotSlap,
} from "./BotAI";

function mockActor(
  x: number,
  y: number,
  overrides: Partial<ActorState> = {},
): ActorState {
  return {
    body: {},
    facing: { x: 1, y: 0 },
    knockbackSpeed: 500,
    knockbackMultiplier: 1,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 250,
    size: 36,
    slapRange: 84,
    spawn: { x, y },
    speedMultiplier: 1,
    shieldedUntil: 0,
    sprite: { x, y },
    ...overrides,
  } as unknown as ActorState;
}

function mockPowerUpState(
  active: false,
): PowerUpState;
function mockPowerUpState(
  active: true,
  x: number,
  y: number,
): PowerUpState;
function mockPowerUpState(
  active: boolean,
  x = 0,
  y = 0,
): PowerUpState {
  if (!active) {
    return { active: null, spawnIndex: 0 } as unknown as PowerUpState;
  }
  return {
    active: {
      definition: {
        color: 0x81b29a,
        description: "",
        effect: "speed",
        label: "Boost",
        speedMultiplier: 1.35,
      },
      sprite: { x, y },
    },
    spawnIndex: 0,
  } as unknown as PowerUpState;
}

describe("BotAI", () => {
  it("creates state with zeroed timers and zeroed currentDir", () => {
    const ai = createBotAI("medium");
    expect(ai.difficulty).toBe("medium");
    expect(ai.lastDodgeAt).toBe(0);
    expect(ai.lastPlayerAttackSeenAt).toBe(0);
    expect(ai.lastSlapAttemptAt).toBe(0);
    expect(ai.currentDir).toEqual({ x: 0, y: 0 });
  });

  it("exposes distinct difficulty parameters", () => {
    const easy = getDifficultyParams("easy");
    const medium = getDifficultyParams("medium");
    const hard = getDifficultyParams("hard");

    expect(easy.dodgeChance).toBeLessThan(medium.dodgeChance);
    expect(medium.dodgeChance).toBeLessThan(hard.dodgeChance);
    expect(easy.slapIntervalMs).toBeGreaterThan(medium.slapIntervalMs);
    expect(medium.slapIntervalMs).toBeGreaterThan(hard.slapIntervalMs);
    expect(easy.reactionMs).toBeGreaterThan(medium.reactionMs);
    expect(medium.reactionMs).toBeGreaterThan(hard.reactionMs);
  });

  it("computeRawBotDirection moves toward the player by default", () => {
    const bot = mockActor(0, 0);
    const player = mockActor(100, 0);
    const ai = createBotAI("medium");
    const dir = computeRawBotDirection(
      bot,
      player,
      mockPowerUpState(false),
      ai,
      1000,
    );
    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
  });

  it("computeRawBotDirection dodges perpendicular when player just attacked in range", () => {
    const bot = mockActor(100, 0);
    const player = mockActor(100, 60, {
      lastAttackAt: 1500,
      slapRange: 84,
    });
    const ai = createBotAI("hard");
    ai.lastPlayerAttackSeenAt = 0;

    // Force dodge: random < dodgeChance (0.95 for hard) and random for sign
    let calls = 0;
    const stubRandom = () => {
      const v = [0.0, 0.0][calls++] ?? 0;
      return v;
    };
    const dir = computeRawBotDirection(
      bot,
      player,
      mockPowerUpState(false),
      ai,
      1500,
      stubRandom,
    );
    // Player is straight below (dx=0, dy=-60). Perpendicular is (60, 0) -> normalize (1, 0)
    // With sign=+1 (random returns 0 -> <0.5 -> +1)
    expect(Math.abs(dir.x)).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
    expect(ai.lastDodgeAt).toBe(1500);
    expect(ai.lastPlayerAttackSeenAt).toBe(1500);
  });

  it("computeRawBotDirection does not dodge when player attack is out of range", () => {
    const bot = mockActor(0, 0);
    const player = mockActor(500, 500, { lastAttackAt: 1500, slapRange: 84 });
    const ai = createBotAI("hard");
    ai.lastPlayerAttackSeenAt = 0;
    const dir = computeRawBotDirection(
      bot,
      player,
      mockPowerUpState(false),
      ai,
      1500,
      () => 0.0,
    );
    // Falls through to move-toward-player
    const expected = Math.SQRT1_2;
    expect(dir.x).toBeCloseTo(expected, 5);
    expect(dir.y).toBeCloseTo(expected, 5);
  });

  it("computeRawBotDirection moves toward an active power-up when beneficial", () => {
    const bot = mockActor(0, 0);
    const player = mockActor(300, 0);
    const powerUp = mockPowerUpState(true, 100, 0);
    const ai = createBotAI("medium");
    const dir = computeRawBotDirection(
      bot,
      player,
      powerUp,
      ai,
      1000,
      () => 0.0,
    );
    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
  });

  it("computeRawBotDirection ignores power-up when player is closer to it", () => {
    const bot = mockActor(0, 0);
    const player = mockActor(50, 0);
    const powerUp = mockPowerUpState(true, 100, 0);
    const ai = createBotAI("medium");
    const dir = computeRawBotDirection(
      bot,
      player,
      powerUp,
      ai,
      1000,
      () => 0.0,
    );
    // Falls through to move toward player (toward x=50)
    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
  });

  it("computeBotDirection returns the raw direction on the first call (no smoothing yet)", () => {
    const bot = mockActor(0, 0);
    const player = mockActor(100, 0);
    const ai = createBotAI("medium");
    const dir = computeBotDirection(
      bot,
      player,
      mockPowerUpState(false),
      ai,
      1000,
    );
    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
  });

  it("computeBotDirection smooths transitions between frames", () => {
    const bot = mockActor(0, 0);
    const ai = createBotAI("medium");

    // First call: player to the right -> currentDir = (1, 0)
    const player1 = mockActor(100, 0);
    computeBotDirection(bot, player1, mockPowerUpState(false), ai, 1000);

    // Second call: player straight up -> raw target = (0, -1)
    // With smoothing 0.3, currentDir becomes (0.7, -0.3) before normalization,
    // then normalized to (0.919, -0.394). Confirm it's NOT exactly (0, -1).
    const player2 = mockActor(0, -100);
    const dir = computeBotDirection(
      bot,
      player2,
      mockPowerUpState(false),
      ai,
      1100,
    );
    expect(dir.x).toBeGreaterThan(0.5);
    expect(dir.x).toBeLessThan(1);
    expect(dir.y).toBeLessThan(0);
    expect(dir.y).toBeGreaterThan(-1);
  });

  it("does not slap when out of range", () => {
    const bot = mockActor(0, 0, { slapRange: 50 });
    const player = mockActor(500, 500);
    const ai = createBotAI("medium");
    expect(shouldBotSlap(bot, player, ai, 1000)).toBe(false);
  });

  it("does not slap during the interval after the last attempt", () => {
    const bot = mockActor(0, 0, { slapRange: 100 });
    const player = mockActor(50, 0);
    const ai = createBotAI("medium");
    ai.lastSlapAttemptAt = 900;
    // Medium interval = 500ms, so at 1000ms only 100ms has passed -> false
    expect(shouldBotSlap(bot, player, ai, 1000)).toBe(false);
  });

  it("slaps when in range and interval has passed", () => {
    const bot = mockActor(0, 0, { slapRange: 100 });
    const player = mockActor(50, 0);
    const ai = createBotAI("medium");
    ai.lastSlapAttemptAt = 0;
    expect(shouldBotSlap(bot, player, ai, 600)).toBe(true);
    expect(ai.lastSlapAttemptAt).toBe(600);
  });
});
