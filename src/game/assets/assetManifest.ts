export type ImageAsset = {
  key: string;
  kind: "image";
  uri: string;
};

export const assetManifest: ImageAsset[] = [
  {
    key: "ui-button-placeholder",
    kind: "image",
    uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnRnk8AAAAASUVORK5CYII=",
  },
];
