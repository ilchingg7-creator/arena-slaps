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
 *   - 1.0 when the actor is within the grace window after their last
 *     slap (or after `battleStartAt` for fresh actors who haven't
 *     slapped yet — Bug 5 fix).
 *   - Linearly interpolated between 1.0 and MIN_MULTIPLIER during the
 *     ramp window.
 *   - MIN_MULTIPLIER once the ramp has fully elapsed (clamped).
 *
 * **Bug 5 fix:** previously fresh actors (`lastSlapAt = -Infinity`)
 * were exempt from anti-camp, allowing a camper to never engage and
 * never be slowed. Now when `lastSlapAt` is `-Infinity`, the function
 * falls back to `battleStartAt` (the wall-clock time the battle
 * started) as the reference point. The grace window starts from the
 * battle's beginning, so a camper who never slaps starts being slowed
 * 5 seconds into the round.
 *
 * `battleStartAt` is OPTIONAL (defaults to 0) for back-compat with
 * call sites that haven't been updated. Production callers (moveActor)
 * should always pass it.
 *
 * Pure: does not mutate `actor`.
 */
export function getSpeedPenaltyMultiplier(
  actor: ActorState,
  now: number,
  battleStartAt = 0,
): number {
  // Issue 2 fix: the first 5 seconds of the round are ALWAYS full speed,
  // regardless of whether the actor has slapped or not. This gives both
  // players a guaranteed grace period from the battle's start to engage
  // without feeling sluggish. After that, the reference point switches
  // to the last successful slap (or battleStartAt for fresh actors).
  const timeSinceBattleStart = now - battleStartAt;
  if (timeSinceBattleStart <= INACTIVITY_GRACE_MS) {
    return 1.0;
  }

  // Bug 5 fix: fresh actors (never slapped) fall back to battleStartAt
  // as the reference point. This prevents a camper from avoiding the
  // penalty by simply never engaging.
  const referenceTime =
    actor.lastSlapAt === Number.NEGATIVE_INFINITY
      ? battleStartAt
      : actor.lastSlapAt;

  const elapsed = now - referenceTime;

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
 *
 * Convenience wrapper around `getSpeedPenaltyMultiplier` for the tint
 * system — `getActorEffectTint` calls this to decide whether to apply
 * the slowed tint.
 *
 * **Bug 5 fix:** like `getSpeedPenaltyMultiplier`, this now takes
 * `battleStartAt` and treats fresh actors as having started the grace
 * window at the battle's beginning. A camper who never slaps will be
 * slowed after the grace window elapses.
 */
export function isSlowed(
  actor: ActorState,
  now: number,
  battleStartAt = 0,
): boolean {
  // Issue 2 fix: the first 5 seconds of the round are never slowed.
  const timeSinceBattleStart = now - battleStartAt;
  if (timeSinceBattleStart <= INACTIVITY_GRACE_MS) {
    return false;
  }
  const referenceTime =
    actor.lastSlapAt === Number.NEGATIVE_INFINITY
      ? battleStartAt
      : actor.lastSlapAt;
  const elapsed = now - referenceTime;
  return elapsed > INACTIVITY_GRACE_MS;
}
