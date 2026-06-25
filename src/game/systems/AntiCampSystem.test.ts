import { describe, expect, it } from "vitest";
import {
  getSpeedPenaltyMultiplier,
  isSlowed,
  INACTIVITY_GRACE_MS,
  INACTIVITY_RAMP_MS,
  INACTIVITY_MIN_MULTIPLIER,
} from "./AntiCampSystem";
import type { ActorState } from "../entities/Player";

function mockActor(
  overrides: Partial<ActorState> = {},
): ActorState {
  return {
    body: { setVelocity: () => void 0 },
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
    sprite: { x: 0, y: 0, destroy: () => void 0 },
    ...overrides,
  } as unknown as ActorState;
}

describe("AntiCampSystem — getSpeedPenaltyMultiplier", () => {
  it("returns 1.0 for a fresh actor WITHIN grace of battleStartAt (Bug 5 fix)", () => {
    // Bug 5: previously fresh actors (lastSlapAt = -Infinity) were
    // exempt from anti-camp, allowing a camper to never engage and
    // never be slowed. Fix: when lastSlapAt is -Infinity, fall back to
    // battleStartAt as the reference point. The grace window starts
    // from the battle's beginning.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    // Within grace (battleStartAt + 5000 = 6000; now = 5000 < 6000).
    expect(getSpeedPenaltyMultiplier(actor, 5000, battleStartAt)).toBe(1.0);
  });

  it("returns < 1.0 for a fresh actor PAST grace of battleStartAt (Bug 5 fix)", () => {
    // The camper never slapped, but 6 seconds into the battle the grace
    // window (5s) has elapsed — they should start being slowed.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    const now = battleStartAt + INACTIVITY_GRACE_MS + 1000; // 1s past grace
    const mult = getSpeedPenaltyMultiplier(actor, now, battleStartAt);
    expect(mult).toBeLessThan(1.0);
    expect(mult).toBeGreaterThan(INACTIVITY_MIN_MULTIPLIER);
  });

  it("returns INACTIVITY_MIN_MULTIPLIER for a fresh actor long past battleStartAt", () => {
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    const now = battleStartAt + INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS + 5000;
    expect(getSpeedPenaltyMultiplier(actor, now, battleStartAt)).toBe(
      INACTIVITY_MIN_MULTIPLIER,
    );
  });

  it("falls back to battleStartAt=0 (no penalty) when omitted — back-compat", () => {
    // When the caller doesn't pass battleStartAt, the function should
    // treat a fresh actor as having battleStartAt = 0. If `now` is also
    // small, no penalty. This keeps the old call sites working until
    // they're updated.
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    // now = 1000, battleStartAt defaults to 0 → elapsed = 1000 < grace.
    expect(getSpeedPenaltyMultiplier(actor, 1000)).toBe(1.0);
  });

  it("returns 1.0 immediately after a successful slap (penalty reset)", () => {
    // `applySlap` stamps `lastSlapAt = now` on a hit. The penalty
    // window starts from that moment.
    const actor = mockActor({ lastSlapAt: 5000 });
    expect(getSpeedPenaltyMultiplier(actor, 5000)).toBe(1.0);
  });

  it("returns 1.0 at the grace boundary (just under INACTIVITY_GRACE_MS after last slap)", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS - 1; // 1ms before grace ends
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(getSpeedPenaltyMultiplier(actor, now)).toBe(1.0);
  });

  it("returns 1.0 at exactly the grace boundary (INACTIVITY_GRACE_MS after last slap)", () => {
    // The grace period is INCLUSIVE — exactly at the boundary the
    // multiplier is still 1.0. Penalty ramps DOWN starting from
    // (grace + 1)ms.
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS;
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(getSpeedPenaltyMultiplier(actor, now)).toBe(1.0);
  });

  it("returns < 1.0 just after the grace period ends (1ms past grace)", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + 1;
    const actor = mockActor({ lastSlapAt: lastSlap });
    const mult = getSpeedPenaltyMultiplier(actor, now);
    expect(mult).toBeLessThan(1.0);
    expect(mult).toBeGreaterThan(INACTIVITY_MIN_MULTIPLIER);
  });

  it("returns INACTIVITY_MIN_MULTIPLIER at the end of the ramp (grace + ramp ms after last slap)", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS;
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(getSpeedPenaltyMultiplier(actor, now)).toBeCloseTo(
      INACTIVITY_MIN_MULTIPLIER,
      5,
    );
  });

  it("clamps at INACTIVITY_MIN_MULTIPLIER long after the ramp ends", () => {
    const lastSlap = 1000;
    const now = lastSlap + INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS + 60_000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(getSpeedPenaltyMultiplier(actor, now)).toBe(INACTIVITY_MIN_MULTIPLIER);
  });

  it("linearly interpolates between 1.0 and MIN during the ramp (midpoint)", () => {
    // At the midpoint of the ramp, the multiplier should be the average
    // of 1.0 and INACTIVITY_MIN_MULTIPLIER.
    const lastSlap = 1000;
    const midpoint = lastSlap + INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS / 2;
    const actor = mockActor({ lastSlapAt: lastSlap });
    const expected = (1.0 + INACTIVITY_MIN_MULTIPLIER) / 2;
    expect(getSpeedPenaltyMultiplier(actor, midpoint)).toBeCloseTo(expected, 5);
  });

  it("does NOT mutate the actor (pure function)", () => {
    const actor = mockActor({ lastSlapAt: 1000 });
    const snapshot = { ...actor, lastSlapAt: actor.lastSlapAt };
    getSpeedPenaltyMultiplier(actor, 1000 + INACTIVITY_GRACE_MS + 2000);
    expect(actor.lastSlapAt).toBe(snapshot.lastSlapAt);
    expect(actor.speedMultiplier).toBe(snapshot.speedMultiplier);
  });
});

