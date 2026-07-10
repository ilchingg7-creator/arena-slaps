import Phaser from "phaser";
import { gameConfig } from "./gameConfig";

export function createGame(mount: HTMLElement) {
  return new Phaser.Game({
    ...gameConfig,
    // Yandex Browser can leave WebGL framebuffers incomplete after repeated
    // reloads. Canvas has no framebuffer allocation and is fully supported
    // by this game's render path.
    type: Phaser.CANVAS,
    parent: mount,
  });
}
