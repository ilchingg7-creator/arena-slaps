/**
 * Background — a full-screen backdrop component for Phaser scenes.
 *
 * The game's scenes (Menu, Battle, Results) all want a full-screen
 * background image. This component centralises that pattern:
 *
 *   - Looks up the sprite key in {@link spriteManifest} (so every
 *     background is registered in the same manifest as character / UI
 *     sprites — no parallel "background list" to drift out of sync).
 *   - If the PNG is loaded into Phaser's TextureManager, renders an
 *     `Image` scaled to fill the screen (`setDisplaySize(width, height)`).
 *   - If the PNG is missing (art not ready yet, low-end device that
 *     skipped the sprite load, etc.), falls back to a solid-color
 *     `Rectangle` covering the whole screen — using the manifest's
 *     `fallbackColor` by default, or an explicit `config.fallbackColor`
 *     when the caller wants to override.
 *   - Always sits at depth {@link BG_DEPTH} (-100) so scene content
 *     (depth > 0) renders on top without per-call tuning.
 *
 * Type-only Phaser import: this file uses `import type Phaser from "phaser"`
 * so it does NOT load Phaser at runtime — it's safe to import from unit
 * tests (which pass a stub scene cast to `Phaser.Scene`). Phaser's actual
 * runtime is only touched when a real `Phaser.Scene` calls
 * {@link createBackground}.
 */

import type Phaser from "phaser";
import { getSpriteDefinition } from "../assets/spriteManifest";
import { NEON_COLORS } from "./neonTheme";

export type BackgroundConfig = {
  /** Sprite key registered in {@link spriteManifest}. */
  key: string;
  /**
   * Fill color for the fallback rectangle when the sprite texture is
   * missing. Defaults to the manifest definition's `fallbackColor`.
   * If provided, overrides the manifest value.
   */
  fallbackColor?: number;
};

export type Background = {
  /**
   * The currently-rendered game object (Image when the texture is
   * loaded, Rectangle otherwise). The caller may adjust depth / alpha /
   * scroll factor on this object directly. Replaced atomically by
   * {@link setKey} — read this property again after a `setKey` call to
   * get the new object.
   */
  readonly gameObject: Phaser.GameObjects.GameObject;
  /** Switch to a different background key at runtime. */
  setKey: (key: string) => void;
  /** Destroy the background and its underlying game object. */
  destroy: () => void;
};

/** Depth at which the background is rendered (behind everything else). */
const BG_DEPTH = -100;
/** Default screen width when `scene.scale.width` is not set (e.g. test stubs). */
const DEFAULT_WIDTH = 1280;
/** Default screen height when `scene.scale.height` is not set. */
const DEFAULT_HEIGHT = 720;

type BackgroundGraphics = {
  setDepth: (depth: number) => BackgroundGraphics;
  fillStyle: (color: number, alpha?: number) => BackgroundGraphics;
  fillRect: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => BackgroundGraphics;
  lineStyle: (width: number, color: number, alpha?: number) => BackgroundGraphics;
  strokeRect: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => BackgroundGraphics;
  destroy: () => void;
};

type RenderedBackground = {
  primary: Phaser.GameObjects.GameObject;
  overlay?: BackgroundGraphics;
};

/**
 * Render a full-screen background image. If the sprite texture is loaded,
 * uses an `Image` scaled to fill the screen. Otherwise, falls back to a
 * solid-color `Rectangle` covering the whole screen.
 *
 * The background is placed at depth {@link BG_DEPTH} (-100), behind
 * everything else. Scenes should set their other objects to depth > 0
 * (the SpriteManager already defaults to depth 0, which is > -100).
 *
 * Throws if `config.key` is not registered in the sprite manifest —
 * that's a programmer error (typo, referencing a sprite that hasn't
 * been added yet) and should fail loudly at the call site.
 */
export function createBackground(
  scene: Phaser.Scene,
  config: BackgroundConfig,
): Background {
  const width = scene.scale.width ?? DEFAULT_WIDTH;
  const height = scene.scale.height ?? DEFAULT_HEIGHT;
  const centerX = width / 2;
  const centerY = height / 2;

  function destroyRendered(rendered: RenderedBackground): void {
    rendered.primary.destroy();
    rendered.overlay?.destroy();
  }

  function make(key: string): RenderedBackground {
    // Throws synchronously for unknown keys — programmer error.
    const def = getSpriteDefinition(key);

    if (scene.textures.exists(key)) {
      const img = scene.add.image(centerX, centerY, key);
      img.setDisplaySize(width, height);
      img.setDepth(BG_DEPTH);
      const overlay = (scene.add.graphics() as BackgroundGraphics)
        .setDepth(BG_DEPTH + 1);
      overlay.fillStyle(NEON_COLORS.bgInk, 0.3);
      overlay.fillRect(0, 0, width, height);
      overlay.lineStyle(2, NEON_COLORS.cyan, 0.1);
      overlay.strokeRect(24, 24, width - 48, height - 48);
      return {
        primary: img as unknown as Phaser.GameObjects.GameObject,
        overlay,
      };
    }

    // Fallback: solid-color rectangle covering the whole screen. Caller
    // may override the manifest's fallbackColor via config.fallbackColor.
    const color = config.fallbackColor ?? def.fallbackColor;
    const rect = scene.add.rectangle(centerX, centerY, width, height, color);
    rect.setDepth(BG_DEPTH);
    return {
      primary: rect as unknown as Phaser.GameObjects.GameObject,
    };
  }

  let current = make(config.key);

  return {
    get gameObject(): Phaser.GameObjects.GameObject {
      return current.primary;
    },
    setKey(key: string) {
      destroyRendered(current);
      current = make(key);
    },
    destroy() {
      destroyRendered(current);
    },
  };
}
