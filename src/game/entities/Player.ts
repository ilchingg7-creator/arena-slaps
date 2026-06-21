import Phaser from "phaser";
import { expirePowerUpBoosts } from "../systems/PowerUpSystem";

export type ActorConfig = {
  color: number;
  knockbackSpeed: number;
  slapRange: number;
  size: number;
  speed: number;
};

/**
 * Pure helper that computes the per-axis max-velocity cap for an actor's
 * physics body. The cap must be high enough that:
 *   1. Normal movement (speed * speedMultiplier, where the Boost power-up
 *      pushes speedMultiplier up to 1.35x) is never clipped, AND
 *   2. Knockback velocity (knockbackSpeed * knockbackMultiplier, where the
 *      Heavy Hand power-up pushes knockbackMultiplier up to 1.25x) is never
 *      clipped either.
 *
 * `speed * 2` covers (1) with plenty of headroom; `knockbackSpeed * 1.5`
 * covers (2) for the worst-case Heavy Hand multiplier (1.25 * 1.2 = 1.5).
 * Picking the larger of the two guarantees neither value is clipped.
 */
export function computeMaxVelocity(config: ActorConfig): number {
  return Math.max(config.speed * 2, config.knockbackSpeed * 1.5);
}

export type ActorState = {
  body: Phaser.Physics.Arcade.Body;
  facing: Phaser.Math.Vector2;
  knockbackSpeed: number;
  knockbackMultiplier: number;
  /** Wall-clock timestamp (ms) until which the Heavy Hand knockback boost is active. 0 = no boost. */
  knockbackBoostUntil: number;
  knockbackUntil: number;
  lastAttackAt: number;
  moveSpeed: number;
  size: number;
  slapRange: number;
  spawn: Phaser.Math.Vector2;
  /** Wall-clock timestamp (ms) until which the Boost speed multiplier is active. 0 = no boost. */
  speedBoostUntil: number;
  speedMultiplier: number;
  /** Number of slaps the shield will still block. 0 = no shield. */
  shieldHitsRemaining: number;
  /** Wall-clock timestamp (ms) until which the shield can still block slaps. */
  shieldUntil: number;
  sprite: Phaser.GameObjects.Rectangle;
};

export type Player = ActorState & {
  kind: "player";
};

export function createActor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ActorConfig,
  colorOverride?: number,
): ActorState {
  const sprite = scene.add.rectangle(
    x,
    y,
    config.size,
    config.size,
    colorOverride ?? config.color,
  );
  scene.physics.add.existing(sprite);

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setCollideWorldBounds(false);
  body.setDamping(true);
  body.setDrag(0.05);
  body.setMaxVelocity(computeMaxVelocity(config), computeMaxVelocity(config));
  body.setBounce(0.3, 0.3);

  return {
    body,
    facing: new Phaser.Math.Vector2(1, 0),
    knockbackSpeed: config.knockbackSpeed,
    knockbackMultiplier: 1,
    knockbackBoostUntil: 0,
    knockbackUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: config.speed,
    size: config.size,
    slapRange: config.slapRange,
    spawn: new Phaser.Math.Vector2(x, y),
    speedBoostUntil: 0,
    speedMultiplier: 1,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    sprite,
  };
}

export function createPlayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ActorConfig,
): Player {
  return {
    ...createActor(scene, x, y, config),
    kind: "player",
  };
}

export function isKnockedBack(actor: ActorState, now: number): boolean {
  return now < actor.knockbackUntil;
}

export function moveActor(
  actor: ActorState,
  direction: Phaser.Math.Vector2,
  now: number,
): void {
  // Expire any power-up boosts whose timer has elapsed. This ensures the
  // Boost speed multiplier reverts to 1 as soon as the 8s window ends —
  // even if the player keeps moving.
  expirePowerUpBoosts(actor, now);

  if (direction.lengthSq() === 0) {
    actor.body.setVelocity(0, 0);
    return;
  }

  const normalized = direction.clone().normalize();
  actor.body.setVelocity(
    normalized.x * actor.moveSpeed * actor.speedMultiplier,
    normalized.y * actor.moveSpeed * actor.speedMultiplier,
  );
  actor.facing.copy(normalized);
}

export function resetActor(actor: ActorState): void {
  actor.sprite.setPosition(actor.spawn.x, actor.spawn.y);
  actor.body.setVelocity(0, 0);
  actor.facing.set(1, 0);
  actor.knockbackMultiplier = 1;
  actor.knockbackBoostUntil = 0;
  actor.knockbackUntil = 0;
  actor.speedBoostUntil = 0;
  actor.speedMultiplier = 1;
  actor.shieldHitsRemaining = 0;
  actor.shieldUntil = 0;
}
