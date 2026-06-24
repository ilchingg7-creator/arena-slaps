/**
 * PowerUpSprite — a thin wrapper around `Phaser.GameObjects.Image` that
 * renders a power-up using the per-type PNG registered in the sprite
 * manifest (e.g. `powerup-speed.png`, `powerup-shield.png`).
 *
 * Why this exists (Task 2b): the previous PowerUpSystem rendered every
 * power-up as a coloured circle via `scene.add.circle(...)`. As we add
 * real sprite art for each of the 6 power-up types we want a single,
 * type-safe wrapper that:
 *
 *   1. Maps a logical {@link PowerUpEffect} to its texture key
 *      (`powerup-<effect>`) so the manifest stays the single source of
 *      truth for sprite keys.
 *   2. Exposes a small, mockable state machine (idle / collected /
 *      despawning) so the BattleScene can drive the visual transition
 *      on pickup and during the despawn warning window.
 *   3. Wraps the bare `Phaser.GameObjects.Image` so callers don't have
 *      to reach into Phaser's API surface for simple operations
 *      (visibility, position, destroy).
 *
 * The wrapper is intentionally minimal — it does NOT own the despawn
 * timer, the spawn slot rotation, or the collection logic. Those remain
 * in `PowerUpSystem.ts`. This module is purely the visual
 * representation.
 *
 * Type-only Phaser import: this file uses `import type Phaser from "phaser"`
 * so it does NOT load Phaser at runtime — it's safe to import from unit
 * tests (which pass a stub scene cast to `Phaser.Scene`). Phaser's actual
 * runtime is only touched when the real game instantiates this wrapper
 * with a real `Phaser.Scene`.
 */

import type Phaser from "phaser";
import type { PowerUpEffect } from "../config/powerUpConfig";

export type PowerUpSpriteState = "idle" | "collected" | "despawning";

/**
 * Permissive scene type that {@link createPowerUpSprite} accepts. Real
 * Phaser scenes satisfy this shape (they have `add.image` and `tweens.add`).
 * Test stubs can satisfy it directly without a cast — see
 * `PowerUpSprite.test.ts` for the stub pattern.
 *
 * Using this permissive type (instead of `Phaser.Scene`) lets
 * `PowerUpSystem.spawnPowerUp` pass its own duck-typed `SceneLike` straight
 * through to `createPowerUpSprite` — no `as unknown as Phaser.Scene` cast
 * needed. The factory only uses `scene.add.image` (to create the bare
 * image) and `scene.tweens.add` (inside the animation methods), so this is
 * the minimal surface.
 *
 * `add.image` returns a `BareImage` (a permissive subset of
 * `Phaser.GameObjects.Image`) instead of the full Phaser type. This lets
 * test stubs return a minimal image stub without implementing all 158
 * properties of `Phaser.GameObjects.Image`. The factory casts the result
 * to `Phaser.GameObjects.Image` internally (a valid upcast — `BareImage`
 * is a subset, and at runtime the object is a real `Phaser.GameObjects.Image`
 * in production or a stub in tests).
 *
 * Why `tweens.add`'s parameter is `Phaser.Types.Tweens.TweenBuilderConfig`:
 * Phaser's `TweenManager.add` is typed as
 * `(config: TweenBuilderConfig | TweenChainBuilderConfig | Tween | TweenChain) => Tween`.
 * For `Phaser.Scene.tweens.add` to be assignable to this permissive type,
 * the parameter here must be a SUBTYPE of Phaser's union (function
 * parameters are contravariant). `TweenBuilderConfig` is one member of
 * that union, so it qualifies — and `TweenBuilderConfig` itself is
 * `{[key: string]: any} & { tweens?: ... }`, which any plain config object
 * literal satisfies via its index signature.
 */

/**
 * Permissive subset of `Phaser.GameObjects.Image` that the wrapper actually
 * uses. Real Phaser images satisfy this shape; test stubs can satisfy it
 * with a minimal object.
 */
