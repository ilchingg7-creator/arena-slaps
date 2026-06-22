import Phaser from "phaser";
import type { ActorState } from "../entities/Player";
import {
  consumeShieldHit,
  expirePowerUpBoosts,
  isDoubleSlapReady,
  isShieldActive,
} from "./PowerUpSystem";
import { isDodging } from "./DodgeSystem";
import { battleConfig } from "../config/battleConfig";

const { slapCooldownMs: SLAP_COOLDOWN_MS, knockbackDurationMs: KNOCKBACK_DURATION_MS } =
  battleConfig.combat;

/**
 * Combo system constants (Task 2ac).
 *
 *   - COMBO_TIMEOUT_MS: if the attacker has not landed a slap in this window,
 *     their `comboStacks` reset to 0. Tuned at 3s so a brief evasive pause
 *     doesn't break a combo but a disengagement does.
 *   - COMBO_KNOCKBACK_TIER1 / TIER2: stack thresholds. At TIER1 (3 stacks)
 *     the slap's knockback is multiplied by 1.5; at TIER2 (5 stacks) it is
 *     multiplied by 3.0 (the "mega-launch"). The 4-stack case still falls
 *     in the TIER1 band (1.5x) — only the 5th stack unlocks the 3.0x band.
 *   - COMBO_CAP: hard ceiling on `comboStacks`. `applySlap` clamps the
 *     post-increment value to this so a long combo doesn't overflow into
 *     a higher multiplier band than intended.
 *   - COMBO_MULT_TIER1 / TIER2 / BASE: the actual multipliers.
 */
const COMBO_TIMEOUT_MS = 3000;
const COMBO_KNOCKBACK_TIER1 = 3;
const COMBO_KNOCKBACK_TIER2 = 5;
const COMBO_CAP = 5;
const COMBO_MULT_BASE = 1.0;
const COMBO_MULT_TIER1 = 1.5;
const COMBO_MULT_TIER2 = 3.0;

/**
 * Resolve the combo multiplier for `attacker` at wall-clock time `now`.
 *
 * Returns:
 *   - 1.0 when comboStacks < 3 (or stale — see below)
 *   - 1.5 when 3 <= comboStacks <= 4
 *   - 3.0 when comboStacks === 5 (mega-launch)
 *
 * As a side effect, this function ALSO resets `comboStacks` to 0 when the
 * combo has timed out (`now - attacker.lastSlapAt > COMBO_TIMEOUT_MS`).
 * The reset happens BEFORE the multiplier is computed, so a stale 5-stack
 * combo returns 1.0 (not 3.0). This lets the HUD / BattleScene call
 * `getComboMultiplier` every frame as a cheap "tick the combo timer" hook.
 *
 * Note: the very first slap by a fresh actor has `lastSlapAt = -Infinity`,
 * so `now - lastSlapAt` is always > COMBO_TIMEOUT_MS — but `comboStacks`
 * is also 0 in that case, so the reset is a no-op and the function
 * correctly returns 1.0.
 */
export function getComboMultiplier(attacker: ActorState, now: number): number {
  // Reset stale combo before computing the multiplier. The stale check
  // only fires when comboStacks > 0 — a fresh actor (comboStacks = 0)
  // skips the reset, so we don't churn the field on every frame.
  if (attacker.comboStacks > 0 && now - attacker.lastSlapAt > COMBO_TIMEOUT_MS) {
    attacker.comboStacks = 0;
  }
  if (attacker.comboStacks >= COMBO_KNOCKBACK_TIER2) {
    return COMBO_MULT_TIER2;
  }
  if (attacker.comboStacks >= COMBO_KNOCKBACK_TIER1) {
    return COMBO_MULT_TIER1;
  }
  return COMBO_MULT_BASE;
}

/**
 * Apply a single slap attempt: cooldown check, range check, shield block,
 * dodge i-frames, then knockback. Returns `true` when the slap landed
 * (knockback applied) and `false` on miss / cooldown / shield-block /
 * dodge.
 *
 * NOTE: This function no longer awards points. Scoring moved to the
 * ring-out handler in `BattleScene.update()` (see `handleRingOut`). Slaps
 * only apply knockback — points are scored when an actor is knocked out
 * of the arena. The previous signature took `round` / `side` /
 * `winningScore` so it could call `registerPoint` directly; those
 * parameters have been removed to make the "no scoring from slaps"
 * invariant structural.
 *
 * Combo system (Task 2ac):
 *   - Before applying the slap, the attacker's stale combo is reset
 *     (same logic as {@link getComboMultiplier}).
 *   - The slap's knockback is multiplied by the current combo multiplier
 *     (1.0 / 1.5 / 3.0 depending on comboStacks).
 *   - On a successful slap, the attacker's `comboStacks` is incremented
 *     (capped at 5) and `lastSlapAt` is stamped.
 *   - The defender's `comboStacks` is reset to 0 (getting hit breaks
 *     your combo).
 *
 * Dodge i-frames (Task 2ac):
 *   - If the defender is mid-dodge (`isDodging(defender, now)`), the slap
 *     whiffs through them — `applySlap` returns false WITHOUT consuming
 *     the attacker's cooldown. The dodge check fires AFTER the cooldown /
 *     range gates so an out-of-range swing still consumes nothing.
 */
