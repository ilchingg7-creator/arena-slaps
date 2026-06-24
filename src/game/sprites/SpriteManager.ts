/**
 * SpriteManager — a small service that scenes use to create game objects
 * from sprite keys, with automatic primitive fallback.
 *
 * Why this exists: the game originally rendered every actor as a Phaser
 * rectangle / circle / text primitive. As we replace those primitives
 * with real sprite art we want a single, type-safe path so that:
 *
 *   1. Adding a new sprite is purely declarative (one row in
 *      `spriteManifest.ts` + drop a PNG in /public/sprites/).
 *   2. If a sprite PNG is missing (e.g. art not ready yet, low-end device
 *      that skipped the sprite load, or simply a typo in the manifest)
 *      the scene still renders a sensible primitive instead of crashing
 *      or showing the infamous green "missing texture" checkerboard.
 *   3. The same call site works for Image-based sprites, atlas-based
 *      animated sprites (future), and primitive fallbacks.
 *
 * Usage:
 *
 *   const sprites = new SpriteManager(this);
 *   const player = sprites.createSprite("player-idle", x, y);
 *   this.physics.add.existing(player);  // or use createPhysicsSprite
 *
 * Type-only Phaser import: this file uses `import type Phaser from "phaser"`
 * so it does NOT load Phaser at runtime — it's safe to import from unit
 * tests (which pass a stub scene cast to `Phaser.Scene`). Phaser's actual
 * runtime is only touched when the real game instantiates this manager
 * with a real `Phaser.Scene`.
 */

import type Phaser from "phaser";
import { getSpriteDefinition } from "../assets/spriteManifest";

export type SpriteManagerConfig = {
  /**
   * If true, always render the fallback primitive instead of the sprite
   * texture, even when the texture is loaded. Useful for headless tests
   * and low-end devices that want to skip sprite rendering entirely.
   */
  forceFallback?: boolean;
};

const DEFAULT_FALLBACK_SIZE = 36;

export class SpriteManager {
  private readonly scene: Phaser.Scene;
  private readonly textureCache: Phaser.Textures.TextureManager;
  private readonly forceFallback: boolean;

  constructor(scene: Phaser.Scene, config: SpriteManagerConfig = {}) {
    this.scene = scene;
    this.textureCache = scene.textures;
    this.forceFallback = config.forceFallback ?? false;
  }

  /**
   * Check if a sprite texture has been loaded and is available in the
   * Phaser TextureManager.
   */
  isLoaded(key: string): boolean {
    return this.textureCache.exists(key);
  }

  /**
   * Create a game object for the given sprite key at (x, y).
   *
   * If the sprite's texture is loaded and `forceFallback` is false,
   * returns a `Phaser.GameObjects.Image` (with optional `setDisplaySize`
   * applied when the manifest declares `width` + `height`).
   *
   * Otherwise returns a fallback primitive (`Phaser.GameObjects.Rectangle`
   * or `Phaser.GameObjects.Circle`) using the manifest's `fallbackColor`
   * and (when declared) `width` / `height`. The default size when neither
   * is declared is 36px.
   *
   * Throws if the key is not registered in the sprite manifest — that's a
   * programmer error and should fail loudly rather than silently rendering
   * a default primitive.
   */
  createSprite(
    key: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.GameObject {
    const def = getSpriteDefinition(key);
    const useFallback = this.forceFallback || !this.isLoaded(key);

    if (!useFallback) {
      const img = this.scene.add.image(x, y, key);
      if (def.width !== undefined && def.height !== undefined) {
        img.setDisplaySize(def.width, def.height);
      }
      return img as unknown as Phaser.GameObjects.GameObject;
    }

    // Fallback to primitive. The branch is selected by the manifest's
    // `fallback` field so artists/designers control the placeholder shape.
    if (def.fallback === "circle") {
      const size = def.width ?? DEFAULT_FALLBACK_SIZE;
      return this.scene.add.circle(
        x,
        y,
        size / 2,
        def.fallbackColor,
      ) as unknown as Phaser.GameObjects.GameObject;
    }
    const w = def.width ?? DEFAULT_FALLBACK_SIZE;
    const h = def.height ?? DEFAULT_FALLBACK_SIZE;
    return this.scene.add.rectangle(
      x,
      y,
      w,
      h,
      def.fallbackColor,
    ) as unknown as Phaser.GameObjects.GameObject;
  }

  /**
   * Create a sprite and add a physics body to it (for actors that need to
   * collide / move). The returned object is the same one returned by
   * {@link createSprite}; the caller can downcast it to access
   * physics-body-specific APIs (e.g. `body.setVelocity`).
   *
   * The caller does NOT need to call `scene.physics.add.existing` again.
   */
  createPhysicsSprite(
    key: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.GameObject {
    const obj = this.createSprite(key, x, y);
    this.scene.physics.add.existing(obj);
    return obj;
  }
}
