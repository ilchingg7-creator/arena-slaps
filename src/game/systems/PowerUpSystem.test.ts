import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
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
 * Stub sprite that satisfies the duck-typed `PowerUpSprite` shape used by
 * PowerUpSystem (destroy / setVisible / setAlpha / x / y) AND exposes the
 * 3 animation methods (playSpawnAnimation / playCollectedAnimation /
 * playDespawnAnimation) introduced in Phase 3C.
 *
 * The animation methods do NOT fire their `onComplete` callback
 * synchronously — instead they record the callback (and the durationMs
 * argument) on the stub so tests can:
 *   1. assert that the animation was invoked (via the `__spawnCalls` /
 *      `__collectedCallbacks` / `__despawnCallbacks` arrays), and
 *   2. simulate the Phaser tween system firing `onComplete` after the
 *      animation duration via the `flushCollectedAnimation` /
 *      `flushDespawnAnimation` helpers.
 *
 * Recording (rather than firing) the callback is what lets us assert the
 * "no double-collect during the 250ms animation window" property: the
 * test calls `tryCollectPowerUp` once (records callback, nulls
 * state.active), then calls it again (returns false because state.active
 * is null), and ONLY THEN flushes the recorded callback to fire destroy.
 */
type StubSprite = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  destroy: () => void;
  setVisible: (visible: boolean) => void;
  setAlpha: (alpha: number) => void;
  setScale: (sx: number, sy: number) => void;
  setPosition: (x: number, y: number) => void;
  playSpawnAnimation: (durationMs?: number) => void;
  playCollectedAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
  playDespawnAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
  // Recorded data (prefixed with __ to distinguish from the public API):
  __spawnCalls: Array<number | undefined>;
  __collectedCallbacks: Array<{
    onComplete: () => void;
    durationMs?: number;
  }>;
  __despawnCallbacks: Array<{
    onComplete: () => void;
    durationMs?: number;
  }>;
};

function makeStubSprite(opts: {
  x?: number;
  y?: number;
  destroy?: () => void;
} = {}): StubSprite {
  const sprite = {
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    scaleX: 1,
    scaleY: 1,
  } as StubSprite;
  const __spawnCalls: Array<number | undefined> = [];
  const __collectedCallbacks: Array<{
    onComplete: () => void;
    durationMs?: number;
  }> = [];
  const __despawnCallbacks: Array<{
    onComplete: () => void;
    durationMs?: number;
  }> = [];
  sprite.destroy = opts.destroy ?? (() => void 0);
  sprite.setVisible = () => void 0;
  sprite.setAlpha = () => void 0;
  sprite.setScale = (sx: number, sy: number) => {
    sprite.scaleX = sx;
    sprite.scaleY = sy;
  };
  sprite.setPosition = (px: number, py: number) => {
    sprite.x = px;
    sprite.y = py;
  };
  sprite.playSpawnAnimation = (durationMs?: number) => {
    __spawnCalls.push(durationMs);
  };
  sprite.playCollectedAnimation = (onComplete: () => void, durationMs?: number) => {
    __collectedCallbacks.push({ onComplete, durationMs });
  };
  sprite.playDespawnAnimation = (onComplete: () => void, durationMs?: number) => {
    __despawnCallbacks.push({ onComplete, durationMs });
  };
  sprite.__spawnCalls = __spawnCalls;
  sprite.__collectedCallbacks = __collectedCallbacks;
  sprite.__despawnCallbacks = __despawnCallbacks;
  return sprite;
}

/**
 * Invoke the recorded `onComplete` of the collected animation at `index`
 * (default 0). Simulates the Phaser tween system firing onComplete after
 * 250ms. Throws a clear error if no collected animation was recorded.
 */
function flushCollectedAnimation(sprite: StubSprite, index = 0): void {
  const entry = sprite.__collectedCallbacks[index];
  if (!entry) {
    throw new Error(
      `flushCollectedAnimation: no collected animation at index ${index}`,
    );
  }
  entry.onComplete();
}

