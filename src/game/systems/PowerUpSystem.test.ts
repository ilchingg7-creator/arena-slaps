import { describe, expect, it } from "vitest";
import {
  consumeShieldHit,
  createPowerUpState,
  expirePowerUpBoosts,
  getNextPowerUpDefinition,
  isShieldActive,
  powerUpDefinitions,
  powerUpDurations,
  spawnPowerUp,
  tryCollectPowerUp,
  type PowerUpEffect,
  type PowerUpState,
} from "./PowerUpSystem";
import type { ActorState } from "../entities/Player";

function mockActor(
  x: number,
  y: number,
  overrides: Partial<ActorState> = {},
): ActorState {
  return {
    body: { setVelocity: () => void 0 },
    facing: { x: 1, y: 0 },
    knockbackSpeed: 560,
    knockbackMultiplier: 1,
    knockbackUntil: 0,
    knockbackBoostUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 260,
    size: 36,
    slapRange: 84,
    spawn: { x, y },
    speedMultiplier: 1,
    speedBoostUntil: 0,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    sprite: { x, y, destroy: () => void 0 },
    ...overrides,
  } as unknown as ActorState;
}

type Definition = (typeof powerUpDefinitions)[number];

function spawnAt(
  state: PowerUpState,
  effect: PowerUpEffect,
  x = 0,
  y = 0,
): void {
  const def = powerUpDefinitions.find((d) => d.effect === effect) as Definition;
  (state as unknown as {
    active: { definition: Definition; sprite: { x: number; y: number; destroy: () => void } };
  }).active = {
    definition: def,
    sprite: { x, y, destroy: () => void 0 },
  };
}

function makeSceneAndArena() {
  return {
    scene: {
      add: {
        circle: (x: number, y: number, _s: number, _c: number) => ({
          destroy: () => void 0,
          x,
          y,
        }),
      },
    },
    arena: {
      bottom: 500,
      centerX: 0,
      centerY: 0,
      left: -100,
      right: 100,
      top: 0,
    },
  };
}

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

  it("exposes the new effect duration constants", () => {
    expect(powerUpDurations.speedMs).toBe(8000);
    expect(powerUpDurations.knockbackMs).toBe(8000);
    expect(powerUpDurations.shieldMs).toBe(5000);
  });

  it("updates Boost description to reflect the 8-second duration", () => {
    const boost = powerUpDefinitions.find((d) => d.effect === "speed")!;
    expect(boost.description).toBe("Move 35% faster for 8 seconds.");
  });

  it("updates Heavy Hand description to reflect the 8-second duration", () => {
    const heavy = powerUpDefinitions.find((d) => d.effect === "knockback")!;
    expect(heavy.description).toBe("Heavier slap knockback for 8 seconds.");
  });

  it("updates Shield description to reflect the 1-hit / 5-second behaviour", () => {
    const shield = powerUpDefinitions.find((d) => d.effect === "shield")!;
    expect(shield.description).toBe("Block the next slap within 5 seconds.");
  });

  describe("tryCollectPowerUp (speed)", () => {
    it("sets speedMultiplier and a speedBoostUntil expiry", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.speedMultiplier).toBeCloseTo(1.35, 5);
      expect(actor.speedBoostUntil).toBe(1000 + powerUpDurations.speedMs);
    });

    it("expires the speed boost after the duration elapses", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");
      tryCollectPowerUp(actor, state, 1000);
      expect(actor.speedMultiplier).toBeCloseTo(1.35, 5);

      // 9 seconds later (> 8s duration): boost should expire.
      expirePowerUpBoosts(actor, 10000);
      expect(actor.speedMultiplier).toBe(1);
      expect(actor.speedBoostUntil).toBe(0);
    });

    it("does not expire the speed boost before the duration elapses", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");
      tryCollectPowerUp(actor, state, 1000);

      // 7 seconds later (< 8s duration): boost should still be active.
      expirePowerUpBoosts(actor, 8000);
      expect(actor.speedMultiplier).toBeCloseTo(1.35, 5);
    });
  });

  describe("tryCollectPowerUp (knockback)", () => {
    it("sets knockbackMultiplier and a knockbackBoostUntil expiry", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "knockback");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.knockbackMultiplier).toBeCloseTo(1.25, 5);
      expect(actor.knockbackBoostUntil).toBe(
        1000 + powerUpDurations.knockbackMs,
      );
    });

    it("expires the knockback boost after the duration elapses", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "knockback");
      tryCollectPowerUp(actor, state, 1000);

      expirePowerUpBoosts(actor, 10000); // 9s later, > 8s duration
      expect(actor.knockbackMultiplier).toBe(1);
      expect(actor.knockbackBoostUntil).toBe(0);
    });
  });

  describe("tryCollectPowerUp (shield)", () => {
    it("sets shieldHitsRemaining=1 and a shieldUntil expiry", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "shield");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.shieldHitsRemaining).toBe(1);
      expect(actor.shieldUntil).toBe(1000 + powerUpDurations.shieldMs);
    });

    it("isShieldActive is false when 0 hits remaining", () => {
      const actor = mockActor(0, 0, {
        shieldHitsRemaining: 0,
        shieldUntil: 99999,
      });
      expect(isShieldActive(actor, 1000)).toBe(false);
    });

    it("isShieldActive is false when the shield has expired", () => {
      const actor = mockActor(0, 0, {
        shieldHitsRemaining: 1,
        shieldUntil: 500,
      });
      expect(isShieldActive(actor, 1000)).toBe(false);
    });

    it("isShieldActive is true when hits remain and shield has not expired", () => {
      const actor = mockActor(0, 0, {
        shieldHitsRemaining: 1,
        shieldUntil: 99999,
      });
      expect(isShieldActive(actor, 1000)).toBe(true);
    });

    it("consumeShieldHit decrements shieldHitsRemaining", () => {
      const actor = mockActor(0, 0, {
        shieldHitsRemaining: 1,
        shieldUntil: 99999,
      });
      expect(isShieldActive(actor, 1000)).toBe(true);
      consumeShieldHit(actor);
      expect(actor.shieldHitsRemaining).toBe(0);
      expect(isShieldActive(actor, 1000)).toBe(false);
    });

    it("shield blocks exactly one slap then is consumed", () => {
      // Simulate the applySlap flow: isShieldActive -> consumeShieldHit -> not active.
      const actor = mockActor(0, 0, {
        shieldHitsRemaining: 1,
        shieldUntil: 99999,
      });
      // First slap: shield is active, gets consumed.
      expect(isShieldActive(actor, 1000)).toBe(true);
      consumeShieldHit(actor);
      // Second slap at the same instant: shield is gone.
      expect(isShieldActive(actor, 1000)).toBe(false);
    });
  });

  describe("spawnPowerUp", () => {
    it("does nothing when a power-up is already active", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeSceneAndArena();
      spawnPowerUp(scene, state, arena, 16);
      const firstActive = state.active;
      spawnPowerUp(scene, state, arena, 16);
      expect(state.active).toBe(firstActive);
    });
  });
});

// Ensure PowerUpState import is used in type position (sanity).
type _Unused = PowerUpState;
