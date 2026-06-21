import { describe, expect, it, vi } from "vitest";
import {
  consumeShieldHit,
  createPowerUpState,
  despawnPowerUp,
  expirePowerUpBoosts,
  getNextPowerUpDefinition,
  isDoubleSlapReady,
  isFrozen,
  isInDespawnWarning,
  isShieldActive,
  shouldBlink,
  shouldDespawnPowerUp,
  spawnPowerUp,
  tryCollectPowerUp,
  type PowerUpEffect,
  type PowerUpState,
} from "./PowerUpSystem";
import { POWERUP_DEFINITIONS } from "../config/powerUpConfig";
import { POWERUP_TIMINGS } from "../config/powerUpTimings";
import { POWERUP_SPRITE_KEYS } from "../sprites/PowerUpSprite";
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
    frozenUntil: 0,
    doubleSlapUntil: 0,
    sprite: { x, y, destroy: () => void 0 },
    ...overrides,
  } as unknown as ActorState;
}

type Definition = (typeof POWERUP_DEFINITIONS)[number];

/**
 * Stub an active power-up of the given effect directly into `state`
 * (bypassing spawnPowerUp) so collection / despawn tests don't have to
 * mock scene.add. The spawn time defaults to 0 — pass a non-zero
 * `spawnedAt` via the optional 4th arg when testing the despawn timer.
 */
function spawnAt(
  state: PowerUpState,
  effect: PowerUpEffect,
  x = 0,
  y = 0,
  spawnedAt = 0,
): void {
  const def = POWERUP_DEFINITIONS.find((d) => d.key === effect) as Definition;
  (state as unknown as {
    active: {
      definition: Definition;
      sprite: {
        x: number;
        y: number;
        destroy: () => void;
        setVisible: (visible: boolean) => void;
        setAlpha: (alpha: number) => void;
      };
      label: { destroy: () => void };
      spawnedAt: number;
    };
  }).active = {
    definition: def,
    sprite: {
      x,
      y,
      destroy: () => void 0,
      setVisible: () => void 0,
      setAlpha: () => void 0,
    },
    label: { destroy: () => void 0 },
    spawnedAt,
  };
}