describe("AntiCampSystem — isSlowed", () => {
  it("returns false for a fresh actor WITHIN grace of battleStartAt (Bug 5)", () => {
    // Bug 5: fresh actors now use battleStartAt. Within grace → not slowed.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    expect(isSlowed(actor, battleStartAt + 1000, battleStartAt)).toBe(false);
  });

  it("returns true for a fresh actor PAST grace of battleStartAt (Bug 5)", () => {
    // Camper never slapped, but battleStartAt + grace + 1s elapsed.
    const battleStartAt = 1000;
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    const now = battleStartAt + INACTIVITY_GRACE_MS + 1000;
    expect(isSlowed(actor, now, battleStartAt)).toBe(true);
  });

  it("returns false for a fresh actor when battleStartAt is omitted (back-compat)", () => {
    // Without battleStartAt, fresh actors default to battleStartAt=0.
    // If now is also small, no penalty. This keeps old call sites working.
    const actor = mockActor({ lastSlapAt: Number.NEGATIVE_INFINITY });
    expect(isSlowed(actor, 1000)).toBe(false);
  });

  it("returns false immediately after a successful slap", () => {
    const actor = mockActor({ lastSlapAt: 5000 });
    expect(isSlowed(actor, 5000)).toBe(false);
  });

  it("returns false during the grace period", () => {
    const lastSlap = 1000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(isSlowed(actor, lastSlap + INACTIVITY_GRACE_MS - 1)).toBe(false);
    expect(isSlowed(actor, lastSlap + INACTIVITY_GRACE_MS)).toBe(false);
  });

  it("returns true just after the grace period ends", () => {
    const lastSlap = 1000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    expect(isSlowed(actor, lastSlap + INACTIVITY_GRACE_MS + 1)).toBe(true);
  });

  it("returns true at the end of the ramp and beyond", () => {
    const lastSlap = 1000;
    const actor = mockActor({ lastSlapAt: lastSlap });
    const endOfRamp = lastSlap + INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS;
    expect(isSlowed(actor, endOfRamp)).toBe(true);
    expect(isSlowed(actor, endOfRamp + 10_000)).toBe(true);
  });
});

describe("AntiCampSystem — constants", () => {
  it("exposes INACTIVITY_GRACE_MS as a positive number (default 8000)", () => {
    expect(INACTIVITY_GRACE_MS).toBeGreaterThan(0);
    expect(INACTIVITY_GRACE_MS).toBe(8000);
  });

  it("exposes INACTIVITY_RAMP_MS as a positive number (default 5000)", () => {
    expect(INACTIVITY_RAMP_MS).toBeGreaterThan(0);
    expect(INACTIVITY_RAMP_MS).toBe(5000);
  });

  it("exposes INACTIVITY_MIN_MULTIPLIER in (0, 1) (default 0.5)", () => {
    expect(INACTIVITY_MIN_MULTIPLIER).toBeGreaterThan(0);
    expect(INACTIVITY_MIN_MULTIPLIER).toBeLessThan(1);
    expect(INACTIVITY_MIN_MULTIPLIER).toBe(0.5);
  });
});
