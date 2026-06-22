import type { ActorState } from "../entities/Player";

/**
 * Player dodge system (Task 2ac).
 *
 * A dodge is a short (200ms) burst of movement at 2x speed that grants
 * invulnerability frames (i-frames) against slaps. After a dodge, the
 * actor is locked out of dodging again for a 1.5s cooldown.
 *
 * The system is intentionally side-effect-free with respect to physics:
 * `startDodge` only stamps `dodgeUntil` / `dodgeCooldownUntil` on the
 * actor's state — the CALLER (BattleScene) is responsible for applying
 * the dodge velocity to the actor's body. This keeps the system unit-
 * testable without a Phaser runtime.
 *
 * I-frame semantics:
 *   - While `isDodging(actor, now)` is true, `applySlap` short-circuits
 *     and returns false (the slap "whiffs" through the dodging actor).
 *   - The BattleScene's movement block also bypasses the `isKnockedBack`
 *     gate while dodging so the actor can move through knockback.
 */

/** Wall-clock duration (ms) of the dodge burst (i-frames active). */
const DODGE_DURATION_MS = 200;

/** Wall-clock cooldown (ms) after a dodge before the next can begin. */
const DODGE_COOLDOWN_MS = 1500;

/** Velocity multiplier applied to the actor's normal move speed during a dodge. */
const DODGE_SPEED_MULTIPLIER = 2.0;

/**
 * Whether the actor is currently mid-dodge (i-frames active).
 *
 * Returns true iff `now` is within the `[dodgeStart, dodgeStart + DODGE_DURATION_MS)`
 * window. The dodge start is derived from `actor.dodgeUntil - DODGE_DURATION_MS`
 * (so we don't need a separate `dodgeStartedAt` field).
 */
export function isDodging(actor: ActorState, now: number): boolean {
  return now < actor.dodgeUntil;
}

/**
 * Whether the actor can begin a dodge right now.
 *
 * Returns false during the cooldown window (`now < actor.dodgeCooldownUntil`)
 * and true otherwise. Note: being mid-dodge also counts as "on cooldown"
 * because `startDodge` stamps `dodgeCooldownUntil = now + DODGE_COOLDOWN_MS`
 * which always extends past `dodgeUntil` (1.5s >> 200ms).
 */
export function canDodge(actor: ActorState, now: number): boolean {
  return now >= actor.dodgeCooldownUntil;
}

/**
 * Begin a dodge for `actor` in `direction`. Stamps `dodgeUntil` and
 * `dodgeCooldownUntil` on the actor's state.
 *
 * Returns `true` on success, `false` if the actor is currently on cooldown
 * (i.e. `canDodge(actor, now)` is false). On failure the actor's state is
 * untouched.
 *
 * The `direction` argument is captured here for API symmetry with future
 * directional-dodge extensions (e.g. dash trails), but the current
 * implementation does NOT apply any velocity — the caller (BattleScene)
 * is responsible for setting the actor's body velocity using
 * {@link getDodgeSpeedMultiplier}.
 */
export function startDodge(
  actor: ActorState,
  direction: { x: number; y: number },
  now: number,
): boolean {
  if (!canDodge(actor, now)) {
    return false;
  }
  // `direction` is captured for API symmetry / future use; the current
  // implementation does not store it on the actor. The caller applies
  // the velocity using the same direction it passed in here.
  void direction;
  actor.dodgeUntil = now + DODGE_DURATION_MS;
  actor.dodgeCooldownUntil = now + DODGE_COOLDOWN_MS;
  return true;
}

/** Velocity multiplier applied during a dodge (2.0x normal move speed). */
export function getDodgeSpeedMultiplier(): number {
  return DODGE_SPEED_MULTIPLIER;
}

/** Wall-clock duration (ms) of the i-frame window. */
export function getDodgeDurationMs(): number {
  return DODGE_DURATION_MS;
}

/** Wall-clock cooldown (ms) between dodges. */
export function getDodgeCooldownMs(): number {
  return DODGE_COOLDOWN_MS;
}
