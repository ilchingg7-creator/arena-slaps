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
  /** Get current position. */
  getPosition: () => { x: number; y: number };
  /** Update the position. */
  setPosition: (x: number, y: number) => void;
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
 */
export function createPowerUpSprite(
  scene: Phaser.Scene,
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
    getPosition() {
      return { x: gameObject.x, y: gameObject.y };
    },
    setPosition(nextX: number, nextY: number) {
      gameObject.setPosition(nextX, nextY);
    },
    destroy() {
      gameObject.destroy();
    },
  };
}