export type BareImage = {
  x: number;
  y: number;
  setScale: (sx: number, sy: number) => void;
  setVisible: (visible: boolean) => void;
  setAlpha: (alpha: number) => void;
  setPosition: (x: number, y: number) => void;
  destroy: () => void;
};

export type PowerUpSpriteScene = {
  add: {
    image: (x: number, y: number, key: string) => BareImage;
  };
  tweens: {
    add: (config: Phaser.Types.Tweens.TweenBuilderConfig) => unknown;
  };
};

export type PowerUpSprite = {
  /** The underlying Phaser image. Exposed for advanced callers (e.g. tweens). */
  readonly gameObject: Phaser.GameObjects.Image;
  /**
   * Switch the visual state.
   *
   * - "idle": no visual change (the default).
   * - "collected": sets alpha to 0 immediately. The caller is expected to
   *   destroy the sprite shortly after (e.g. after a tween completes, or
   *   immediately). The full scale-up + fade-out flash is a Phase 3C
   *   enhancement; for now we just hide the sprite.
   * - "despawning": no visual change by default. The blinking strobe is
   *   driven externally via {@link PowerUpSprite.setVisible} — the renderer
   *   toggles visibility each frame based on `shouldBlink`.
   */
  setState: (state: PowerUpSpriteState) => void;
  /** Get the current state. */
  getState: () => PowerUpSpriteState;
  /** Set visibility (used for blinking during the despawn warning window). */
  setVisible: (visible: boolean) => void;
  /**
   * Set the sprite's alpha (opacity). Delegates to the underlying
   * `gameObject.setAlpha`. Exposed so the PowerUpSystem's duck-typed
   * sprite API (which expects `setAlpha`) is satisfied by the wrapper.
   */
  setAlpha: (alpha: number) => void;
  /**
   * Current x position (delegates to `gameObject.x`). Readable AND
   * writable so callers can both query and update the position via the
   * property (matching `Phaser.GameObjects.Image`'s API surface).
   */
  x: number;
  /** Current y position (delegates to `gameObject.y`). */
  y: number;
  /** Get current position. */
  getPosition: () => { x: number; y: number };
  /** Update the position. */
  setPosition: (x: number, y: number) => void;
  /**
   * Play the spawn animation: scale the sprite up from 0 → 1 over
   * `durationMs` (default 200ms) with a `Back.out` ease for a satisfying
   * "pop in". The sprite's scale is set to 0 immediately, then the tween
   * animates it back to its natural scale (1, 1).
   *
   * Implemented via `scene.tweens.add({ targets: gameObject, scaleX: 1,
   * scaleY: 1, duration, ease: "Back.out" })`. In unit tests, stub
   * `scene.tweens.add` to record the call (or fire `onComplete` if present).
   */
  playSpawnAnimation: (durationMs?: number) => void;
  /**
   * Play the collected animation: scale the sprite up to 1.5× and fade its
   * alpha to 0 over `durationMs` (default 250ms), then invoke `onComplete`.
   * The caller should pass a callback that destroys the sprite + label and
   * clears any bookkeeping state — the destroy is deferred until the
   * animation finishes so the player sees the pickup flash before the
   * sprite vanishes.
   */
  playCollectedAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
  /**
   * Play the despawn animation: fade the sprite's alpha to 0 over
   * `durationMs` (default 300ms), then invoke `onComplete`. Used when the
   * power-up times out (after `POWERUP_TIMINGS.despawnAfterMs`) — the
   * sprite gracefully fades instead of popping out of existence.
   */
  playDespawnAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
  /** Destroy the sprite. */
  destroy: () => void;
};

/**
 * Static map from each {@link PowerUpEffect} to its sprite-manifest key.
 * The convention is `powerup-<effect>` — e.g. `powerup-speed`,
 * `powerup-mega-knockback`, `powerup-double-slap`. Both the manifest
 * (`spriteManifest.ts`) and the texture loader (`spriteLoader.ts`) use
 * the same keys, so a single lookup here is enough to wire an effect to
 * its PNG.
 */
