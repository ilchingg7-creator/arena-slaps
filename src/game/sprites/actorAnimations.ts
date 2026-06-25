/**
 * actorAnimations — pure helpers that map an actor's logical state
 * (velocity, knockback, power-up effects) onto the visual cues the
 * {@link AnimatedSprite} consumes (animation state + effect tint).
 *
 * Why this exists (Task 2a): the AnimatedSprite is a dumb visual handle —
 * it knows how to swap a texture and apply a tint, but it doesn't know
 * what an "actor" is. These helpers bridge the gap: BattleScene feeds them
 * an {@link ActorState} + the current wall-clock `now`, and they return a
 * concrete `AnimationState` and (optionally) a tint color.
 *
 * Both helpers are PURE: they read the actor's fields but never mutate
 * them. This means:
 *   - They're trivially unit-testable with plain stub actors (no Phaser
 *     runtime required).
 *   - They're deterministic given the same inputs (no RNG, no side
 *     effects). The only "input" besides the actor is `now` — the scene's
 *     `this.time.now` timestamp.
 *
 * The scene's `update()` calls them once per actor per frame, then passes
 * the results to `AnimatedSprite.setState` / `setEffectTint`. The
 * AnimatedSprite's own no-op-on-unchanged short-circuits keep this cheap
 * even when the actor's state hasn't changed since last frame.
 */

import type { ActorState } from "../entities/Player";
import { isFrozen, isShieldActive, isDoubleSlapReady } from "../systems/PowerUpSystem";
import type { AnimationState } from "./AnimatedSprite";

/**
 * Tint colors applied to the actor's sprite when a power-up effect is
 * active. Exposed as a const object so tests and HUD overlays can reference
 * the same values without hardcoding magic numbers.
 *
 * Color palette (earthy/jewel tones matching the game's existing palette):
 *   - frozen       → 0x88ccff (ice blue)
 *   - shielded     → 0x3d405b (deep navy, matches player base color)
 *   - megaKnockback → 0xe07a5f (burnt orange, matches bot base color)
 *   - doubleSlap   → 0x9b5de5 (purple)
 *   - speed        → 0x81b29a (sage green, matches Boost power-up)
 *   - knockback    → 0xf2cc8f (warm yellow, matches Heavy Hand power-up)
 *   - slowed       → 0x6b7a8f (muted blue-grey, signals "you're camping")
 */
export const EFFECT_TINTS = {
  frozen: 0x88ccff,
  shielded: 0x3d405b,
  megaKnockback: 0xe07a5f,
  doubleSlap: 0x9b5de5,
  speed: 0x81b29a,
  knockback: 0xf2cc8f,
  slowed: 0x6b7a8f,
} as const;

/**
 * Velocity magnitude (in pixels/second) below which the actor is treated
 * as standing still for animation purposes. The body's velocity is set to
 * exactly (0, 0) by `moveActor` when no input is pressed, but Phaser's
 * `setDamping(true) + setDrag(0.05)` configuration can leave a tiny
 * residual float value after knockback decays. 1 px/s is well below the
 * slowest intentional movement (`moveSpeed * speedMultiplier` is at least
 * ~260 px/s) and well above float jitter (~1e-6).
 */
const IDLE_VELOCITY_EPSILON_SQ = 1; // 1 (px/s)^2 — i.e. < 1 px/s in any direction.

/**
 * Knockback multiplier threshold above which a knockback boost is treated
 * as the "mega-knockback" effect (heavy hand upgrade) rather than the
 * regular knockback boost. The regular Heavy Hand power-up sets the
 * multiplier to 1.25; the Mega Hand power-up sets it to 1.75. Anything
 * > 1.5 is unambiguously the mega variant.
 */
const MEGA_KNOCKBACK_MULTIPLIER_THRESHOLD = 1.5;

/**
 * Determine the animation state from the actor's current velocity + facing.
 *
 * Decision tree:
 *   1. If knockback is active (`now < actor.knockbackUntil`) → "fall".
 *      Knockback overrides everything else — the actor is being launched
 *      and should look like they're tumbling regardless of any residual
 *      movement input or slap window.
 *   2. Else if the actor recently slapped (`now - actor.lastAttackAt < 200`)
 *      → "slap". The slap animation is a brief 200ms one-shot triggered
 *      by `applySlap` stamping `lastAttackAt = now`. Priority is slap >
 *      run > idle so the player sees their own slap connect even while
 *      still holding a movement key (slap beats run).
 *   3. Else if the actor's body velocity is ~0 (below
 *      {@link IDLE_VELOCITY_EPSILON_SQ}) → "idle".
 *   4. Else pick a run-N/S/E/W state based on the DOMINANT velocity axis:
 *      - If |vy| >= |vx| → vertical movement dominates → run-n (vy < 0,
 *        moving up) or run-s (vy > 0, moving down).
 *      - Else → horizontal movement dominates → run-e (vx > 0) or run-w
 *        (vx < 0).
 */
