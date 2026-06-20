import type { ImageAsset } from "./assetManifest";

type SceneLoader = {
  image: (key: string, uri: string) => void;
};

type LoaderScene = {
  load: SceneLoader;
};

export function loadAssets(scene: LoaderScene, assets: ImageAsset[]) {
  for (const asset of assets) {
    if (asset.kind === "image") {
      scene.load.image(asset.key, asset.uri);
    }
  }
}