export const POWERUP_SPRITE_KEYS: Record<PowerUpEffect, string> = {
  speed: "powerup-speed",
  knockback: "powerup-knockback",
  shield: "powerup-shield",
  "mega-knockback": "powerup-mega-knockback",
  freeze: "powerup-freeze",
  "double-slap": "powerup-double-slap",
};

/**
 * Create a power-up sprite for the given effect type. The sprite key is
 * looked up from {@link POWERUP_SPRITE_KEYS} (`powerup-<effect>`).
 *
 * The wrapper's initial state is "idle". Call `setState("collected")` to
 * trigger the pickup flash (alpha → 0), or `setState("despawning")` to
 * mark the sprite as entering its despawn window (the renderer should
 * then toggle visibility via `setVisible` based on `shouldBlink`).
 *
 * The `scene` parameter is typed as {@link PowerUpSpriteScene} (a
 * permissive shape with `add.image` and `tweens.add`) so both real
 * `Phaser.Scene` instances and test stubs can be passed without a cast.
 */
export function createPowerUpSprite(
  scene: PowerUpSpriteScene,
  effect: PowerUpEffect,
  x: number,
  y: number,
): PowerUpSprite {
  const key = POWERUP_SPRITE_KEYS[effect];
  const gameObject = scene.add.image(x, y, key) as Phaser.GameObjects.Image;
  let state: PowerUpSpriteState = "idle";

  return {
    gameObject,
    setState(next: PowerUpSpriteState) {
      state = next;
      if (next === "collected") {
        // Phase 2b: hide the sprite immediately. The caller destroys it
        // afterwards (PowerUpSystem.tryCollectPowerUp destroys the sprite
        // right after applying the effect). A full scale-up + fade-out
        // tween can be layered on top in Phase 3C without changing this
        // method's signature.
        gameObject.setAlpha(0);
      }
      // "idle" and "despawning" produce no visual change by default —
      // the blink strobe during despawn is driven externally via
      // setVisible, and "idle" is the initial state.
    },
    getState() {
      return state;
    },
    setVisible(visible: boolean) {
      gameObject.setVisible(visible);
    },
    setAlpha(alpha: number) {
      gameObject.setAlpha(alpha);
    },
    get x(): number {
      return gameObject.x;
    },
    set x(value: number) {
      gameObject.x = value;
    },
    get y(): number {
      return gameObject.y;
    },
    set y(value: number) {
      gameObject.y = value;
    },
    getPosition() {
      return { x: gameObject.x, y: gameObject.y };
    },
    setPosition(nextX: number, nextY: number) {
      gameObject.setPosition(nextX, nextY);
    },
    /**
     * Spawn animation: snap scale to 0 then tween back to (1, 1) with a
     * `Back.out` ease. The snap-then-grow pattern produces a clear "pop
     * in" without requiring the caller to manage timing — the Phaser tween
     * system handles the 200ms transition internally.
     */
    playSpawnAnimation(durationMs: number = 200): void {
      gameObject.setScale(0, 0);
      scene.tweens.add({
        targets: gameObject,
        scaleX: 1,
        scaleY: 1,
        duration: durationMs,
        ease: "Back.out",
      });
    },
    /**
     * Collected animation: tween scale to 1.5× while fading alpha to 0,
     * then fire `onComplete`. The caller is responsible for destroying the
     * sprite inside `onComplete` (so the player sees the full scale-up +
     * fade before the sprite is removed from the scene graph).
     */
    playCollectedAnimation(
      onComplete: () => void,
      durationMs: number = 250,
    ): void {
      scene.tweens.add({
        targets: gameObject,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: durationMs,
        onComplete,
      });
    },
    /**
     * Despawn animation: tween alpha to 0 over `durationMs`, then fire
     * `onComplete`. Used when the power-up times out — the sprite fades
     * gracefully instead of being yanked from the scene.
     */
    playDespawnAnimation(
      onComplete: () => void,
      durationMs: number = 300,
    ): void {
      scene.tweens.add({
        targets: gameObject,
        alpha: 0,
        duration: durationMs,
        onComplete,
      });
    },
    destroy() {
      gameObject.destroy();
    },
  };
}
