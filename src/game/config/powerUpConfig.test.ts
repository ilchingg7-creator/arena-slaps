import { describe, expect, it } from "vitest";
import {
  POWERUP_DEFINITIONS,
  getPowerUpCount,
  getPowerUpDefinition,
  getPowerUpDefinitionByIndex,
  type PowerUpDefinition,
  type PowerUpEffect,
} from "./powerUpConfig";
import { POWERUP_TIMINGS } from "./powerUpTimings";

const allEffects: readonly PowerUpEffect[] = [
  "speed",
  "knockback",
  "shield",
  "mega-knockback",
  "freeze",
  "double-slap",
];

describe("POWERUP_DEFINITIONS", () => {
  it("has exactly 6 entries", () => {
    expect(POWERUP_DEFINITIONS).toHaveLength(6);
  });

  it("all 6 effects are unique", () => {
    const keys = POWERUP_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(allEffects);
  });

  it("all definitions have label, description, color, durationKey", () => {
    for (const def of POWERUP_DEFINITIONS) {
      expect(typeof def.label).toBe("string");
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe("string");
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.color).toBe("number");
      expect(Number.isInteger(def.color)).toBe(true);
      expect(typeof def.durationKey).toBe("string");
    }
  });

  it("durationKey for each definition exists in POWERUP_TIMINGS", () => {
    for (const def of POWERUP_DEFINITIONS) {
      expect(def.durationKey in POWERUP_TIMINGS).toBe(true);
      // Each durationKey must resolve to a positive number (the ms duration).
      const duration = POWERUP_TIMINGS[def.durationKey];
      expect(typeof duration).toBe("number");
      expect(duration).toBeGreaterThan(0);
    }
  });

  it("speed has speedMultiplier", () => {
    const speed = getPowerUpDefinition("speed");
    expect(speed.speedMultiplier).toBeDefined();
    expect(typeof speed.speedMultiplier).toBe("number");
    expect(speed.speedMultiplier!).toBeGreaterThan(1);
  });

  it("knockback and mega-knockback both have knockbackMultiplier", () => {
    const knockback = getPowerUpDefinition("knockback");
    const mega = getPowerUpDefinition("mega-knockback");
    expect(knockback.knockbackMultiplier).toBeDefined();
    expect(knockback.knockbackMultiplier!).toBeGreaterThan(1);
    expect(mega.knockbackMultiplier).toBeDefined();
    expect(mega.knockbackMultiplier!).toBeGreaterThan(1);
    // Mega should be stronger than the regular knockback.
    expect(mega.knockbackMultiplier!).toBeGreaterThan(
      knockback.knockbackMultiplier!,
    );
  });

  it("mega-knockback has a shorter duration than the regular knockback", () => {
    const knockback = getPowerUpDefinition("knockback");
    const mega = getPowerUpDefinition("mega-knockback");
    // `durationKey` is typed as the full `keyof typeof POWERUP_TIMINGS`
    // union (which includes the `spawnSlots` array), so we narrow to a
    // number here. Each definition's durationKey points at a numeric ms
    // value — verified by the "durationKey resolves to a positive number"
    // test above.
    const megaMs = POWERUP_TIMINGS[mega.durationKey] as number;
    const knockbackMs = POWERUP_TIMINGS[knockback.durationKey] as number;
    expect(megaMs).toBeLessThan(knockbackMs);
  });
});

describe("getPowerUpDefinition", () => {
  it("returns the correct definition for each key", () => {
    for (const effect of allEffects) {
      const def = getPowerUpDefinition(effect);
      expect(def.key).toBe(effect);
    }
  });

  it("the speed definition matches the documented Boost config", () => {
    const speed = getPowerUpDefinition("speed");
    expect(speed.label).toBe("Boost");
    expect(speed.color).toBe(0x81b29a);
    expect(speed.durationKey).toBe("speedBoostMs");
    expect(speed.speedMultiplier).toBeCloseTo(1.35, 5);
  });

  it("throws for an unknown key", () => {
    // Cast a bogus string to PowerUpEffect to exercise the runtime guard.
    const bad = "not-a-real-effect" as unknown as PowerUpEffect;
    expect(() => getPowerUpDefinition(bad)).toThrow();
  });
});

describe("getPowerUpDefinitionByIndex", () => {
  it("returns the definition at the given index for in-range values", () => {
    expect(getPowerUpDefinitionByIndex(0)).toBe(POWERUP_DEFINITIONS[0]);
    expect(getPowerUpDefinitionByIndex(5)).toBe(POWERUP_DEFINITIONS[5]);
  });

  it("wraps around (index 6 -> 0)", () => {
    expect(getPowerUpDefinitionByIndex(6)).toBe(POWERUP_DEFINITIONS[0]);
    expect(getPowerUpDefinitionByIndex(7)).toBe(POWERUP_DEFINITIONS[1]);
  });

  it("wraps around for negative indices", () => {
    expect(getPowerUpDefinitionByIndex(-1)).toBe(POWERUP_DEFINITIONS[5]);
    expect(getPowerUpDefinitionByIndex(-6)).toBe(POWERUP_DEFINITIONS[0]);
  });
});

describe("getPowerUpCount", () => {
  it("returns 6", () => {
    expect(getPowerUpCount()).toBe(6);
  });

  it("matches POWERUP_DEFINITIONS.length", () => {
    expect(getPowerUpCount()).toBe(POWERUP_DEFINITIONS.length);
  });
});

// Compile-time sanity: ensure every definition's durationKey is a valid
// keyof POWERUP_TIMINGS. This catches typos at the type level.
type _DurationKeyCheck = PowerUpDefinition["durationKey"];
