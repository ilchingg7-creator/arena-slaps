import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { BattleSetupScene } from "./scenes/BattleSetupScene";
import { AudioSettingsScene } from "./scenes/AudioSettingsScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { ProgressionScene } from "./scenes/ProgressionScene";
import { AchievementsScene } from "./scenes/AchievementsScene";
import { CosmeticsScene } from "./scenes/CosmeticsScene";

export const sceneClasses = [
  BootScene,
  PreloadScene,
  MainMenuScene,
  BattleSetupScene,
  AudioSettingsScene,
  ProfileScene,
  ProgressionScene,
  AchievementsScene,
  CosmeticsScene,
];

export const gameConfig = {
  width: 1280,
  height: 720,
  backgroundColor: "#101820",
  scale: {
    mode: Phaser.Scale.RESIZE,
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
