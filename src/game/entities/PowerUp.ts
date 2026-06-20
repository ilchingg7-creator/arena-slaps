import Phaser from "phaser";

export type PowerUp = {
  sprite: Phaser.GameObjects.Arc;
};

export function createPowerUp(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color: number,
): PowerUp {
  return {
    sprite: scene.add.circle(x, y, size, color),
  };
}
