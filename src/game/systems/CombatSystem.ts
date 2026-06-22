import Phaser from "phaser";
import type { ActorState } from "../entities/Player";
import {
  consumeShieldHit,
  expirePowerUpBoosts,
  isDoubleSlapReady,
  isShieldActive,
} from "./PowerUpSystem";
import { battleConfig } from "../config/battleConfig";

const { slapCooldownMs: SLAP_COOLDOWN_MS, knockbackDurationMs: KNOCKBACK_DURATION_MS } =
  battleConfig.combat;

/**
 * Apply a single slap attempt: cooldown check, range check, shield block,
 * then knockback. Returns `true` when the slap landed (knockback applied)
 * and `false` on miss / cooldown / shield-block.
 *
 * NOTE: This function no longer awards points. Scoring moved to the
 * ring-out handler in `BattleScene.update()` (see `handleRingOut`). Slaps
 * only apply knockback — points are scored when an actor is knocked out
 * of the arena. The previous signature took `round` / `side` /
 * `winningScore` so it could call `registerPoint` directly; those
 * parameters have been removed to make the "no scoring from slaps"
 * invariant structural.
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

  attacker.lastAttackAt = now;

  // Expire any attacker power-up boosts whose timer has elapsed before
  // computing the knockback velocity. This ensures the Heavy Hand boost
  // reverts to baseline the moment its 8s window ends, even if the attacker
  // hasn't moved since picking it up.
  expirePowerUpBoosts(attacker, now);

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
      doubleSlapMultiplier,
    direction.y *
      attacker.knockbackSpeed *
      attacker.knockbackMultiplier *
      doubleSlapMultiplier,
  );
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
