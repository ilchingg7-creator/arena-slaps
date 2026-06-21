import type Phaser from "phaser";
import { createActor, type ActorConfig, type ActorState } from "./Player";

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
