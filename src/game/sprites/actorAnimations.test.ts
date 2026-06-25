import { describe, expect, it } from "vitest";
import type { ActorState } from "../entities/Player";
import {
  EFFECT_TINTS,
  getActorAnimationState,
  getActorEffectTint,
} from "./actorAnimations";
import { INACTIVITY_GRACE_MS } from "../systems/AntiCampSystem";

/**
 * Permissive overrides shape for {@link mockActor}. The full ActorState has
 * many nested Phaser types (Body, Vector2, Rectangle) that we don't want
 * to fully stub in every test. This shape lets callers override the fields
 * the helpers actually read (timings, multipliers, and a minimal
 * body.velocity) without TypeScript complaining that the literal isn't a
 * complete Phaser.Physics.Arcade.Body.
 */
type ActorOverrides = Partial<Omit<ActorState, "body" | "sprite" | "spawn" | "facing">> & {
  body?: { velocity: { x: number; y: number } };
};

/**
 * Build a minimal stub ActorState for animation/tint tests. Only the
 * fields touched by `getActorAnimationState` and `getActorEffectTint` are
 * populated; the rest default to safe zero values. Cast through
 * `unknown` so we don't have to fully satisfy Phaser's Arcade.Body type.
 */
function mockActor(overrides: ActorOverrides = {}): ActorState {
  return {
    body: { velocity: { x: 0, y: 0 } },
    facing: { x: 1, y: 0 },
    knockbackSpeed: 560,
    knockbackMultiplier: 1,
    knockbackBoostUntil: 0,
    knockbackUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    lastSlapAttemptAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 260,
    size: 36,
    slapRange: 84,
    spawn: { x: 0, y: 0 },
    speedBoostUntil: 0,
    speedMultiplier: 1,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    frozenUntil: 0,
    doubleSlapUntil: 0,
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    comboStacks: 0,
    lastSlapAt: Number.NEGATIVE_INFINITY,
    sprite: { x: 0, y: 0 },
    ...overrides,
  } as unknown as ActorState;
}

