import Phaser from "phaser";
import type { RoundState } from "./RoundSystem";
import { registerPoint } from "./RoundSystem";
import type { ScoringSide } from "./ScoringSystem";
import type { ActorState } from "../entities/Player";
import {
  consumeShieldHit,
  expirePowerUpBoosts,
  isShieldActive,
} from "./PowerUpSystem";
import { battleConfig } from "../config/battleConfig";

const { slapCooldownMs: SLAP_COOLDOWN_MS, knockbackDurationMs: KNOCKBACK_DURATION_MS } =
  battleConfig.combat;

export function applySlap(
  attacker: ActorState,
  defender: ActorState,
  round: RoundState,
  side: ScoringSide,
  winningScore: number,
  now: number,
): boolean {
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

  const direction = new Phaser.Math.Vector2(
    defender.sprite.x - attacker.sprite.x,
    defender.sprite.y - attacker.sprite.y,
  ).normalize();

  defender.knockbackUntil = now + KNOCKBACK_DURATION_MS;
  defender.body.setVelocity(
    direction.x * attacker.knockbackSpeed * attacker.knockbackMultiplier,
    direction.y * attacker.knockbackSpeed * attacker.knockbackMultiplier,
  );
  registerPoint(round, side, winningScore);
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
