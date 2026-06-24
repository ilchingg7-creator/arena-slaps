import { describe, expect, expectTypeOf, it } from "vitest";
import {
  POWERUP_TIMINGS,
  type PowerUpTimings,
} from "./powerUpTimings";

// Pure-timing keys that must be strictly positive. Visual offsets such as
// `labelOffsetY` are intentionally negative and are validated separately.
const positiveTimingKeys = [
  "despawnAfterMs",
  "despawnWarningMs",
  "blinkIntervalMs",
  "speedBoostMs",
  "knockbackBoostMs",
  "shieldMs",
  "megaKnockbackBoostMs",
  "freezeMs",
  "doubleSlapMs",
  "collectDistance",
] as const satisfies readonly (keyof PowerUpTimings)[];

const effectDurationKeys = [
  "speedBoostMs",
  "knockbackBoostMs",
  "shieldMs",
  "megaKnockbackBoostMs",
  "freezeMs",
  "doubleSlapMs",
] as const satisfies readonly (keyof PowerUpTimings)[];

describe("POWERUP_TIMINGS", () => {
  it("exposes all expected timing keys as positive numbers", () => {
    for (const key of positiveTimingKeys) {
      const value = POWERUP_TIMINGS[key];
      expect(typeof value, `key ${key} should be a number`).toBe("number");
      expect(value, `key ${key} should be positive`).toBeGreaterThan(0);
    }
  });

  it("labelOffsetY is a non-zero number (negative by design — label sits above)", () => {
    expect(typeof POWERUP_TIMINGS.labelOffsetY).toBe("number");
    expect(POWERUP_TIMINGS.labelOffsetY).not.toBe(0);
    expect(POWERUP_TIMINGS.labelOffsetY).toBeLessThan(0);
  });

  it("despawnAfterMs > despawnWarningMs (warning must come before despawn)", () => {
    expect(POWERUP_TIMINGS.despawnAfterMs).toBeGreaterThan(
      POWERUP_TIMINGS.despawnWarningMs,
    );
  });

  it("spawnSlots has at least 3 entries", () => {
    expect(POWERUP_TIMINGS.spawnSlots.length).toBeGreaterThanOrEqual(3);
  });

  it("each spawnSlot has x and y in [0, 1]", () => {
    for (const slot of POWERUP_TIMINGS.spawnSlots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(1);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(1);
    }
  });

  it("all effect durations are positive", () => {
    for (const key of effectDurationKeys) {
      const value = POWERUP_TIMINGS[key];
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    }
  });

  it("is `as const` — every literal property has a narrowed (literal) type", () => {
    // `as const` narrows each scalar property to its literal type at the
    // TypeScript level. We assert the literal types here so that removing
    // `as const` would be a compile-time error caught by `tsc --noEmit`.
    expectTypeOf<PowerUpTimings["despawnAfterMs"]>().toEqualTypeOf<8000>();
    expectTypeOf<PowerUpTimings["despawnWarningMs"]>().toEqualTypeOf<2000>();
    expectTypeOf<PowerUpTimings["blinkIntervalMs"]>().toEqualTypeOf<200>();
    expectTypeOf<PowerUpTimings["speedBoostMs"]>().toEqualTypeOf<8000>();
    expectTypeOf<PowerUpTimings["freezeMs"]>().toEqualTypeOf<1500>();
    expectTypeOf<PowerUpTimings["collectDistance"]>().toEqualTypeOf<36>();
    expectTypeOf<PowerUpTimings["labelOffsetY"]>().toEqualTypeOf<-30>();
  });

  it("has 5 spawn slots at the documented positions", () => {
    expect(POWERUP_TIMINGS.spawnSlots).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
      { x: 0.85, y: 0.15 },
    ]);
  });
});