export function getActorAnimationState(
  actor: ActorState,
  now: number,
): AnimationState {
  // 1. Knockback overrides everything — actor is being launched.
  if (now < actor.knockbackUntil) {
    return "fall";
  }

  // 2. MINOR-1: slap animation. The actor is slapping when their most
  // recent slap landed within the last 200ms. `lastAttackAt` is stamped
  // by `applySlap` on every successful slap (after the cooldown / range /
  // shield gates pass), so this window is exactly the visible slap
  // duration. Default `lastAttackAt = -Infinity` makes the check
  // trivially false at spawn, so this branch never fires for an actor
  // that has never slapped.
  if (now - actor.lastAttackAt < 200) {
    return "slap";
  }

  const vx = actor.body.velocity.x;
  const vy = actor.body.velocity.y;
  const speedSq = vx * vx + vy * vy;

  // 3. Effectively stationary.
  if (speedSq < IDLE_VELOCITY_EPSILON_SQ) {
    return "idle";
  }

  // 4. Dominant-axis run direction. Phaser's coordinate system has +y
  // pointing down, so vy < 0 = moving north (up) and vy > 0 = moving
  // south (down). +x is east (right), -x is west (left).
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);
  if (absY >= absX) {
    return vy < 0 ? "run-n" : "run-s";
  }
  return vx > 0 ? "run-e" : "run-w";
}

/**
 * Determine the tint to apply based on active power-up effects.
 *
 * Returns null if no effect is active. When multiple effects are active
 * simultaneously, returns the highest-priority one — see the priority
 * list below. This avoids the actor's sprite flickering between tints
 * frame-to-frame when, say, both Boost and Shield are active.
 *
 * Priority (highest first):
 *   1. frozen        — Freeze power-up applied by the opponent. The actor
 *                      literally can't move, so this is the most
 *                      visually-informative tint.
 *   2. shielded      — Shield power-up. The actor has at least one hit
 *                      remaining AND the shield hasn't expired.
 *   3. mega-knockback — Mega Hand power-up (knockbackMultiplier > 1.5).
 *                      Distinguished from regular knockback by the
 *                      multiplier threshold.
 *   4. double-slap   — Double-Slap power-up. Next slap hits twice.
 *   5. speed         — Boost power-up. Speed multiplier is active.
 *   6. knockback     — Heavy Hand power-up (regular knockback boost).
 *                      Lowest priority among power-up tints.
 *   7. slowed        — AntiCampSystem penalty. The actor hasn't landed a
 *                      slap in a while and is moving at reduced speed.
 *                      Lowest priority overall — every power-up tint wins
 *                      over it so the player always sees what power-up is
 *                      active even while being penalized for camping.
 *
 * Note: the priority order is intentional, not arbitrary. Frozen > shielded
 * because frozen is a debuff the actor wants to see coming; shielded >
 * mega-knockback because the shield represents protection (more important
 * to communicate than an offensive boost); mega-knockback > double-slap
 * because the mega-knockback affects the actor's own appearance more
 * dramatically; double-slap > speed because double-slap is a one-shot
 * window the player needs to act on; speed > knockback because the regular
 * knockback boost is the least visually-distinct effect; all power-up
 * tints > slowed because camping is a passive state and shouldn't mask
 * the player's active power-up.
 */
export function getActorEffectTint(
  actor: ActorState,
  now: number,
  battleStartAt = 0,
): number | null {
  // 1. Frozen (highest priority).
  if (isFrozen(actor, now)) {
    return EFFECT_TINTS.frozen;
  }

  // 2. Shielded.
  if (isShieldActive(actor, now)) {
    return EFFECT_TINTS.shielded;
  }

  // 3. Mega-knockback (knockback boost active AND multiplier > 1.5).
  if (
    now < actor.knockbackBoostUntil &&
    actor.knockbackMultiplier > MEGA_KNOCKBACK_MULTIPLIER_THRESHOLD
  ) {
    return EFFECT_TINTS.megaKnockback;
  }

  // 4. Double-slap.
  if (isDoubleSlapReady(actor, now)) {
    return EFFECT_TINTS.doubleSlap;
  }

  // 5. Speed (Boost power-up active).
  if (now < actor.speedBoostUntil) {
    return EFFECT_TINTS.speed;
  }

  // 6. Regular knockback (Heavy Hand, multiplier <= 1.5).
  if (now < actor.knockbackBoostUntil) {
    return EFFECT_TINTS.knockback;
  }

  // Note: the "slowed" tint from AntiCampSystem was removed from here
  // because it overrode the cosmetic base tint, making the player's
  // chosen color invisible. The speed reduction itself is sufficient
  // feedback for the camping penalty — no visual tint needed.

  return null;
}
