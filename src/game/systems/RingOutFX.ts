/**
 * Ring-out visual effects — camera shake, fall animation, flash burst.
 *
 * Called when an actor rings out (falls off the arena). Plays a visual
 * sequence before the caller resets the actor to spawn:
 *   1. Camera shake (200ms, low intensity)
 *   2. Actor's AnimatedSprite switches to "fall" state
 *   3. Actor tweens off-screen (scale down + fade + drift)
 *   4. White flash circle at the ring-out position (scale up + fade)
 *   5. onComplete callback fires after ~500ms
 */

import type Phaser from "phaser";
import type { AnimatedSprite } from "../sprites/AnimatedSprite";

export type RingOutFXConfig = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  animatedSprite: AnimatedSprite;
  onComplete: () => void;
};

const SHAKE_DURATION_MS = 200;
const SHAKE_INTENSITY = 0.005;
const TWEEN_DURATION_MS = 500;
const FLASH_DURATION_MS = 300;
const COMPLETE_DELAY_MS = 500;

export function playRingOutFX(config: RingOutFXConfig): void {
  const { scene, x, y, animatedSprite, onComplete } = config;

  // 1. Camera shake
  try {
    scene.cameras.main.shake(SHAKE_DURATION_MS, SHAKE_INTENSITY);
  } catch {
    // Best-effort — cameras may not be available in tests
  }

  // 2. Fall animation
  animatedSprite.setState("fall");

  // 3. Tween the sprite off-screen (scale down + fade + drift)
  const go = animatedSprite.gameObject as unknown as {
    x: number;
    y: number;
    alpha: number;
    scaleX: number;
    scaleY: number;
  };
  try {
    scene.tweens.add({
      targets: go,
      x: go.x,
      y: go.y + 100,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: TWEEN_DURATION_MS,
      ease: "Cubic.in",
    });
  } catch {
    // Best-effort — tweens may not be available in tests
  }

  // 4. Flash circle at the ring-out position
  try {
    const flash = scene.add.circle(x, y, 10, 0xffffff, 1);
    flash.setDepth(50);
    scene.tweens.add({
      targets: flash,
      radius: 60,
      alpha: 0,
      duration: FLASH_DURATION_MS,
      ease: "Cubic.out",
      onComplete: () => {
        flash.destroy();
      },
    });
  } catch {
    // Best-effort
  }

  // 5. Call onComplete after the tween finishes
  scene.time.delayedCall(COMPLETE_DELAY_MS, onComplete);
}
