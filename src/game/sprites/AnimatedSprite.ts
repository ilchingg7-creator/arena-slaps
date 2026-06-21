/**
 * AnimatedSprite — a thin wrapper around `Phaser.GameObjects.Image` that
 * swaps textures based on the actor's logical animation state
 * (idle / run-N / run-S / run-E / run-W / slap / fall) and applies a tint
 * overlay when a power-up effect is active.
 *
 * Why this exists (Task 2a): the original BattleScene rendered each actor
 * as a single `add.rectangle` primitive whose color never changed. To make
 * the game feel alive we generated directional run / slap / fall PNGs for
 * both the player and the bot, plus power-up tint overlays. The
 * AnimatedSprite is the visual half of that upgrade — it sits ON TOP of the
 * (still physics-driven) rectangle, mirrors its position every frame, and
 * picks the right texture + tint based on the actor's state.
 *
 * The rectangle continues to own the Arcade Physics body and is responsible
 * for all collision / movement. The AnimatedSprite is purely visual:
 *   - It is NOT added to the physics world.
 *   - Its `setPosition` is called every frame from `BattleScene.update()` to
 *     track the (hidden) rectangle's body position.
 *   - Its `setVisible(false)` is NEVER called by this module — the rectangle
 *     is hidden instead, so the AnimatedSprite is the only thing the player
 *     sees.
 *
 * Type-only Phaser import: this file uses `import type Phaser from "phaser"`
 * so it does NOT load Phaser at runtime — it's safe to import from unit
 * tests (which pass a stub scene cast to `Phaser.Scene`). Phaser's actual
 * runtime is only touched when the real game instantiates this wrapper with
 * a real `Phaser.Scene`.
 */

import type Phaser from "phaser";

export type AnimationState =
  | "idle"
  | "run-n"
  | "run-s"
  | "run-e"
  | "run-w"
  | "slap"
  | "fall";

export type AnimatedSpriteConfig = {
  /**
   * Base texture key prefix, e.g. "player" or "bot". The full key for any
   * given animation state is `${prefix}-${state}` — e.g. `player-run-n`,
   * `bot-slap`, `player-fall`. The `${prefix}-idle` key is used at creation
   * time as the initial texture.
   */
  prefix: string;
  x: number;
  y: number;
};

export type AnimatedSprite = {
  /**
   * The underlying Phaser sprite (Image). Read-only — use the methods below
   * to mutate. Exposed so the scene can layer additional effects (depth,
   * scroll factor, etc.) on top if needed.
   */
  readonly gameObject: Phaser.GameObjects.Image;
  /** Switch the animation state (swaps the texture to `${prefix}-${state}`). */
  setState: (state: AnimationState) => void;
  /** Get the current animation state. */
  getState: () => AnimationState;
  /** Apply a tint overlay for a power-up effect. Pass null to clear. */
  setEffectTint: (tint: number | null) => void;
  /** Get the current effect tint (or null if none is applied). */
  getEffectTint: () => number | null;
  /** Update position. */
  setPosition: (x: number, y: number) => void;
  /** Get current position. */
  getPosition: () => { x: number; y: number };
  /** Destroy the sprite. */
  destroy: () => void;
};

/**
 * Create an AnimatedSprite for the given prefix at (x, y). The sprite is
 * added to the scene immediately via `scene.add.image` using the
 * `${prefix}-idle` texture key. The caller is expected to have preloaded
 * every `${prefix}-${state}` texture — the manifest in
 * `spriteManifest.ts` enumerates them and `PreloadScene` loads them all
 * at boot.
 *
 * The returned object is a frozen bag of closures over the underlying
 * `Phaser.GameObjects.Image` — there is no class instance, so callers
 * should treat it as an opaque handle and only mutate it via the methods
 * on the bag.
 */
export function createAnimatedSprite(
  scene: Phaser.Scene,
  config: AnimatedSpriteConfig,
): AnimatedSprite {
  const { prefix, x, y } = config;
  const gameObject = scene.add.image(x, y, `${prefix}-idle`) as Phaser.GameObjects.Image;

  let currentState: AnimationState = "idle";
  let currentTint: number | null = null;

  const setState = (state: AnimationState): void => {
    if (state === currentState) {
      // No-op when the state hasn't changed — avoids redundant texture
      // swaps (which invalidate the GPU upload cache) on every frame.
      return;
    }
    gameObject.setTexture(`${prefix}-${state}`);
    currentState = state;
  };

  const getState = (): AnimationState => currentState;

  const setEffectTint = (tint: number | null): void => {
    if (tint === currentTint) {
      // No-op when the tint hasn't changed — avoids redundant tint
      // re-uploads every frame.
      return;
    }
    if (tint === null) {
      gameObject.clearTint();
    } else {
      gameObject.setTint(tint);
    }
    currentTint = tint;
  };

  const getEffectTint = (): number | null => currentTint;

  const setPosition = (px: number, py: number): void => {
    gameObject.setPosition(px, py);
  };

  const getPosition = (): { x: number; y: number } => ({
    x: gameObject.x,
    y: gameObject.y,
  });

  const destroy = (): void => {
    gameObject.destroy();
  };

  return {
    gameObject,
    setState,
    getState,
    setEffectTint,
    getEffectTint,
    setPosition,
    getPosition,
    destroy,
  };
}
