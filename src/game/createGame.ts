import Phaser from "phaser";
import { gameConfig } from "./gameConfig";

export function createGame(mount: HTMLElement) {
  return new Phaser.Game({
    ...gameConfig,
    type: Phaser.AUTO,
    parent: mount,
  });
}
