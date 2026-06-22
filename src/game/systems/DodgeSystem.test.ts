import { describe, expect, it, vi } from "vitest";

// DodgeSystem is a pure module — it imports only the ActorState TYPE from
// Player.ts (no runtime Phaser dependency), so no Phaser mock is needed.
import {
  canDodge,
  getDodgeCooldownMs,
  getDodgeDurationMs,
  getDodgeSpeedMultiplier,
  isDodging,
  startDodge,
} from "./DodgeSystem";
import type { ActorState } from "../entities/Player";

function mockActor(overrides: Partial<ActorState> = {}): ActorState {
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
    sprite: { x: 0, y: 0 },
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    comboStacks: 0,
    lastSlapAt: Number.NEGATIVE_INFINITY,
    ...overrides,
  } as unknown as ActorState;
}

describe("getDodgeDurationMs / getDodgeCooldownMs / getDodgeSpeedMultiplier", () => {
  it("getDodgeDurationMs returns 200", () => {
    expect(getDodgeDurationMs()).toBe(200);
  });

  it("getDodgeCooldownMs returns 1500", () => {
    expect(getDodgeCooldownMs()).toBe(1500);
  });

  it("getDodgeSpeedMultiplier returns 2.0", () => {
    expect(getDodgeSpeedMultiplier()).toBe(2.0);
  });
});

describe("isDodging", () => {
  it("returns false when dodgeUntil is 0 (never dodged)", () => {
    const actor = mockActor({ dodgeUntil: 0 });
    expect(isDodging(actor, 1000)).toBe(false);
  });

  it("returns true while inside the dodge window", () => {
    // Dodge started at t=1000, ends at t=1200 (200ms duration).
    const actor = mockActor({ dodgeUntil: 1200 });
    expect(isDodging(actor, 1000)).toBe(true);
    expect(isDodging(actor, 1100)).toBe(true);
    expect(isDodging(actor, 1199)).toBe(true);
  });

  it("returns false once the dodge window has elapsed", () => {
    const actor = mockActor({ dodgeUntil: 1200 });
    expect(isDodging(actor, 1200)).toBe(false);
    expect(isDodging(actor, 5000)).toBe(false);
  });
});

describe("canDodge", () => {
  it("returns true when no cooldown is active (dodgeCooldownUntil = 0)", () => {
    const actor = mockActor({ dodgeCooldownUntil: 0 });
    expect(canDodge(actor, 1000)).toBe(true);
  });

  it("returns false while the cooldown window is active", () => {
    // Dodge fired at t=1000, cooldown ends at t=2500 (1500ms cooldown).
    const actor = mockActor({ dodgeCooldownUntil: 2500 });
    expect(canDodge(actor, 1000)).toBe(false);
    expect(canDodge(actor, 2499)).toBe(false);
  });

  it("returns true once the cooldown has elapsed", () => {
    const actor = mockActor({ dodgeCooldownUntil: 2500 });
    expect(canDodge(actor, 2500)).toBe(true);
    expect(canDodge(actor, 5000)).toBe(true);
  });

  it("returns false while mid-dodge (cooldown extends past dodge window)", () => {
    // Dodge started at t=1000, dodgeUntil=1200, dodgeCooldownUntil=2500.
    const actor = mockActor({ dodgeUntil: 1200, dodgeCooldownUntil: 2500 });
    expect(canDodge(actor, 1100)).toBe(false);
  });
});

describe("startDodge", () => {
  it("stamps dodgeUntil = now + DODGE_DURATION_MS", () => {
    const actor = mockActor();
    const ok = startDodge(actor, { x: 1, y: 0 }, 1000);
    expect(ok).toBe(true);
    expect(actor.dodgeUntil).toBe(1000 + getDodgeDurationMs());
    expect(actor.dodgeUntil).toBe(1200);
  });

  it("stamps dodgeCooldownUntil = now + DODGE_COOLDOWN_MS", () => {
    const actor = mockActor();
    const ok = startDodge(actor, { x: 0, y: 1 }, 1000);
    expect(ok).toBe(true);
    expect(actor.dodgeCooldownUntil).toBe(1000 + getDodgeCooldownMs());
    expect(actor.dodgeCooldownUntil).toBe(2500);
  });

  it("returns false and does NOT mutate state when on cooldown", () => {
    // Cooldown already active until t=2500 — a startDodge call at t=1200
    // (during the original dodge window) must fail and leave the timestamps
    // untouched.
    const actor = mockActor({ dodgeUntil: 1200, dodgeCooldownUntil: 2500 });
    const before = { d: actor.dodgeUntil, c: actor.dodgeCooldownUntil };
    const ok = startDodge(actor, { x: 1, y: 0 }, 1200);
    expect(ok).toBe(false);
    expect(actor.dodgeUntil).toBe(before.d);
    expect(actor.dodgeCooldownUntil).toBe(before.c);
  });

  it("succeeds immediately after the cooldown elapses (fresh dodge)", () => {
    // First dodge at t=1000 → cooldown ends at t=2500. A second dodge at
    // t=2500 should succeed and stamp a fresh window.
    const actor = mockActor({ dodgeUntil: 1200, dodgeCooldownUntil: 2500 });
    const ok = startDodge(actor, { x: 1, y: 0 }, 2500);
    expect(ok).toBe(true);
    expect(actor.dodgeUntil).toBe(2500 + getDodgeDurationMs());
    expect(actor.dodgeCooldownUntil).toBe(2500 + getDodgeCooldownMs());
  });

  it("does NOT touch the actor's body velocity (caller applies it)", () => {
    // The system contract: startDodge only stamps timestamps. The caller
    // (BattleScene) is responsible for setting body.setVelocity with the
    // dodge multiplier. Verify by passing a mock body with a spy.
    const setVelocity = vi.fn();
    const actor = mockActor({
      body: { setVelocity } as unknown as ActorState["body"],
    });
    const ok = startDodge(actor, { x: 1, y: 0 }, 1000);
    expect(ok).toBe(true);
    expect(setVelocity).not.toHaveBeenCalled();
  });
});
