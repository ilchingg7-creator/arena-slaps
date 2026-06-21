import Phaser from "phaser";
import type { RoundState } from "./RoundSystem";
import { registerPoint } from "./RoundSystem";
import type { ScoringSide } from "./ScoringSystem";
import type { ActorState } from "../entities/Player";

const SLAP_COOLDOWN_MS = 450;
const KNOCKBACK_DURATION_MS = 280;

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

  attacker.lastAttackAt = now;

  if (defender.shieldedUntil > now) {
    return false;
  }

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
