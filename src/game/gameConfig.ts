import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { PreloadScene } from "./scenes/PreloadScene";

export const sceneClasses = [BootScene, PreloadScene, MenuScene];

export const gameConfig = {
  width: 1280,
  height: 720,
  backgroundColor: "#101820",
  scale: {
    // Note: the previous literals were `mode: 3, autoCenter: 1`. In Phaser
    // 3.80 `Scale.ScaleModes` values are NONE=0, WIDTH_CONTROLS_HEIGHT=1,
    // HEIGHT_CONTROLS_WIDTH=2, FIT=3, ENVELOP=4, RESIZE=5, EXPAND=6. So
    // `mode: 3` is FIT (aspect-ratio preserving), not RESIZE. We use the
    // named constant `Phaser.Scale.FIT` to preserve the original behaviour
    // while making the intent obvious.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade" as const,
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: sceneClasses,
};