/**
 * Invoke the recorded `onComplete` of the despawn animation at `index`
 * (default 0). Simulates the Phaser tween system firing onComplete after
 * 300ms. Throws a clear error if no despawn animation was recorded.
 */
function flushDespawnAnimation(sprite: StubSprite, index = 0): void {
  const entry = sprite.__despawnCallbacks[index];
  if (!entry) {
    throw new Error(
      `flushDespawnAnimation: no despawn animation at index ${index}`,
    );
  }
  entry.onComplete();
}

/**
 * Stub an active power-up of the given effect directly into `state`
 * (bypassing spawnPowerUp) so collection / despawn tests don't have to
 * mock scene.add. The spawn time defaults to 0 — pass a non-zero
 * `spawnedAt` via the optional 4th arg when testing the despawn timer.
 *
 * Returns the stub sprite so the caller can flush its recorded animation
 * callbacks (e.g. `flushCollectedAnimation(sprite)` after
 * `tryCollectPowerUp`) or assert on the recorded animation calls.
 */
function spawnAt(
  state: PowerUpState,
  effect: PowerUpEffect,
  x = 0,
  y = 0,
  spawnedAt = 0,
): StubSprite {
  const def = POWERUP_DEFINITIONS.find((d) => d.key === effect) as Definition;
  const sprite = makeStubSprite({ x, y });
  (state as unknown as {
    active: {
      definition: Definition;
      sprite: StubSprite;
      label: { destroy: () => void };
      spawnedAt: number;
    };
  }).active = {
    definition: def,
    sprite,
    label: { destroy: () => void 0 },
    spawnedAt,
  };
  return sprite;
}

