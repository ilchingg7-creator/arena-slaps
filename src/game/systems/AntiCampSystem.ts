/**
 * AntiCampSystem — slows down actors who haven't landed a slap in a while.
 *
 * The mechanic addresses a camping exploit: a player (or bot) can run
 * around the arena indefinitely without ever engaging, making the round
 * unwinnable for the opponent. This system applies a gradually-increasing
 * movement-speed penalty once an actor's `lastSlapAt` falls outside the
 * grace window. The penalty resets instantly on the next successful slap
 * (`applySlap` already stamps `lastSlapAt = now` on a hit — no extra
 * wiring needed).
 *
 * **Time curve:**
 * ```
 *   time since last slap:  0──────GRACE──────GRACE+RAMP──────∞
 *   multiplier:            1.0    1.0         MIN              MIN
 *                          │ grace │──ramp──│     clamp        │
 * ```
 *
 * Defaults (also re-exported from `battleConfig.ts` for tuning):
 *   - GRACE_MS = 5000  (5s of full speed after the last hit)
 *   - RAMP_MS  = 4000  (4s linear ramp from 1.0 → MIN)
 *   - MIN      = 0.4   (max slowdown = 40% of base speed)
 *
 * **Reset behaviour:** `applySlap` stamps `lastSlapAt = now` on every
 * successful slap. The next call to `getSpeedPenaltyMultiplier` returns
 * 1.0 immediately — the actor is back to full speed the moment they
 * engage. Getting hit does NOT reset the timer (otherwise a player could
 * "tank" hits to keep moving fast).
 *
 * **Fresh actors:** `lastSlapAt` defaults to `Number.NEGATIVE_INFINITY`
 * for a freshly-spawned actor. The system treats this as "no penalty"
 * (returns 1.0) so the very first engagement isn't slowed — the actor
 * hasn't yet had a chance to land a hit. Penalty activates only after
 * the actor's first slap and a subsequent inactive period.
 *
 * **Pure + side-effect-free:** reads the actor's `lastSlapAt` but never
 * mutates it. This makes the system trivially unit-testable and lets the
 * BattleScene / moveActor call it every frame as a cheap read.
 *
 * **Applied in `moveActor`:** the penalty multiplies on top of any
 * power-up `speedMultiplier` — effective speed = `moveSpeed ×
 * speedMultiplier × getSpeedPenaltyMultiplier(actor, now)`. So a Boosted
 * actor who camps still gets slowed (but starts from a higher base).
 */

import type { ActorState } from "../entities/Player";

// Re-exported here so callers can import everything from one module.
// The actual defaults live in `battleConfig.ts` so they sit alongside
// the rest of the battle tuning.
import { battleConfig } from "../config/battleConfig";

/** Grace period (ms) after the last successful slap during which speed is unaffected. */
export const INACTIVITY_GRACE_MS = battleConfig.antiCamp.graceMs;
/** Duration (ms) of the linear ramp from full speed down to MIN_MULTIPLIER. */
export const INACTIVITY_RAMP_MS = battleConfig.antiCamp.rampMs;
/** Floor multiplier — the slowest an actor can be slowed to. */
export const INACTIVITY_MIN_MULTIPLIER = battleConfig.antiCamp.minMultiplier;

/**
 * Compute the speed-penalty multiplier for `actor` at wall-clock time `now`.
 *
 * Returns a number in `[MIN_MULTIPLIER, 1.0]`:
 *   - 1.0 when the actor has never slapped (fresh actors are exempt).
 *   - 1.0 when within the grace window after their last slap.
 *   - Linearly interpolated between 1.0 and MIN_MULTIPLIER during the
 *     ramp window.
 *   - MIN_MULTIPLIER once the ramp has fully elapsed (clamped).
 *
 * Pure: does not mutate `actor`.
 */
export function getSpeedPenaltyMultiplier(
  actor: ActorState,
  now: number,
): number {
  // Fresh actors (never slapped) — no penalty.
  if (actor.lastSlapAt === Number.NEGATIVE_INFINITY) {
    return 1.0;
  }

  const elapsed = now - actor.lastSlapAt;

  // Within the grace window after the last slap — full speed.
  if (elapsed <= INACTIVITY_GRACE_MS) {
    return 1.0;
  }

  // Past the ramp — clamped to the floor.
  if (elapsed >= INACTIVITY_GRACE_MS + INACTIVITY_RAMP_MS) {
    return INACTIVITY_MIN_MULTIPLIER;
  }

  // Inside the ramp window — linear interpolation from 1.0 down to MIN.
  const rampProgress = (elapsed - INACTIVITY_GRACE_MS) / INACTIVITY_RAMP_MS;
  return 1.0 - rampProgress * (1.0 - INACTIVITY_MIN_MULTIPLIER);
}

/**
 * Whether the actor is currently slowed (penalty multiplier < 1.0).
 */
export function isSlowed(
  actor: ActorState,
  now: number,
): boolean {
  if (actor.lastSlapAt === Number.NEGATIVE_INFINITY) {
    return false;
  }
  const elapsed = now - actor.lastSlapAt;
  return elapsed > INACTIVITY_GRACE_MS;
}