export function applySlap(
  attacker: ActorState,
  defender: ActorState,
  now: number,
): boolean {
  // Stamp the attempt timestamp BEFORE any cooldown / range / shield gates
  // fire. `lastAttackAt` (stamped below on a successful hit) only fires on a
  // clean slap, which means the bot's dodge logic (keyed off the player's
  // attack) would only trigger ~280ms AFTER the bot was already knocked back.
  // `lastSlapAttemptAt` fires on EVERY attempt so the bot can react to the
  // swing windup — see `BotAI.computeRawBotDirection`.
  attacker.lastSlapAttemptAt = now;

  if (now - attacker.lastAttackAt < SLAP_COOLDOWN_MS) {
    return false;
  }

  const distance = Phaser.Math.Distance.Between(
    attacker.sprite.x,
    attacker.sprite.y,
    defender.sprite.x,
    defender.sprite.y,
  );

  if (distance > attacker.slapRange) {
    return false;
  }

  // Shield check happens BEFORE consuming the attacker's cooldown. A blocked
  // slap is a no-op for the attacker: their hand is still ready for the next
  // attempt. Only successful (unblocked) slaps trigger the 450ms cooldown.
  // The shield is also consumed (1 hit) on block.
  if (isShieldActive(defender, now)) {
    consumeShieldHit(defender);
    return false;
  }

  // Dodge i-frames (Task 2ac): if the defender is mid-dodge, the slap
  // whiffs through them. The attacker's cooldown is NOT consumed (matching
  // the shield-block semantics — a whiffed swing keeps the hand ready).
  if (isDodging(defender, now)) {
    return false;
  }

  attacker.lastAttackAt = now;

  // Expire any attacker power-up boosts whose timer has elapsed before
  // computing the knockback velocity. This ensures the Heavy Hand boost
  // reverts to baseline the moment its 8s window ends, even if the attacker
  // hasn't moved since picking it up.
  expirePowerUpBoosts(attacker, now);

  // Combo system (Task 2ac): reset stale combo BEFORE computing the
  // multiplier so a 3-second-paused 5-stack returns 1.0 (not 3.0).
  if (attacker.comboStacks > 0 && now - attacker.lastSlapAt > COMBO_TIMEOUT_MS) {
    attacker.comboStacks = 0;
  }
  const comboMultiplier = getComboMultiplier(attacker, now);

  // C1: Double-Slap power-up. When the attacker has a double-slap boost
  // ready (set by the `double-slap` power-up effect), the next successful
  // slap hits TWICE — concretely, the defender is launched with double the
  // knockback velocity. The boost is consumed on use (reset to 0) so the
  // subsequent slap is a normal single slap. The check happens AFTER the
  // cooldown / range / shield gates so a missed slap (cooldown, out of
  // range, or shield-blocked) does NOT consume the boost — only a slap
  // that actually lands triggers the double-hit.
  const doubleSlapReady = isDoubleSlapReady(attacker, now);
  const doubleSlapMultiplier = doubleSlapReady ? 2 : 1;
  if (doubleSlapReady) {
    attacker.doubleSlapUntil = 0;
  }

  const direction = new Phaser.Math.Vector2(
    defender.sprite.x - attacker.sprite.x,
    defender.sprite.y - attacker.sprite.y,
  ).normalize();

  defender.knockbackUntil = now + KNOCKBACK_DURATION_MS;
  defender.body.setVelocity(
    direction.x *
      attacker.knockbackSpeed *
      attacker.knockbackMultiplier *
      doubleSlapMultiplier *
      comboMultiplier,
    direction.y *
      attacker.knockbackSpeed *
      attacker.knockbackMultiplier *
      doubleSlapMultiplier *
      comboMultiplier,
  );

  // Combo bookkeeping (Task 2ac): the attacker's combo grows on every
  // successful slap (capped at 5). The defender's combo resets — getting
  // hit breaks your combo. The multiplier used above is the PRE-increment
  // value, so the slap that earns you the 3rd stack still uses the 1.0x
  // multiplier (the 1.5x kicks in on the 4th swing).
  attacker.comboStacks = Math.min(COMBO_CAP, attacker.comboStacks + 1);
  attacker.lastSlapAt = now;
  defender.comboStacks = 0;

  // Scoring moved to the ring-out handler in BattleScene.update() —
  // see `handleRingOut`. Slaps apply knockback only.
  return true;
}

export function isRingOut(
  actor: ActorState,
  arena: Phaser.Geom.Rectangle,
  margin: number,
): boolean {
  return (
    actor.sprite.x < arena.left - margin ||
    actor.sprite.x > arena.right + margin ||
    actor.sprite.y < arena.top - margin ||
    actor.sprite.y > arena.bottom + margin
  );
}
