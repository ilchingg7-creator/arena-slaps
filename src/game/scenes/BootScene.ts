import Phaser from "phaser";

/**
 * Boot scene — refreshes the scale manager and immediately transitions to
 * the PreloadScene. The first scene in the game's scene list.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.scale.refresh();
    this.scene.start("PreloadScene");
  }
}
