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
import { applySlap, getComboMultiplier } from "./CombatSystem";
import { isDodging, startDodge } from "./DodgeSystem";
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
    lastSlapAttemptAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 260,
    size: 36,
    slapRange: 84,
    spawn: { x, y },
    speedBoostUntil: 0,
    speedMultiplier: 1,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    sprite: { x, y },
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    comboStacks: 0,
    lastSlapAt: Number.NEGATIVE_INFINITY,
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

  // --- Fix A: lastSlapAttemptAt is stamped on EVERY slap attempt ---
  // `lastAttackAt` is only stamped on a successful hit (after the cooldown /
  // range / shield gates), so the bot's dodge logic — which used to key off
  // `player.lastAttackAt` — only fired AFTER the bot was already knocked
  // back (~280ms too late). `lastSlapAttemptAt` fires on EVERY attempt so
  // the bot can react to the swing windup. The tests below verify the stamp
  // happens on all 4 outcomes: cooldown miss, out-of-range, shield block,
  // and successful hit.

  it("Fix A: stamps lastSlapAttemptAt on a successful slap", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    // Both timestamps advance: lastSlapAttemptAt (any attempt) AND
    // lastAttackAt (successful hit only).
    expect(attacker.lastSlapAttemptAt).toBe(1000);
    expect(attacker.lastAttackAt).toBe(1000);
  });

  it("Fix A: stamps lastSlapAttemptAt on a cooldown miss (returns false)", () => {
    const attacker = mockActor(0, 0, { lastAttackAt: 1000 });
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(false);
    // The attempt timestamp fires EVEN THOUGH the cooldown gate rejected the
    // slap. lastAttackAt is NOT advanced (no successful hit).
    expect(attacker.lastSlapAttemptAt).toBe(1100);
    expect(attacker.lastAttackAt).toBe(1000);
  });

  it("Fix A: stamps lastSlapAttemptAt when out of range (returns false)", () => {
    const attacker = mockActor(0, 0, { slapRange: 50 });
    const defender = mockActor(200, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    expect(attacker.lastSlapAttemptAt).toBe(1000);
    // Out-of-range miss does NOT consume the attacker's cooldown — lastAttackAt stays at -Infinity.
    expect(attacker.lastAttackAt).toBe(Number.NEGATIVE_INFINITY);
  });

  it("Fix A: stamps lastSlapAttemptAt when the defender's shield blocks (returns false)", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0, {
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
    });
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    expect(attacker.lastSlapAttemptAt).toBe(1000);
    // Shield block does NOT consume the attacker's cooldown — lastAttackAt stays at -Infinity.
    expect(attacker.lastAttackAt).toBe(Number.NEGATIVE_INFINITY);
    // The shield IS consumed.
    expect(defender.shieldHitsRemaining).toBe(0);
  });

  // --- Task 2ac: dodge i-frames ---
  // When the defender is mid-dodge, applySlap must whiff through them:
  // returns false, no knockback applied, attacker's cooldown NOT consumed
  // (matching shield-block semantics). The dodge check fires AFTER the
  // cooldown / range gates so an out-of-range swing doesn't get a free
  // pass on the cooldown.

  it("2ac: applySlap returns false when the defender is mid-dodge (i-frames)", () => {
    const attacker = mockActor(0, 0);
    // Defender is mid-dodge: dodgeUntil = 2000 means i-frames active until t=2000.
    const defender = mockActor(40, 0, { dodgeUntil: 2000 });
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    // Attacker's cooldown is NOT consumed by a whiffed swing.
    expect(attacker.lastAttackAt).toBe(Number.NEGATIVE_INFINITY);
  });

  it("2ac: applySlap does NOT apply knockback when the defender is dodging", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0, { dodgeUntil: 2000 });
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    expect(setVelocity).not.toHaveBeenCalled();
  });

  it("2ac: applySlap lands normally once the defender's dodge window has elapsed", () => {
    const attacker = mockActor(0, 0);
    // Defender's dodge ended at t=500; we're now at t=1000 — slap should land.
    const defender = mockActor(40, 0, { dodgeUntil: 500 });
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
  });
});

// --- Task 2ac: combo system ---
// `getComboMultiplier` returns 1.0 / 1.5 / 3.0 depending on comboStacks,
// and resets stale combos (>3000ms since the last successful slap) to 0
// before computing the multiplier. `applySlap` increments comboStacks on
// a successful slap (capped at 5), stamps `lastSlapAt`, and resets the
// defender's comboStacks to 0.

