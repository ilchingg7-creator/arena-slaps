import { describe, expect, it, vi } from "vitest";

// Stub Phaser — moveActor reads actor.body.setVelocity but never touches
// Phaser APIs directly. The stub just needs to make `import Phaser` work.
vi.mock("phaser", () => ({}));

import { moveActor, type ActorState } from "./Player";
import { INACTIVITY_GRACE_MS, INACTIVITY_MIN_MULTIPLIER } from "../systems/AntiCampSystem";

function mockActor(overrides: Partial<ActorState> = {}): ActorState {
  const velocityCalls: Array<{ x: number; y: number }> = [];
  return {
    body: {
      setVelocity: (x: number, y: number) => {
        velocityCalls.push({ x, y });
      },
    },
    facing: { x: 1, y: 0, copy: () => void 0 },
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
    sprite: { x: 0, y: 0, destroy: () => void 0 },
    ...overrides,
    // Expose the calls array via a non-standard field so the test can read
    // what setVelocity was called with.
    __velocityCalls: velocityCalls,
  } as unknown as ActorState & {
    __velocityCalls: Array<{ x: number; y: number }>;
  };
}

function unitDirection() {
  // Use a unit vector (1, 0) so the velocity equals moveSpeed * mult.
  return { x: 1, y: 0, lengthSq: () => 1, clone: () => unitDirection(), normalize: () => unitDirection(), copy: () => void 0 } as unknown as Phaser.Math.Vector2;
}

describe("moveActor — anti-camp penalty integration", () => {
  it("applies full speed for a fresh actor WITHIN grace of battleStartAt (Bug 5)", () => {
    // Bug 5 fix: fresh actors (lastSlapAt = -Infinity) now use
    // battleStartAt as the reference. Within grace → full speed.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    moveActor(actor, unitDirection(), battleStartAt + 1000, battleStartAt);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBe(260); // full speed within grace
  });

  it("applies FULL speed for a fresh actor regardless of battleStartAt (no penalty)", () => {
    // Fresh actors (lastSlapAt = -Infinity) are NEVER slowed, even if
    // battleStartAt is far in the past. This prevents the slow-start
    // bug when the player sat in the menu for a long time.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    moveActor(actor, unitDirection(), 100_000, battleStartAt);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBe(260); // full speed — no penalty
  });

  it("applies full speed immediately after a successful slap", () => {
    const actor = mockActor({ lastSlapAt: 5000 });
    moveActor(actor, unitDirection(), 5000);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBe(260);
  });

  it("applies full speed within the grace window", () => {
    const lastSlap = 1000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    moveActor(actor, unitDirection(), lastSlap + INACTIVITY_GRACE_MS);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBe(260);
  });

  it("applies a REDUCED speed after the grace window elapses", () => {
    const lastSlap = 1000;
    // 1 second past grace — should be in the ramp, multiplier < 1.0.
    const now = lastSlap + INACTIVITY_GRACE_MS + 1000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    moveActor(actor, unitDirection(), now);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBeLessThan(260);
    expect(last.x).toBeGreaterThan(260 * 0.4); // above the floor
  });

  it("applies the MINIMUM speed long after the ramp ends", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + 60_000; // way past ramp
    const actor = mockActor({ lastSlapAt: lastSlap });
    moveActor(actor, unitDirection(), now);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    // Min multiplier is 0.4 → 260 * 0.4 = 104
    expect(last.x).toBeCloseTo(260 * INACTIVITY_MIN_MULTIPLIER, 1);
  });

  it("stacks the penalty on top of an active Boost power-up", () => {
    // Boost power-up sets speedMultiplier to ~1.35. The penalty multiplies
    // ON TOP of that — effective speed = moveSpeed * speedMultiplier * penalty.
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + 60_000; // clamped to MIN
    const actor = mockActor({
      lastSlapAt: lastSlap,
      speedMultiplier: 1.35,
      speedBoostUntil: now + 1000, // boost active
    });
    moveActor(actor, unitDirection(), now);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    // 260 * 1.35 * INACTIVITY_MIN_MULTIPLIER
    expect(last.x).toBeCloseTo(260 * 1.35 * INACTIVITY_MIN_MULTIPLIER, 1);
  });

  it("resets to full speed on the next frame after a successful slap", () => {
    // Simulate: actor was camping (slowed), then slaps at t=11000.
    // At t=11000 moveActor should give full speed again.
    const actor = mockActor({ lastSlapAt: 1000 });
    // First, move while slowed (t = 1000 + grace + 2000)
    const slowedNow = 1000 + INACTIVITY_GRACE_MS + 2000;
    moveActor(actor, unitDirection(), slowedNow);
    const slowedCalls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const slowedLast = slowedCalls[slowedCalls.length - 1];
    expect(slowedLast.x).toBeLessThan(260);

    // Then the actor slaps — applySlap would set lastSlapAt = now.
    actor.lastSlapAt = 11_000;

    // Now moveActor should give full speed.
    moveActor(actor, unitDirection(), 11_000);
    const afterSlapCalls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const afterSlapLast = afterSlapCalls[afterSlapCalls.length - 1];
    expect(afterSlapLast.x).toBe(260);
  });

  it("zeros velocity when direction is (0,0) regardless of penalty", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + 60_000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    const zeroDir = { x: 0, y: 0, lengthSq: () => 0, clone: () => zeroDir, normalize: () => zeroDir, copy: () => void 0 } as unknown as Phaser.Math.Vector2;
    moveActor(actor, zeroDir, now);
    const calls = (actor as unknown as { __velocityCalls: Array<{ x: number; y: number }> }).__velocityCalls;
    const last = calls[calls.length - 1];
    expect(last.x).toBe(0);
    expect(last.y).toBe(0);
  });
});
