/**
 * Sprite asset loader functions.
 *
 * These are tiny adapter helpers that take a Phaser scene-like object and
 * a list of sprite / atlas definitions and call the appropriate
 * `scene.load.*` method for each entry. They exist so that
 * `PreloadScene.preload` can stay a one-liner regardless of how many
 * sprites are registered in the manifest.
 *
 * The scene-like type is a minimal structural duck type
 * ({@link SceneLoaderLike}) so unit tests can pass in a stub without
 * instantiating Phaser. Phaser's real `Phaser.Scene` satisfies this
 * interface (its `load` plugin exposes `image` and `atlas`).
 */

import {
  SPRITE_DEFINITIONS,
  SPRITE_ATLASES,
  type SpriteDefinition,
  type AtlasDefinition,
} from "./spriteManifest";

export type SceneLoaderLike = {
  /** Phaser's `load.image(key, url)`. */
  image: (key: string, url: string) => void;
  /** Phaser's `load.atlas(key, textureURL, atlasURL)`. */
  atlas: (key: string, textureURL: string, atlasURL: string) => void;
};

/**
 * Call `scene.image(key, path)` for every sprite in `sprites`.
 * Safe to call with an empty list.
 */
export function loadSprites(
  scene: SceneLoaderLike,
  sprites: readonly SpriteDefinition[],
): void {
  for (const s of sprites) {
    scene.image(s.key, s.path);
  }
}

/**
 * Call `scene.atlas(key, imagePath, atlasPath)` for every atlas in
 * `atlases`. Safe to call with an empty list.
 */
export function loadAtlases(
  scene: SceneLoaderLike,
  atlases: readonly AtlasDefinition[],
): void {
  for (const a of atlases) {
    scene.atlas(a.key, a.imagePath, a.atlasPath);
  }
}

/**
 * Convenience: load every sprite and atlas declared in the manifest.
 * This is what `PreloadScene.preload` should call.
 */
export function loadAllSprites(scene: SceneLoaderLike): void {
  loadSprites(scene, SPRITE_DEFINITIONS);
  loadAtlases(scene, SPRITE_ATLASES);
}