describe("getActorAnimationState", () => {
  it("returns 'idle' when velocity is zero", () => {
    const actor = mockActor({ body: { velocity: { x: 0, y: 0 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("idle");
  });

  it("returns 'idle' when velocity is below the epsilon (~0)", () => {
    // 0.5 px/s is well below the 1 px/s threshold — treated as idle.
    const actor = mockActor({ body: { velocity: { x: 0.4, y: 0.3 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("idle");
  });

  it("returns 'fall' when knockbackUntil > now", () => {
    const actor = mockActor({
      knockbackUntil: 5000,
      body: { velocity: { x: 0, y: 0 } },
    });
    expect(getActorAnimationState(actor, 1000)).toBe("fall");
  });

  it("returns 'fall' when knockback is active even if velocity is non-zero (knockback overrides movement)", () => {
    const actor = mockActor({
      knockbackUntil: 5000,
      body: { velocity: { x: 300, y: -200 } },
    });
    expect(getActorAnimationState(actor, 1000)).toBe("fall");
  });

  it("returns 'idle' once knockbackUntil has elapsed (knockbackUntil == now)", () => {
    const actor = mockActor({
      knockbackUntil: 1000,
      body: { velocity: { x: 0, y: 0 } },
    });
    expect(getActorAnimationState(actor, 1000)).toBe("idle");
  });

  it("returns 'run-n' when velocity.y < 0 (and |y| >= |x|)", () => {
    const actor = mockActor({ body: { velocity: { x: 0, y: -260 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-n");
  });

  it("returns 'run-n' when velocity is mostly upward (|y| > |x|)", () => {
    const actor = mockActor({ body: { velocity: { x: 50, y: -260 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-n");
  });

  it("returns 'run-s' when velocity.y > 0", () => {
    const actor = mockActor({ body: { velocity: { x: 0, y: 260 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-s");
  });

  it("returns 'run-e' when velocity.x > 0 (and |x| > |y|)", () => {
    const actor = mockActor({ body: { velocity: { x: 260, y: 0 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-e");
  });

  it("returns 'run-e' when velocity is mostly rightward (|x| > |y|)", () => {
    const actor = mockActor({ body: { velocity: { x: 260, y: 50 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-e");
  });

  it("returns 'run-w' when velocity.x < 0", () => {
    const actor = mockActor({ body: { velocity: { x: -260, y: 0 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-w");
  });

  it("returns 'run-n' when |y| === |x| exactly (vertical wins ties)", () => {
    // Diagonal movement: 45 degrees upward-right. The spec says
    // "|y| >= |x|" picks the vertical axis, so vy < 0 → run-n.
    const actor = mockActor({ body: { velocity: { x: 100, y: -100 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-n");
  });

  it("returns 'run-s' when |y| === |x| exactly and vy > 0", () => {
    const actor = mockActor({ body: { velocity: { x: 100, y: 100 } } });
    expect(getActorAnimationState(actor, 1000)).toBe("run-s");
  });

  // --- MINOR-1: slap animation ---
  // `getActorAnimationState` previously returned only "idle" / "run-N|S|E|W" /
  // "fall" — the "slap" texture (player-slap.png, bot-slap.png) was never
  // displayed because no state transition ever returned "slap". The fix
  // introduces a "slap" state when the actor recently slapped (within 200ms
  // of `lastAttackAt`). Priority: fall > slap > run > idle (fall still wins
  // so a slapped-then-knocked actor tumbles visibly; the brief slap window
  // is otherwise above run/idle so the player sees their own slap connect).
  it("MINOR-1: returns 'slap' when lastAttackAt is within 200ms", () => {
    const actor = mockActor({
      lastAttackAt: 900,
      body: { velocity: { x: 0, y: 0 } },
    });
    // now - lastAttackAt = 1000 - 900 = 100 < 200 → slap.
    expect(getActorAnimationState(actor, 1000)).toBe("slap");
  });

  it("MINOR-1: returns 'slap' when lastAttackAt is exactly 199ms ago (boundary)", () => {
    const actor = mockActor({
      lastAttackAt: 801,
      body: { velocity: { x: 0, y: 0 } },
    });
    // now - lastAttackAt = 1000 - 801 = 199 < 200 → slap (boundary inclusive).
    expect(getActorAnimationState(actor, 1000)).toBe("slap");
  });

  it("MINOR-1: returns 'idle' when lastAttackAt is more than 200ms ago", () => {
    const actor = mockActor({
      lastAttackAt: 700,
      body: { velocity: { x: 0, y: 0 } },
    });
    // now - lastAttackAt = 1000 - 700 = 300 > 200 → not slapping, velocity 0 → idle.
    expect(getActorAnimationState(actor, 1000)).toBe("idle");
  });

  it("MINOR-1: returns 'fall' when both knockback and slap are active (fall wins)", () => {
    const actor = mockActor({
      knockbackUntil: 5000,
      lastAttackAt: 900,
      body: { velocity: { x: 0, y: 0 } },
    });
    // Both fall (knockbackUntil > now) AND slap (now - lastAttackAt = 100 < 200)
    // are active. Fall takes priority — the actor is being launched.
    expect(getActorAnimationState(actor, 1000)).toBe("fall");
  });

  it("MINOR-1: returns 'slap' even when velocity is non-zero (slap beats run)", () => {
    const actor = mockActor({
      lastAttackAt: 900,
      body: { velocity: { x: 260, y: 0 } },
    });
    // Slap window is active and velocity is run-tier (260 px/s). Slap should
    // override the run animation so the player sees the slap connect.
    expect(getActorAnimationState(actor, 1000)).toBe("slap");
  });
});

describe("getActorEffectTint", () => {
  it("returns null when no effects are active", () => {
    const actor = mockActor();
    expect(getActorEffectTint(actor, 1000)).toBeNull();
  });

  it("returns frozen tint when frozenUntil > now", () => {
    const actor = mockActor({ frozenUntil: 5000 });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.frozen);
  });

  it("returns null for frozen when frozenUntil has elapsed", () => {
    const actor = mockActor({ frozenUntil: 1000 });
    expect(getActorEffectTint(actor, 2000)).toBeNull();
  });

  it("returns shielded tint when shield is active (hits > 0 and shieldUntil > now)", () => {
    const actor = mockActor({
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.shielded);
  });

  it("returns null for shield when shieldHitsRemaining is 0", () => {
    const actor = mockActor({
      shieldHitsRemaining: 0,
      shieldUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBeNull();
  });

  it("returns null for shield when shieldUntil has elapsed (even if hits remain)", () => {
    const actor = mockActor({
      shieldHitsRemaining: 1,
      shieldUntil: 1000,
    });
    expect(getActorEffectTint(actor, 2000)).toBeNull();
  });

  it("returns mega-knockback tint when knockback boost active AND multiplier > 1.5", () => {
    const actor = mockActor({
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.megaKnockback);
  });

  it("returns regular knockback tint when knockback boost active AND multiplier <= 1.5", () => {
    const actor = mockActor({
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.25,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.knockback);
  });

  it("returns null for knockback when knockbackBoostUntil has elapsed", () => {
    const actor = mockActor({
      knockbackBoostUntil: 1000,
      knockbackMultiplier: 1.75,
    });
    expect(getActorEffectTint(actor, 2000)).toBeNull();
  });

  it("returns double-slap tint when doubleSlapUntil > now", () => {
    const actor = mockActor({ doubleSlapUntil: 5000 });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.doubleSlap);
  });

  it("returns speed tint when speed boost active (priority lower than frozen)", () => {
    const actor = mockActor({ speedBoostUntil: 5000 });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.speed);
  });

  // --- Priority tests ---
  it("priority: frozen beats shielded", () => {
    const actor = mockActor({
      frozenUntil: 5000,
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.frozen);
  });

  it("priority: shielded beats mega-knockback", () => {
    const actor = mockActor({
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.shielded);
  });

  it("priority: mega-knockback beats double-slap", () => {
    const actor = mockActor({
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
      doubleSlapUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.megaKnockback);
  });

  it("priority: double-slap beats speed", () => {
    const actor = mockActor({
      doubleSlapUntil: 5000,
      speedBoostUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.doubleSlap);
  });

  it("priority: speed beats (regular) knockback", () => {
    const actor = mockActor({
      speedBoostUntil: 5000,
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.25,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.speed);
  });

  it("priority: full stack returns frozen when every effect is active", () => {
    const actor = mockActor({
      frozenUntil: 5000,
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
      doubleSlapUntil: 5000,
      speedBoostUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.frozen);
  });

  it("priority: full stack returns shielded when only frozen is inactive", () => {
    const actor = mockActor({
      frozenUntil: 0,
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
      doubleSlapUntil: 5000,
      speedBoostUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.shielded);
  });

  it("priority: full stack returns mega-knockback when frozen+shield inactive", () => {
    const actor = mockActor({
      frozenUntil: 0,
      shieldHitsRemaining: 0,
      shieldUntil: 0,
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.75,
      doubleSlapUntil: 5000,
      speedBoostUntil: 5000,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.megaKnockback);
  });

  it("priority: returns knockback (lowest) when only regular knockback is active", () => {
    const actor = mockActor({
      knockbackBoostUntil: 5000,
      knockbackMultiplier: 1.25,
    });
    expect(getActorEffectTint(actor, 1000)).toBe(EFFECT_TINTS.knockback);
  });

  // --- RED: Bug — slowed tint from AntiCampSystem ---
  describe("slowed tint (AntiCampSystem integration)", () => {
    it("returns the slowed tint when the actor is past the grace window", () => {
      // Actor last slapped at t=1000. With the default grace of 5000ms,
      // at t=7000 the actor is 1s into the ramp → slowed tint.
      const actor = mockActor({ lastSlapAt: 1000 });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.slowed);
    });

    it("returns null for a fresh actor WITHIN grace of battleStartAt (Bug 5)", () => {
      // Bug 5: fresh actors now use battleStartAt. Within grace → not slowed → null tint.
      const battleStartAt = 1000;
      const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
      expect(getActorEffectTint(actor, battleStartAt + 1000, battleStartAt)).toBeNull();
    });

    it("returns the slowed tint for a fresh actor PAST grace of battleStartAt (Bug 5)", () => {
      const battleStartAt = 1000;
      const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
      // 1s past grace → slowed tint.
      expect(getActorEffectTint(actor, battleStartAt + INACTIVITY_GRACE_MS + 1000, battleStartAt)).toBe(
        EFFECT_TINTS.slowed,
      );
    });

    it("returns null immediately after a successful slap (within grace)", () => {
      const actor = mockActor({ lastSlapAt: 5000 });
      expect(getActorEffectTint(actor, 5000)).toBeNull();
      // At exactly the grace boundary (5000 + 5000 = 10000) — still null.
      expect(getActorEffectTint(actor, 10_000)).toBeNull();
    });

    it("returns the slowed tint long after the ramp ends (clamped)", () => {
      const actor = mockActor({ lastSlapAt: 1000 });
      // 60s past the ramp — still slowed.
      expect(getActorEffectTint(actor, 1000 + 5000 + 4000 + 60_000)).toBe(
        EFFECT_TINTS.slowed,
      );
    });

    it("priority: frozen overrides slowed", () => {
      // Frozen is highest priority — should win over slowed.
      const actor = mockActor({
        lastSlapAt: 1000,
        frozenUntil: 10_000,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.frozen);
    });

    it("priority: shielded overrides slowed", () => {
      const actor = mockActor({
        lastSlapAt: 1000,
        shieldHitsRemaining: 1,
        shieldUntil: 10_000,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.shielded);
    });

    it("priority: mega-knockback overrides slowed", () => {
      const actor = mockActor({
        lastSlapAt: 1000,
        knockbackBoostUntil: 10_000,
        knockbackMultiplier: 1.75,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.megaKnockback);
    });

    it("priority: double-slap overrides slowed", () => {
      const actor = mockActor({
        lastSlapAt: 1000,
        doubleSlapUntil: 10_000,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.doubleSlap);
    });

    it("priority: speed (Boost) overrides slowed", () => {
      // A Boosted actor who is also camping — the Boost tint wins so the
      // player sees they still have the power-up active.
      const actor = mockActor({
        lastSlapAt: 1000,
        speedBoostUntil: 10_000,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.speed);
    });

    it("priority: regular knockback overrides slowed", () => {
      const actor = mockActor({
        lastSlapAt: 1000,
        knockbackBoostUntil: 10_000,
        knockbackMultiplier: 1.25,
      });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.knockback);
    });

    it("priority: slowed wins over NO effect (it's the lowest non-null priority)", () => {
      // When no other effect is active, slowed shows.
      const actor = mockActor({ lastSlapAt: 1000 });
      expect(getActorEffectTint(actor, 7000)).toBe(EFFECT_TINTS.slowed);
    });
  });
});

describe("EFFECT_TINTS", () => {
  it("exposes all seven documented effect tint keys", () => {
    expect(Object.keys(EFFECT_TINTS).sort()).toEqual(
      [
        "frozen",
        "shielded",
        "megaKnockback",
        "doubleSlap",
        "speed",
        "knockback",
        "slowed",
      ].sort(),
    );
  });

  it("every tint value is a finite number", () => {
    for (const value of Object.values(EFFECT_TINTS)) {
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
