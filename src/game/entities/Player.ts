import Phaser from "phaser";

export type ActorConfig = {
  color: number;
  knockbackSpeed: number;
  slapRange: number;
  size: number;
  speed: number;
};

export type ActorState = {
  body: Phaser.Physics.Arcade.Body;
  facing: Phaser.Math.Vector2;
  knockbackSpeed: number;
  knockbackMultiplier: number;
  lastAttackAt: number;
  moveSpeed: number;
  size: number;
  slapRange: number;
  spawn: Phaser.Math.Vector2;
  sprite: Phaser.GameObjects.Rectangle;
  speedMultiplier: number;
  shieldedUntil: number;
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
  body.setDrag(0.003);
  body.setMaxVelocity(config.speed * 2, config.speed * 2);

  return {
    body,
    facing: new Phaser.Math.Vector2(1, 0),
    knockbackSpeed: config.knockbackSpeed,
    knockbackMultiplier: 1,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: config.speed,
    size: config.size,
    slapRange: config.slapRange,
    spawn: new Phaser.Math.Vector2(x, y),
    speedMultiplier: 1,
    shieldedUntil: 0,
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

export function moveActor(
  actor: ActorState,
  direction: Phaser.Math.Vector2,
): void {
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
  actor.speedMultiplier = 1;
  actor.shieldedUntil = 0;
}