function makeSceneAndArena() {
  return {
    scene: {
      add: {
        image: (x: number, y: number, _key: string) => ({
          destroy: () => void 0,
          setVisible: () => void 0,
          setAlpha: () => void 0,
          x,
          y,
        }),
        text: (
          _x: number,
          _y: number,
          _value: string,
          _style?: { color?: string; fontFamily?: string; fontSize?: string },
        ) => {
          const labelObj = {
            setOrigin: () => labelObj,
            destroy: () => void 0,
          };
          return labelObj;
        },
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

type TextStyle = { color?: string; fontFamily?: string; fontSize?: string };

/**
 * Stub scene that records every `add.image` / `add.text` call so tests can
 * assert how the power-up sprite and label were created.
 */
function makeRecordingSceneAndArena() {
  const textCalls: Array<{
    x: number;
    y: number;
    value: string;
    style?: TextStyle;
  }> = [];
  const imageCalls: Array<{
    x: number;
    y: number;
    key: string;
  }> = [];
  return {
    textCalls,
    imageCalls,
    scene: {
      add: {
        image: (x: number, y: number, key: string) => {
          imageCalls.push({ x, y, key });
          return {
            destroy: () => void 0,
            setVisible: () => void 0,
            setAlpha: () => void 0,
            x,
            y,
          };
        },
        text: (
          x: number,
          y: number,
          value: string,
          style?: TextStyle,
        ) => {
          textCalls.push({ x, y, value, style });
          const labelObj = {
            setOrigin: () => labelObj,
            destroy: () => void 0,
          };
          return labelObj;
        },
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
  it("exposes 6 power-up definitions via the config module", () => {
    expect(POWERUP_DEFINITIONS).toHaveLength(6);
  });

  it("rotates power-up spawn definitions through all 6", () => {
    expect(getNextPowerUpDefinition(0)).toEqual(POWERUP_DEFINITIONS[0]);
    expect(getNextPowerUpDefinition(3)).toEqual(POWERUP_DEFINITIONS[3]);
    expect(getNextPowerUpDefinition(4)).toEqual(POWERUP_DEFINITIONS[4]);
    expect(getNextPowerUpDefinition(6)).toEqual(POWERUP_DEFINITIONS[0]);
    expect(getNextPowerUpDefinition(11)).toEqual(POWERUP_DEFINITIONS[5]);
  });

  it("exposes the effect duration constants via POWERUP_TIMINGS", () => {
    expect(POWERUP_TIMINGS.speedBoostMs).toBe(8000);
    expect(POWERUP_TIMINGS.knockbackBoostMs).toBe(8000);
    expect(POWERUP_TIMINGS.shieldMs).toBe(5000);
    expect(POWERUP_TIMINGS.megaKnockbackBoostMs).toBe(4000);
    expect(POWERUP_TIMINGS.freezeMs).toBe(1500);
    expect(POWERUP_TIMINGS.doubleSlapMs).toBe(5000);
  });

  it("Boost description reflects the 8-second duration", () => {
    const boost = POWERUP_DEFINITIONS.find((d) => d.key === "speed")!;
    expect(boost.description).toBe("Move 35% faster for 8 seconds.");
  });

  it("Heavy Hand description reflects the 8-second duration", () => {
    const heavy = POWERUP_DEFINITIONS.find((d) => d.key === "knockback")!;
    expect(heavy.description).toBe("Heavier slap knockback for 8 seconds.");
  });

  it("Shield description reflects the 1-hit / 5-second behaviour", () => {
    const shield = POWERUP_DEFINITIONS.find((d) => d.key === "shield")!;
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
      expect(actor.speedBoostUntil).toBe(1000 + POWERUP_TIMINGS.speedBoostMs);
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
        1000 + POWERUP_TIMINGS.knockbackBoostMs,
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
      expect(actor.shieldUntil).toBe(1000 + POWERUP_TIMINGS.shieldMs);
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

  describe("tryCollectPowerUp (mega-knockback)", () => {
    it("sets knockbackMultiplier (1.75) and a knockbackBoostUntil expiry", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "mega-knockback");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.knockbackMultiplier).toBeCloseTo(1.75, 5);
      expect(actor.knockbackBoostUntil).toBe(
        1000 + POWERUP_TIMINGS.megaKnockbackBoostMs,
      );
    });

    it("expires the mega-knockback boost after the (shorter) duration", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "mega-knockback");
      tryCollectPowerUp(actor, state, 1000);
      expect(actor.knockbackMultiplier).toBeCloseTo(1.75, 5);

      // 5 seconds later (> 4s mega duration): boost should expire.
      expirePowerUpBoosts(actor, 6000);
      expect(actor.knockbackMultiplier).toBe(1);
      expect(actor.knockbackBoostUntil).toBe(0);
    });
  });

  describe("tryCollectPowerUp (freeze)", () => {
    it("sets frozenUntil = now + freezeMs", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "freeze");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.frozenUntil).toBe(1000 + POWERUP_TIMINGS.freezeMs);
      // Freeze does NOT touch knockback / speed multipliers.
      expect(actor.knockbackMultiplier).toBe(1);
      expect(actor.speedMultiplier).toBe(1);
      expect(actor.knockbackBoostUntil).toBe(0);
      expect(actor.speedBoostUntil).toBe(0);
    });
  });

  describe("tryCollectPowerUp (double-slap)", () => {
    it("sets doubleSlapUntil = now + doubleSlapMs", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "double-slap");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(actor.doubleSlapUntil).toBe(1000 + POWERUP_TIMINGS.doubleSlapMs);
      // Double-slap does NOT touch knockback / speed multipliers.
      expect(actor.knockbackMultiplier).toBe(1);
      expect(actor.speedMultiplier).toBe(1);
    });
  });

  describe("tryCollectPowerUp (collectDistance)", () => {
    it("collects when the actor is within POWERUP_TIMINGS.collectDistance", () => {
      // Position the actor exactly at the boundary — distance === collectDistance
      // should still collect (we use strict >).
      const within = POWERUP_TIMINGS.collectDistance - 1;
      const actor = mockActor(within, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");
      expect(tryCollectPowerUp(actor, state, 1000)).toBe(true);
    });

    it("collects when distance === collectDistance exactly (boundary inclusive)", () => {
      const actor = mockActor(POWERUP_TIMINGS.collectDistance, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");
      expect(tryCollectPowerUp(actor, state, 1000)).toBe(true);
    });

    it("does not collect when the actor is beyond collectDistance", () => {
      const beyond = POWERUP_TIMINGS.collectDistance + 5;
      const actor = mockActor(beyond, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");
      expect(tryCollectPowerUp(actor, state, 1000)).toBe(false);
      // State must remain untouched.
      expect(state.active).not.toBeNull();
    });

    it("does not collect when there is no active power-up", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      expect(tryCollectPowerUp(actor, state, 1000)).toBe(false);
    });
  });

  describe("tryCollectPowerUp (label cleanup)", () => {
    it("destroys the label when the power-up is collected", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      const labelDestroy = vi.fn();
      (state as unknown as {
        active: {
          definition: Definition;
          sprite: {
            x: number;
            y: number;
            destroy: () => void;
            setVisible: (visible: boolean) => void;
            setAlpha: (alpha: number) => void;
          };
          label: { destroy: () => void };
          spawnedAt: number;
        };
      }).active = {
        definition: POWERUP_DEFINITIONS.find(
          (d) => d.key === "speed",
        ) as Definition,
        sprite: {
          x: 0,
          y: 0,
          destroy: () => void 0,
          setVisible: () => void 0,
          setAlpha: () => void 0,
        },
        label: { destroy: labelDestroy },
        spawnedAt: 0,
      };

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      expect(labelDestroy).toHaveBeenCalledTimes(1);
      expect(state.active).toBeNull();
    });
  });

  describe("isFrozen", () => {
    it("returns true when now < frozenUntil", () => {
      const actor = mockActor(0, 0, { frozenUntil: 2000 });
      expect(isFrozen(actor, 1000)).toBe(true);
      expect(isFrozen(actor, 1999)).toBe(true);
    });

    it("returns false when now > frozenUntil", () => {
      const actor = mockActor(0, 0, { frozenUntil: 500 });
      expect(isFrozen(actor, 1000)).toBe(false);
    });

    it("returns false when frozenUntil is 0 (never frozen)", () => {
      const actor = mockActor(0, 0);
      expect(isFrozen(actor, 1000)).toBe(false);
    });
  });

  describe("isDoubleSlapReady", () => {
    it("returns true when now < doubleSlapUntil", () => {
      const actor = mockActor(0, 0, { doubleSlapUntil: 2000 });
      expect(isDoubleSlapReady(actor, 1000)).toBe(true);
      expect(isDoubleSlapReady(actor, 1999)).toBe(true);
    });

    it("returns false when now > doubleSlapUntil", () => {
      const actor = mockActor(0, 0, { doubleSlapUntil: 500 });
      expect(isDoubleSlapReady(actor, 1000)).toBe(false);
    });

    it("returns false when doubleSlapUntil is 0 (no double-slap queued)", () => {
      const actor = mockActor(0, 0);
      expect(isDoubleSlapReady(actor, 1000)).toBe(false);
    });
  });

  describe("shouldDespawnPowerUp", () => {
    it("returns false right after spawn", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 1000);
      // 1 ms after spawn — well within the 8s lifetime.
      expect(shouldDespawnPowerUp(state, 1001)).toBe(false);
    });

    it("returns false 1 ms before despawnAfterMs elapses", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 1000);
      expect(
        shouldDespawnPowerUp(state, 1000 + POWERUP_TIMINGS.despawnAfterMs - 1),
      ).toBe(false);
    });

    it("returns true after despawnAfterMs has elapsed", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 1000);
      expect(
        shouldDespawnPowerUp(state, 1000 + POWERUP_TIMINGS.despawnAfterMs),
      ).toBe(true);
    });

    it("returns true well after despawnAfterMs", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 1000);
      expect(
        shouldDespawnPowerUp(state, 1000 + POWERUP_TIMINGS.despawnAfterMs + 5000),
      ).toBe(true);
    });

    it("returns false when no active power-up", () => {
      const state = createPowerUpState();
      expect(shouldDespawnPowerUp(state, 99999)).toBe(false);
    });
  });

  describe("isInDespawnWarning", () => {
    it("returns false at spawn time (age = 0)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(isInDespawnWarning(state, 0)).toBe(false);
    });

    it("returns false at 5 seconds (before the warning window)", () => {
      // despawnAfterMs=8000, despawnWarningMs=2000 -> warning starts at 6000.
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(isInDespawnWarning(state, 5000)).toBe(false);
    });

    it("returns false just before the warning window opens", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      // warningStart = 8000 - 2000 = 6000. age = 5999 -> not yet warning.
      expect(isInDespawnWarning(state, 5999)).toBe(false);
    });

    it("returns true at 6 seconds (warning window just opened)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(isInDespawnWarning(state, 6000)).toBe(true);
    });

    it("returns true at 7 seconds (within the last 2 seconds)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(isInDespawnWarning(state, 7000)).toBe(true);
    });

    it("returns false at exactly despawnAfterMs (window is half-open)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(isInDespawnWarning(state, 8000)).toBe(false);
    });

    it("returns false when no active power-up", () => {
      const state = createPowerUpState();
      expect(isInDespawnWarning(state, 7000)).toBe(false);
    });
  });

  describe("shouldBlink", () => {
    it("returns false outside the warning window (sprite is fully visible)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(shouldBlink(state, 1000)).toBe(false);
      expect(shouldBlink(state, 5999)).toBe(false);
    });

    it("alternates visible/hidden every blinkIntervalMs during the warning window", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      // spawnedAt=0, warning window=[6000, 8000), blinkIntervalMs=200.
      // cycle = floor(age / 200). Visible when cycle is even.
      // age=6000 -> cycle=30 (even) -> visible (true)
      // age=6100 -> cycle=30 (even) -> visible (true)
      // age=6200 -> cycle=31 (odd)  -> hidden (false)
      // age=6300 -> cycle=31 (odd)  -> hidden (false)
      // age=6400 -> cycle=32 (even) -> visible (true)
      // age=7800 -> cycle=39 (odd)  -> hidden (false)
      // age=7900 -> cycle=39 (odd)  -> hidden (false)
      expect(shouldBlink(state, 6000)).toBe(true);
      expect(shouldBlink(state, 6100)).toBe(true);
      expect(shouldBlink(state, 6200)).toBe(false);
      expect(shouldBlink(state, 6300)).toBe(false);
      expect(shouldBlink(state, 6400)).toBe(true);
      expect(shouldBlink(state, 7800)).toBe(false);
      expect(shouldBlink(state, 7900)).toBe(false);
    });

    it("returns false once despawnAfterMs has been reached (outside window)", () => {
      const state = createPowerUpState();
      spawnAt(state, "speed", 0, 0, 0);
      expect(shouldBlink(state, 8000)).toBe(false);
      expect(shouldBlink(state, 10000)).toBe(false);
    });

    it("returns false when no active power-up", () => {
      const state = createPowerUpState();
      expect(shouldBlink(state, 7000)).toBe(false);
    });
  });

  describe("despawnPowerUp", () => {
    it("destroys the sprite + label and nulls state.active", () => {
      const state = createPowerUpState();
      const spriteDestroy = vi.fn();
      const labelDestroy = vi.fn();
      (state as unknown as {
        active: {
          definition: Definition;
          sprite: {
            x: number;
            y: number;
            destroy: () => void;
            setVisible: (visible: boolean) => void;
            setAlpha: (alpha: number) => void;
          };
          label: { destroy: () => void };
          spawnedAt: number;
        };
      }).active = {
        definition: POWERUP_DEFINITIONS[0],
        sprite: {
          x: 0,
          y: 0,
          destroy: spriteDestroy,
          setVisible: () => void 0,
          setAlpha: () => void 0,
        },
        label: { destroy: labelDestroy },
        spawnedAt: 0,
      };

      despawnPowerUp(state);
      expect(spriteDestroy).toHaveBeenCalledTimes(1);
      expect(labelDestroy).toHaveBeenCalledTimes(1);
      expect(state.active).toBeNull();
    });

    it("is a no-op when there is no active power-up", () => {
      const state = createPowerUpState();
      expect(() => despawnPowerUp(state)).not.toThrow();
      expect(state.active).toBeNull();
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

    it("sets spawnedAt to the current time (Date.now)", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeSceneAndArena();
      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(12345);
      spawnPowerUp(scene, state, arena, 16);
      nowSpy.mockRestore();

      expect(state.active).not.toBeNull();
      expect(state.active!.spawnedAt).toBe(12345);
    });

    it("uses all 5 spawn slots in rotation (positions match arena-relative slots)", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeRecordingSceneAndArena();
      const arenaWidth = arena.right - arena.left;
      const arenaHeight = arena.bottom - arena.top;
      const expectedPositions = POWERUP_TIMINGS.spawnSlots.map((slot) => ({
        x: arena.left + slot.x * arenaWidth,
        y: arena.top + slot.y * arenaHeight,
      }));

      const recorded: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 5; i++) {
        spawnPowerUp(scene, state, arena, 16);
        expect(state.active).not.toBeNull();
        recorded.push({
          x: state.active!.sprite.x,
          y: state.active!.sprite.y,
        });
        despawnPowerUp(state);
        expect(state.active).toBeNull();
      }

      expect(recorded).toEqual(expectedPositions);
    });

    it("wraps around to slot 0 on the 6th spawn", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeSceneAndArena();
      const arenaWidth = arena.right - arena.left;
      const arenaHeight = arena.bottom - arena.top;
      const slot0 = POWERUP_TIMINGS.spawnSlots[0];
      const expectedX = arena.left + slot0.x * arenaWidth;
      const expectedY = arena.top + slot0.y * arenaHeight;

      for (let i = 0; i < 5; i++) {
        spawnPowerUp(scene, state, arena, 16);
        despawnPowerUp(state);
      }
      // 6th spawn should wrap back to slot 0.
      spawnPowerUp(scene, state, arena, 16);
      expect(state.active).not.toBeNull();
      expect(state.active!.sprite.x).toBeCloseTo(expectedX, 5);
      expect(state.active!.sprite.y).toBeCloseTo(expectedY, 5);
    });

    describe("label rendering", () => {
      it("calls scene.add.text with the definition's label text and a readable style", () => {
        const state = createPowerUpState();
        const { scene, arena, textCalls } = makeRecordingSceneAndArena();
        spawnPowerUp(scene, state, arena, 16);

        expect(state.active).not.toBeNull();
        expect(textCalls).toHaveLength(1);
        expect(textCalls[0].value).toBe(state.active!.definition.label);
        // Readable styling: off-white text, Arial, 14px.
        expect(textCalls[0].style).toEqual({
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "14px",
        });
      });

      it("positions the label above the sprite using POWERUP_TIMINGS.labelOffsetY", () => {
        const state = createPowerUpState();
        const { scene, arena, textCalls, imageCalls } =
          makeRecordingSceneAndArena();
        const size = 20;
        spawnPowerUp(scene, state, arena, size);

        expect(imageCalls).toHaveLength(1);
        expect(textCalls).toHaveLength(1);
        const { x: imageX, y: imageY } = imageCalls[0];
        expect(textCalls[0].x).toBe(imageX);
        // The label is offset vertically by POWERUP_TIMINGS.labelOffsetY
        // (NOT the legacy `- size - 14` formula).
        expect(textCalls[0].y).toBe(imageY + POWERUP_TIMINGS.labelOffsetY);
      });

      it("sets a label field with a destroy() method on state.active after spawning", () => {
        const state = createPowerUpState();
        const { scene, arena } = makeRecordingSceneAndArena();
        spawnPowerUp(scene, state, arena, 16);

        expect(state.active).not.toBeNull();
        expect(state.active).toHaveProperty("label");
        expect(typeof state.active!.label.destroy).toBe("function");
      });

      it("rotates through all 6 power-up definitions as spawnIndex advances", () => {
        const state = createPowerUpState();
        const { scene, arena, textCalls } = makeRecordingSceneAndArena();

        for (let i = 0; i < 6; i++) {
          spawnPowerUp(scene, state, arena, 16);
          despawnPowerUp(state);
        }
        // Each spawn's label should match the rotation order.
        expect(textCalls.map((c) => c.value)).toEqual(
          POWERUP_DEFINITIONS.map((d) => d.label),
        );
      });
    });

    describe("sprite creation", () => {
      it("calls scene.add.image (NOT scene.add.circle) to create the sprite", () => {
        const state = createPowerUpState();
        const { scene, arena, imageCalls } = makeRecordingSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        expect(imageCalls).toHaveLength(1);
        expect(state.active).not.toBeNull();
        expect(state.active!.sprite).toBeDefined();
        expect(typeof state.active!.sprite.destroy).toBe("function");
      });

      it("uses the per-type sprite key (powerup-<effect>) from POWERUP_SPRITE_KEYS", () => {
        const state = createPowerUpState();
        const { scene, arena, imageCalls } = makeRecordingSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        // First spawn is the "speed" definition (index 0) → key "powerup-speed".
        expect(imageCalls[0].key).toBe("powerup-speed");
        expect(imageCalls[0].key).toBe(POWERUP_SPRITE_KEYS.speed);
      });

      it("rotates through all 6 per-type sprite keys as spawnIndex advances", () => {
        const state = createPowerUpState();
        const { scene, arena, imageCalls } = makeRecordingSceneAndArena();

        for (let i = 0; i < 6; i++) {
          spawnPowerUp(scene, state, arena, 16);
          despawnPowerUp(state);
        }

        expect(imageCalls.map((c) => c.key)).toEqual([
          "powerup-speed",
          "powerup-knockback",
          "powerup-shield",
          "powerup-mega-knockback",
          "powerup-freeze",
          "powerup-double-slap",
        ]);
      });

      it("the sprite has setVisible + setAlpha methods (for blink / collected flash)", () => {
        const state = createPowerUpState();
        const { scene, arena } = makeSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        expect(state.active).not.toBeNull();
        expect(typeof state.active!.sprite.setVisible).toBe("function");
        expect(typeof state.active!.sprite.setAlpha).toBe("function");
      });
    });
  });
});

// Ensure PowerUpState import is used in type position (sanity).
type _Unused = PowerUpState;