describe("getComboMultiplier (Task 2ac)", () => {
  it("returns 1.0 when comboStacks is 0", () => {
    const actor = mockActor(0, 0);
    expect(getComboMultiplier(actor, 1000)).toBe(1.0);
  });

  it("returns 1.0 when comboStacks is 1 or 2 (below the tier-1 threshold)", () => {
    const actor1 = mockActor(0, 0, { comboStacks: 1, lastSlapAt: 1000 });
    const actor2 = mockActor(0, 0, { comboStacks: 2, lastSlapAt: 1000 });
    expect(getComboMultiplier(actor1, 1000)).toBe(1.0);
    expect(getComboMultiplier(actor2, 1000)).toBe(1.0);
  });

  it("returns 1.5 when comboStacks is 3 (tier-1 threshold)", () => {
    const actor = mockActor(0, 0, { comboStacks: 3, lastSlapAt: 1000 });
    expect(getComboMultiplier(actor, 1000)).toBe(1.5);
  });

  it("returns 1.5 when comboStacks is 4 (still tier-1)", () => {
    const actor = mockActor(0, 0, { comboStacks: 4, lastSlapAt: 1000 });
    expect(getComboMultiplier(actor, 1000)).toBe(1.5);
  });

  it("returns 3.0 when comboStacks is 5 (tier-2 mega-launch)", () => {
    // BUGFIX: previously this returned 2.5, but the JSDoc + design spec
    // describe the mega-launch as a 3.0x multiplier. The 5-stack is the
    // climax of the combo system — it should be a noticeably bigger punch
    // than the 1.5x tier-1, not a marginal bump to 2.5x.
    const actor = mockActor(0, 0, { comboStacks: 5, lastSlapAt: 1000 });
    expect(getComboMultiplier(actor, 1000)).toBe(3.0);
  });

  it("resets comboStacks to 0 when the combo has timed out (>3000ms since lastSlapAt)", () => {
    // Combo stacked at t=1000, but `now` is t=4500 (3500ms later). The combo
    // must time out — getComboMultiplier returns 1.0 AND resets comboStacks.
    const actor = mockActor(0, 0, { comboStacks: 5, lastSlapAt: 1000 });
    expect(getComboMultiplier(actor, 4500)).toBe(1.0);
    expect(actor.comboStacks).toBe(0);
  });

  it("does NOT reset comboStacks when the combo is still fresh (<=3000ms)", () => {
    // Combo stacked at t=1000, `now` is t=3500 — exactly 2500ms later.
    // Wait: 2500ms < 3000ms, so the combo is still live.
    const actor = mockActor(0, 0, { comboStacks: 5, lastSlapAt: 1000 });
    // 2999ms later — still live.
    expect(getComboMultiplier(actor, 3999)).toBe(3.0);
    expect(actor.comboStacks).toBe(5);
    // Exactly 3000ms later — boundary. Spec: reset when >3000ms, so at
    // exactly 3000ms the combo is still live.
    expect(getComboMultiplier(actor, 4000)).toBe(3.0);
    expect(actor.comboStacks).toBe(5);
    // 3001ms later — combo times out.
    expect(getComboMultiplier(actor, 4001)).toBe(1.0);
    expect(actor.comboStacks).toBe(0);
  });

  it("does NOT churn comboStacks=0 each frame (no-op when already 0)", () => {
    // A fresh actor has comboStacks=0 and lastSlapAt=-Infinity. The reset
    // check is `comboStacks > 0 && ...`, so it skips entirely — no field
    // mutation. This lets the HUD / BattleScene call getComboMultiplier
    // every frame as a cheap tick without side effects on fresh actors.
    const actor = mockActor(0, 0);
    const result = getComboMultiplier(actor, 1000);
    expect(result).toBe(1.0);
    expect(actor.comboStacks).toBe(0);
  });
});

