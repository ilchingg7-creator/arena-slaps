import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { PreloadScene } from "./scenes/PreloadScene";

export const sceneClasses = [BootScene, PreloadScene, MenuScene];

export const gameConfig = {
  width: 1280,
  height: 720,
  backgroundColor: "#101820",
  scale: {
    mode: 3,
    autoCenter: 1,
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
