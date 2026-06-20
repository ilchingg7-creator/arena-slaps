import Phaser from "phaser";
import { createActor, moveActor, type ActorConfig, type ActorState } from "./Player";

export type Bot = ActorState & {
  kind: "bot";
};

export function createBot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ActorConfig,
): Bot {
  const actor = createActor(scene, x, y, config, config.color);
  actor.facing.set(-1, 0);

  return {
    ...actor,
    kind: "bot",
  };
}

export function moveBotToward(bot: Bot, target: ActorState): void {
  const delta = new Phaser.Math.Vector2(
    target.sprite.x - bot.sprite.x,
    target.sprite.y - bot.sprite.y,
  );

  moveActor(bot, delta);
}