describe("applySlap combo bookkeeping (Task 2ac)", () => {
  it("increments attacker.comboStacks from 0 to 1 on a successful slap", () => {
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    expect(attacker.comboStacks).toBe(1);
    expect(attacker.lastSlapAt).toBe(1000);
  });

  it("caps attacker.comboStacks at 5 (no overflow into higher multiplier bands)", () => {
    const attacker = mockActor(0, 0, {
      comboStacks: 5,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0);
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(true);
    // Already at cap — the post-increment clamp keeps it at 5.
    expect(attacker.comboStacks).toBe(5);
  });

  it("resets the defender's comboStacks to 0 when they get hit", () => {
    // Defender had built up a 4-stack combo; getting hit breaks it.
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0, {
      comboStacks: 4,
      lastSlapAt: 1000,
    });
    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(true);
    expect(defender.comboStacks).toBe(0);
  });

  it("resets a stale attacker combo BEFORE applying the slap (multiplier uses pre-reset stacks)", () => {
    // Attacker had 5 stacks from t=1000; now at t=5000 (4000ms > 3000ms
    // timeout) the combo has gone stale. The slap must:
    //   1. Reset comboStacks to 0 (stale)
    //   2. Apply the slap with the 1.0x multiplier (not 2.5x)
    //   3. Increment comboStacks to 1 (post-slap)
    const attacker = mockActor(0, 0, {
      comboStacks: 5,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 5000);
    expect(hit).toBe(true);
    // Base knockback velocity = 560 * 1 (knockbackMult) * 1 (doubleSlap) * 1.0 (combo)
    // = 560 — NOT 560 * 2.5 = 1400.
    expect(setVelocity.mock.calls[0][0]).toBe(560);
    // Combo was reset to 0, then incremented to 1 by the slap.
    expect(attacker.comboStacks).toBe(1);
  });

  it("applies the 1.5x combo multiplier at 3 stacks (knockback is 1.5x base)", () => {
    // Attacker has 3 stacks from t=1000; slap at t=1100 (fresh combo).
    // Multiplier = 1.5x. Base knockback = 560; with 1.5x = 840.
    const attacker = mockActor(0, 0, {
      comboStacks: 3,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(true);
    expect(setVelocity.mock.calls[0][0]).toBe(840);
    // Stack incremented to 4 — still tier-1.
    expect(attacker.comboStacks).toBe(4);
  });

  it("applies the 3.0x mega-launch multiplier at 5 stacks", () => {
    // Attacker has 5 stacks from t=1000; slap at t=1100 (fresh combo).
    // Multiplier = 3.0x (mega-launch). Base knockback = 560; with 3.0x = 1680.
    const attacker = mockActor(0, 0, {
      comboStacks: 5,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0);
    const setVelocity = vi.fn();
    (defender as unknown as { body: { setVelocity: typeof setVelocity } }).body = {
      setVelocity,
    };
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(true);
    expect(setVelocity.mock.calls[0][0]).toBe(1680);
    // Capped at 5.
    expect(attacker.comboStacks).toBe(5);
  });

  it("does NOT increment comboStacks on a missed slap (out of range)", () => {
    const attacker = mockActor(0, 0, {
      comboStacks: 2,
      lastSlapAt: 1000,
      slapRange: 10, // out of range
    });
    const defender = mockActor(200, 0);
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(false);
    expect(attacker.comboStacks).toBe(2);
  });

  it("does NOT increment comboStacks when the slap is blocked by a shield", () => {
    const attacker = mockActor(0, 0, {
      comboStacks: 2,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0, {
      shieldHitsRemaining: 1,
      shieldUntil: 5000,
    });
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(false);
    expect(attacker.comboStacks).toBe(2);
  });

  it("does NOT increment comboStacks when the defender is dodging (i-frames)", () => {
    const attacker = mockActor(0, 0, {
      comboStacks: 2,
      lastSlapAt: 1000,
    });
    const defender = mockActor(40, 0, { dodgeUntil: 2000 });
    const hit = applySlap(attacker, defender, 1100);
    expect(hit).toBe(false);
    expect(attacker.comboStacks).toBe(2);
  });
});

// Sanity check: the DodgeSystem + CombatSystem integration — a defender
// who dodges RIGHT before the slap lands avoids both the knockback AND
// the combo reset.
describe("applySlap + DodgeSystem integration (Task 2ac)", () => {
  it("a defender who dodges before the slap lands keeps their comboStacks", () => {
    // Defender has a 3-stack combo of their own. The attacker swings, but
    // the defender dodged 50ms ago — i-frames are still active (200ms
    // window). The slap whiffs; the defender's combo is preserved.
    const attacker = mockActor(0, 0);
    const defender = mockActor(40, 0, {
      comboStacks: 3,
      lastSlapAt: 900,
    });
    // Defender dodged at t=950 → dodgeUntil = 950 + 200 = 1150.
    expect(startDodge(defender, { x: 1, y: 0 }, 950)).toBe(true);
    expect(isDodging(defender, 1000)).toBe(true);

    const hit = applySlap(attacker, defender, 1000);
    expect(hit).toBe(false);
    // Defender's combo is preserved (slap whiffed).
    expect(defender.comboStacks).toBe(3);
  });
});
