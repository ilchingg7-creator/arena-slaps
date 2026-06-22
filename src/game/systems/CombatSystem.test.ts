import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time, which doesn't exist under the node
// test environment. applySlap uses Phaser.Math.Distance.Between and
// Phaser.Math.Vector2 inside the function body, but our tests don't exercise
// those paths in a way that touches the real Phaser runtime (we stub
// body.setVelocity and use simple coordinates), so a no-op mock is enough.
vi.mock("phaser", () => {
  const Phaser = {
    Math: {
      Distance: {
        Between: (ax: number, ay: number, bx: number, by: number) =>
          Math.hypot(ax - bx, ay - by),
      },
      Vector2: class {
        x: number;
        y: number;
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
        normalize() {
          const len = Math.hypot(this.x, this.y);
          if (len > 0) {
            this.x /= len;
            this.y /= len;
          }
          return this;
        }
      },
    },
  };
  return { default: Phaser, ...Phaser };
});

import * as RoundSystem from "./RoundSystem";
import { applySlap } from "./CombatSystem";
import type { ActorState } from "../entities/Player";

function mockActor(
  x: number,
  y: number,
  overrides: Partial<ActorState> = {},
): ActorState {
  return {
    body: {
      setVelocity: () => void 0,
    },
    facing: { x: 1, y: 0 },
    knockbackSpeed: 560,
    knockbackMultiplier: 1,
    knockbackBoostUntil: 0,
    knockbackUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 260,
    size: 36,
    slapRange: 84,
    spawn: { x, y },
    speedBoostUntil: 0,
    speedMultiplier: 1,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    sprite: { x, y },
    ...overrides,
  } as unknown as ActorState;
}

describe("applySlap", () => {
  it("returns true on a clean hit but does NOT award a point (scoring is ring-out only)", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    // applySlap no longer takes a round/side/winningScore: it cannot award
    // points. The only scoring path is the ring-out handler in BattleScene.
    // Verified structurally — there is no round parameter to mutate.
  });

  it("returns false when the attacker is on cooldown", () => {
    const attacker = mockActor(0, 0, { lastAttackAt: 1000 });
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(false);
  });

  it("returns false when the defender is out of range", () => {
    const attacker = mockActor(0, 0, { slapRange: 50 });
    const defender = mockActor(200, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
  });

  it("blocks a shielded defender without consuming the attacker's cooldown", () => {
    const attacker = mockActor(0, 0);
    // Defender has a fresh shield: 1 hit remaining, valid for 5s.
    const defender = mockActor(40, 0, {
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
    });

    // First slap: blocked by the shield. The shield is consumed AND the
    // attacker's cooldown must NOT be consumed (B10).
    const blocked = applySlap(attacker, defender, 1000);
    expect(blocked).toBe(false);
    expect(attacker.lastAttackAt).toBe(Number.NEGATIVE_INFINITY);
    expect(defender.shieldHitsRemaining).toBe(0);

    // Second slap at the same instant: should land because (a) the cooldown
    // was not consumed by the blocked attempt (B10) and (b) the shield has
    // been consumed (B4).
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
  });

  it("applies knockback to the defender on a successful slap", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    expect(setVelocity).toHaveBeenCalledTimes(1);
    // Knockback direction is along +x (defender to the right of attacker).
    expect(setVelocity.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it("does NOT call registerPoint on a successful slap (scoring moved to ring-out handler)", () => {
    const registerPointSpy = vi.spyOn(RoundSystem, "registerPoint");
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    expect(registerPointSpy).not.toHaveBeenCalled();
    registerPointSpy.mockRestore();
  });

  // --- C1: Double-Slap power-up ---
  // Previously `isDoubleSlapReady` was imported in BattleScene but never
  // consulted: the double-slap power-up applied a visual tint but the next
  // slap did NOT hit twice. The fix lives inside `applySlap` so every slap
  // path (P1, P2, bot) benefits automatically — when the attacker has a
  // double-slap boost ready, the next successful slap's knockback velocity
  // is doubled AND the boost is consumed (reset to 0).

  it("C1: applySlap with doubleSlapReady doubles the knockback velocity", () => {
    // Setup: attacker at (0,0), defender at (40,0). Direction = (1, 0).
    // Base knockback velocity = knockbackSpeed (560) * knockbackMultiplier (1) = 560.
    // With double-slap ready: 560 * 2 = 1120.
    const attacker = mockActor(0, 0, { doubleSlapUntil: 5000 });
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    expect(setVelocity).toHaveBeenCalledTimes(1);
    // Velocity along +x is doubled; y stays 0.
    expect(setVelocity.mock.calls[0][0]).toBe(1120);
    expect(setVelocity.mock.calls[0][1]).toBe(0);
  });

  it("C1: applySlap consumes doubleSlapReady (resets doubleSlapUntil to 0)", () => {
    const attacker = mockActor(0, 0, { doubleSlapUntil: 5000 });
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    // The double-slap boost is consumed on use — the next slap should be a
    // normal single slap.
    expect(attacker.doubleSlapUntil).toBe(0);
  });

  it("C1: applySlap without doubleSlapReady does not double velocity", () => {
    // doubleSlapUntil defaults to 0 → boost NOT ready.
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    // Velocity should NOT be doubled: 560 * 1 = 560.
    expect(setVelocity.mock.calls[0][0]).toBe(560);
  });

  it("C1: applySlap does not consume doubleSlapReady when the slap misses (out of range)", () => {
    // A missed slap should NOT consume the boost — only a successful slap
    // triggers the double-hit. The boost should persist for the next attempt.
    const attacker = mockActor(0, 0, {
      doubleSlapUntil: 5000,
      slapRange: 10, // out of range
    });
    const defender = mockActor(200, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    // Boost is preserved — not consumed by a miss.
    expect(attacker.doubleSlapUntil).toBe(5000);
  });
});