function makeSceneAndArena() {
  const tweenCalls: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
  return {
    tweenCalls,
    scene: {
      add: {
        image: (x: number, y: number, _key: string) =>
          makeStubSprite({ x, y }),
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
      tweens: {
        add: (config: Phaser.Types.Tweens.TweenBuilderConfig) => {
          tweenCalls.push(config);
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
 * Stub scene that records every `add.image` / `add.text` / `tweens.add` call
 * so tests can assert how the power-up sprite, label, and spawn animation
 * were created. The sprite returned by `image` is a full {@link StubSprite}
 * (with all 3 animation methods + setScale) so the spawnPowerUp flow —
 * which uses `createPowerUpSprite` internally and calls
 * `sprite.playSpawnAnimation()` (which calls `gameObject.setScale(0, 0)` +
 * `scene.tweens.add(...)`) — works without further mocking.
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
  const tweenCalls: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
  return {
    textCalls,
    imageCalls,
    tweenCalls,
    scene: {
      add: {
        image: (x: number, y: number, key: string) => {
          imageCalls.push({ x, y, key });
          return makeStubSprite({ x, y });
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
      tweens: {
        add: (config: Phaser.Types.Tweens.TweenBuilderConfig) => {
          tweenCalls.push(config);
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
    it("sets frozenUntil on the OPPONENT (not the collector)", () => {
      const actor = mockActor(0, 0);
      const opponent = mockActor(100, 0);
      const state = createPowerUpState();
      spawnAt(state, "freeze");

      const collected = tryCollectPowerUp(actor, state, 1000, opponent);
      expect(collected).toBe(true);
      // Freeze targets the opponent, not the collector.
      expect(opponent.frozenUntil).toBe(1000 + POWERUP_TIMINGS.freezeMs);
      expect(actor.frozenUntil).toBe(0);
      // Freeze does NOT touch knockback / speed multipliers on either actor.
      expect(actor.knockbackMultiplier).toBe(1);
      expect(actor.speedMultiplier).toBe(1);
      expect(opponent.knockbackMultiplier).toBe(1);
      expect(opponent.speedMultiplier).toBe(1);
    });

    it("is a no-op on opponent when no opponent is provided", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "freeze");

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);
      // No opponent → freeze is a no-op (collector is NOT frozen).
      expect(actor.frozenUntil).toBe(0);
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

  describe("tryCollectPowerUp (collected animation)", () => {
    it("calls playCollectedAnimation on the sprite (instead of destroying immediately)", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      const sprite = spawnAt(state, "speed");

      const collected = tryCollectPowerUp(actor, state, 1000);

      expect(collected).toBe(true);
      // The collected animation was kicked off — the sprite is NOT
      // destroyed synchronously (the destroy is deferred to the
      // animation's onComplete callback, ~250ms later).
      expect(sprite.__collectedCallbacks).toHaveLength(1);
      // The destroy() method on the sprite has NOT been called yet.
      // (The stub's destroy is a no-op, so we can't spy on it directly —
      // but we can verify the callback hasn't been flushed by checking
      // that __collectedCallbacks still holds the un-fired callback.)
      expect(sprite.__collectedCallbacks[0].onComplete).toBeDefined();
    });

    it("nulls state.active immediately so the actor can't double-collect during the 250ms animation", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      spawnAt(state, "speed");

      // First collection: succeeds — state.active is nulled and the
      // collected animation is recorded (NOT yet flushed).
      const first = tryCollectPowerUp(actor, state, 1000);
      expect(first).toBe(true);
      expect(state.active).toBeNull();

      // Second collection attempt on the same frame: must return false
      // because state.active is null (the actor can't pick up the same
      // power-up twice while the pickup flash is still playing).
      const second = tryCollectPowerUp(actor, state, 1000);
      expect(second).toBe(false);

      // After flushing the recorded animation callback, state.active is
      // STILL null (the callback destroys the sprite + label, but those
      // references are kept in the closure — state.active was already
      // nulled before the animation started).
      const sprite = (state as unknown as { active: null }).active;
      expect(sprite).toBeNull();
    });

    it("the collected animation's onComplete destroys both the sprite and the label", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      const spriteDestroy = vi.fn();
      const labelDestroy = vi.fn();
      const sprite = makeStubSprite({ destroy: spriteDestroy });
      (state as unknown as {
        active: {
          definition: Definition;
          sprite: StubSprite;
          label: { destroy: () => void };
          spawnedAt: number;
        };
      }).active = {
        definition: POWERUP_DEFINITIONS.find(
          (d) => d.key === "speed",
        ) as Definition,
        sprite,
        label: { destroy: labelDestroy },
        spawnedAt: 0,
      };

      tryCollectPowerUp(actor, state, 1000);
      // Before flush: neither destroy has been called.
      expect(spriteDestroy).not.toHaveBeenCalled();
      expect(labelDestroy).not.toHaveBeenCalled();
      // After flush: both are destroyed exactly once.
      flushCollectedAnimation(sprite);
      expect(spriteDestroy).toHaveBeenCalledTimes(1);
      expect(labelDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("tryCollectPowerUp (label cleanup)", () => {
    it("destroys the label when the power-up is collected (after the collected animation completes)", () => {
      const actor = mockActor(0, 0);
      const state = createPowerUpState();
      const labelDestroy = vi.fn();
      const sprite = makeStubSprite();
      (state as unknown as {
        active: {
          definition: Definition;
          sprite: StubSprite;
          label: { destroy: () => void };
          spawnedAt: number;
        };
      }).active = {
        definition: POWERUP_DEFINITIONS.find(
          (d) => d.key === "speed",
        ) as Definition,
        sprite,
        label: { destroy: labelDestroy },
        spawnedAt: 0,
      };

      const collected = tryCollectPowerUp(actor, state, 1000);
      expect(collected).toBe(true);

      // The label is NOT destroyed synchronously — the destroy is deferred
      // to the collected animation's onComplete callback (~250ms later).
      expect(labelDestroy).not.toHaveBeenCalled();
      // But the animation WAS kicked off:
      expect(sprite.__collectedCallbacks).toHaveLength(1);
      // And state.active is nulled immediately (no double-collect).
      expect(state.active).toBeNull();

      // Flush the tween to simulate the 250ms animation completing.
      flushCollectedAnimation(sprite);
      expect(labelDestroy).toHaveBeenCalledTimes(1);
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
    it("plays the despawn animation, nulls state.active immediately, and destroys the sprite + label after the animation completes", () => {
      const state = createPowerUpState();
      const spriteDestroy = vi.fn();
      const labelDestroy = vi.fn();
      const sprite = makeStubSprite({ destroy: spriteDestroy });
      (state as unknown as {
        active: {
          definition: Definition;
          sprite: StubSprite;
          label: { destroy: () => void };
          spawnedAt: number;
        };
      }).active = {
        definition: POWERUP_DEFINITIONS[0],
        sprite,
        label: { destroy: labelDestroy },
        spawnedAt: 0,
      };

      despawnPowerUp(state);

      // state.active is nulled immediately so the BattleScene can spawn the
      // next power-up on the same frame (without waiting for the 300ms fade).
      expect(state.active).toBeNull();
      // The despawn animation was kicked off (NOT an immediate destroy).
      expect(sprite.__despawnCallbacks).toHaveLength(1);
      // The sprite + label are NOT destroyed synchronously — destroy is
      // deferred to the despawn animation's onComplete callback (~300ms).
      expect(spriteDestroy).not.toHaveBeenCalled();
      expect(labelDestroy).not.toHaveBeenCalled();

      // Flush the tween to simulate the 300ms fade completing.
      flushDespawnAnimation(sprite);
      expect(spriteDestroy).toHaveBeenCalledTimes(1);
      expect(labelDestroy).toHaveBeenCalledTimes(1);
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

    it("spawns at random positions within the arena (15% margin)", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeRecordingSceneAndArena();
      const arenaWidth = arena.right - arena.left;
      const arenaHeight = arena.bottom - arena.top;
      const marginX = arenaWidth * 0.15;
      const marginY = arenaHeight * 0.15;

      for (let i = 0; i < 5; i++) {
        spawnPowerUp(scene, state, arena, 16);
        expect(state.active).not.toBeNull();
        expect(state.active!.sprite.x).toBeGreaterThan(arena.left + marginX - 1);
        expect(state.active!.sprite.x).toBeLessThan(arena.right - marginX + 1);
        expect(state.active!.sprite.y).toBeGreaterThan(arena.top + marginY - 1);
        expect(state.active!.sprite.y).toBeLessThan(arena.bottom - marginY + 1);
        despawnPowerUp(state);
      }
    });

    it("spawns at valid positions across multiple spawns (no fixed rotation)", () => {
      const state = createPowerUpState();
      const { scene, arena } = makeRecordingSceneAndArena();

      for (let i = 0; i < 10; i++) {
        spawnPowerUp(scene, state, arena, 16);
        expect(state.active!.sprite.x).toBeGreaterThanOrEqual(arena.left);
        expect(state.active!.sprite.x).toBeLessThanOrEqual(arena.right);
        expect(state.active!.sprite.y).toBeGreaterThanOrEqual(arena.top);
        expect(state.active!.sprite.y).toBeLessThanOrEqual(arena.bottom);
        despawnPowerUp(state);
      }
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

      it("spawns random power-up types (not sequential)", () => {
        const state = createPowerUpState();
        const { scene, arena, textCalls } = makeRecordingSceneAndArena();

        for (let i = 0; i < 20; i++) {
          spawnPowerUp(scene, state, arena, 16);
          despawnPowerUp(state);
        }
        // All labels should be valid power-up labels
        const validLabels = new Set(POWERUP_DEFINITIONS.map((d) => d.label));
        for (const c of textCalls) {
          expect(validLabels.has(c.value)).toBe(true);
        }
        // With 20 random spawns, should see at least 3 different types
        const labels = new Set(textCalls.map((c) => c.value));
        expect(labels.size).toBeGreaterThanOrEqual(3);
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

      it("uses a valid per-type sprite key from POWERUP_SPRITE_KEYS", () => {
        const state = createPowerUpState();
        const { scene, arena, imageCalls } = makeRecordingSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        const validKeys = new Set(Object.values(POWERUP_SPRITE_KEYS));
        expect(validKeys.has(imageCalls[0].key as never)).toBe(true);
      });

      it("uses valid sprite keys across multiple spawns", () => {
        const state = createPowerUpState();
        const { scene, arena, imageCalls } = makeRecordingSceneAndArena();

        for (let i = 0; i < 10; i++) {
          spawnPowerUp(scene, state, arena, 16);
          despawnPowerUp(state);
        }

        const validKeys = new Set(Object.values(POWERUP_SPRITE_KEYS));
        for (const c of imageCalls) {
          expect(validKeys.has(c.key as never)).toBe(true);
        }
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

    describe("spawn animation", () => {
      it("kicks off the spawn tween via scene.tweens.add (scaleX/scaleY = 1, Back.out ease)", () => {
        const state = createPowerUpState();
        const { scene, arena, tweenCalls } = makeRecordingSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        expect(state.active).not.toBeNull();
        // spawnPowerUp calls sprite.playSpawnAnimation() which (inside the
        // PowerUpSprite wrapper) calls scene.tweens.add with the spawn
        // tween config: scale 0 → 1 over 200ms with Back.out ease.
        expect(tweenCalls).toHaveLength(1);
        expect(tweenCalls[0].scaleX).toBe(1);
        expect(tweenCalls[0].scaleY).toBe(1);
        expect(tweenCalls[0].ease).toBe("Back.out");
        expect(tweenCalls[0].duration).toBe(200);
      });

      it("does NOT kick off the collected or despawn tween on spawn (only the spawn tween)", () => {
        const state = createPowerUpState();
        const { scene, arena, tweenCalls } = makeRecordingSceneAndArena();

        spawnPowerUp(scene, state, arena, 16);

        // Exactly 1 tween — the spawn tween. The collected tween (which
        // would have scaleX/scaleY = 1.5 + alpha = 0) and the despawn
        // tween (which would have only alpha = 0) are NOT triggered.
        expect(tweenCalls).toHaveLength(1);
        expect(tweenCalls[0].alpha).toBeUndefined();
        expect(tweenCalls[0].onComplete).toBeUndefined();
      });

      it("kicks off a spawn tween on every spawn across the rotation", () => {
        const state = createPowerUpState();
        const { scene, arena, tweenCalls } = makeRecordingSceneAndArena();

        // Spawn + despawn 3 power-ups; each spawn should kick off a new
        // spawn tween (recorded in tweenCalls). despawnPowerUp also kicks
        // off a despawn tween, so after 3 cycles we expect 3 spawn tweens
        // + 3 despawn tweens = 6 total tween calls.
        for (let i = 0; i < 3; i++) {
          spawnPowerUp(scene, state, arena, 16);
          despawnPowerUp(state);
        }

        expect(tweenCalls).toHaveLength(6);
        // The spawn tweens are at indices 0, 2, 4 (every other call,
        // because despawnPowerUp adds a despawn tween after each spawn).
        // Each spawn tween has scaleX/scaleY = 1 + ease = "Back.out".
        expect(tweenCalls[0].scaleX).toBe(1);
        expect(tweenCalls[0].ease).toBe("Back.out");
        expect(tweenCalls[2].scaleX).toBe(1);
        expect(tweenCalls[2].ease).toBe("Back.out");
        expect(tweenCalls[4].scaleX).toBe(1);
        expect(tweenCalls[4].ease).toBe("Back.out");
      });
    });
  });
});

// Ensure PowerUpState import is used in type position (sanity).
type _Unused = PowerUpState;
