/**
 * Centralised timing configuration for all power-up behaviours.
 *
 * Edit values here to tweak gameplay without touching system logic.
 * Reload the page (dev server) to apply changes — no rebuild needed
 * for values that are read at runtime (most of them).
 */
export const POWERUP_TIMINGS = {
  /** How long a power-up stays on the arena before despawning. */
  despawnAfterMs: 8000,

  /** When to start the blinking animation before despawn. */
  despawnWarningMs: 2000,

  /** Speed of the blink animation (ms per cycle). */
  blinkIntervalMs: 200,

  // --- Effect durations ---
  speedBoostMs: 8000,
  knockbackBoostMs: 8000,
  shieldMs: 5000,
  megaKnockbackBoostMs: 4000,
  freezeMs: 1500,
  doubleSlapMs: 5000,

  // --- Collection ---
  /** How close an actor must be to pick up a power-up (pixels). */
  collectDistance: 36,

  // --- Visual ---
  /** Vertical offset for the label above the power-up. */
  labelOffsetY: -30,

  // --- Spawn slot positions (relative to arena, 0..1) ---
  spawnSlots: [
    { x: 0.5, y: 0.5 }, // center
    { x: 0.15, y: 0.15 }, // top-left
    { x: 0.85, y: 0.85 }, // bottom-right
    { x: 0.15, y: 0.85 }, // bottom-left
    { x: 0.85, y: 0.15 }, // top-right
  ],
} as const;

export type PowerUpTimings = typeof POWERUP_TIMINGS;
