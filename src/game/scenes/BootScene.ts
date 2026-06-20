type SceneScale = {
  refresh?: () => void;
};

type SceneController = {
  start: (key: string) => void;
};

type BootSceneContext = {
  scale?: SceneScale;
  scene: SceneController;
};

export const BootScene = {
  name: "BootScene",
  key: "BootScene",
  create(this: BootSceneContext) {
    this.scale?.refresh?.();
    this.scene.start("PreloadScene");
  },
};
