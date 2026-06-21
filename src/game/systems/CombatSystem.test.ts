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
});
