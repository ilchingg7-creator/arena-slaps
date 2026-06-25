/**
 * CosmeticVisuals — manages the visual game objects for a single actor's
 * equipped cosmetics (headwear overlay, trail particle emitter, slap FX
 * burst). Created in BattleScene.create() after the actor's sprite is
 * built, updated every frame to track the actor's position, and
 * destroyed on scene shutdown.
 *
 * The outline cosmetic is applied directly to the actor's sprite via
 * Phaser's post-pipeline (or a duplicate stroke sprite) — see
 * applyOutline(). It's NOT managed here because it's a one-time setup
 * call rather than a per-frame tracked object.
 *
 * The title cosmetic is rendered in the HUD (BattleScene's playerNameLabel)
 * — see applyTitleToLabel(). Also not a per-frame tracked object.
 */

import type Phaser from "phaser";
import type { ResolvedCosmetics } from "../cosmetics/resolveCosmetics";

export type CosmeticVisuals = {
  /** Update headwear position + trail emission to track the actor. */
  update: (actorX: number, actorY: number, velocitySq: number) => void;
  /** Play the slap FX burst at the given coordinates. */
  playSlapFx: (x: number, y: number) => void;
  /** Destroy all managed game objects. */
  destroy: () => void;
};

/**
 * Create the cosmetic visuals for an actor. Returns null when no visual
 * cosmetics are equipped (no headwear, no trail, no slapFx) — the caller
 * can skip the per-frame update() call in that case.
 */
export function createCosmeticVisuals(
  scene: Phaser.Scene,
  cosmetics: ResolvedCosmetics,
): CosmeticVisuals | null {
  const hasHeadwear = cosmetics.headwear !== null;
  const hasTrail = cosmetics.trail !== null;
  const hasSlapFx = cosmetics.slapFx !== null;

  if (!hasHeadwear && !hasTrail && !hasSlapFx) {
    return null;
  }

  // --- Headwear overlay ---
  // A Phaser.Image positioned above the actor, updated every frame to
  // track the actor's position. We use depth 15 so it draws above the
  // animated sprite (depth 10) but below the HUD (depth 20+).
  let headwearImage: Phaser.GameObjects.Image | null = null;
  if (hasHeadwear && cosmetics.headwear) {
    const spriteKey = cosmetics.headwear.spriteKey;
    if (scene.textures.exists(spriteKey)) {
      headwearImage = scene.add.image(0, 0, spriteKey).setDepth(15);
    }
  }
  const headwearOffsetY = cosmetics.headwear?.offsetY ?? -28;

  // --- Trail particle emitter ---
  // A Phaser particle emitter that emits particles at the actor's
  // position while the actor is moving. We use a low frequency (every
  // ~50ms) and short particle lifespan (~400ms) so the trail is visible
  // but doesn't clutter the screen.
  let trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  if (hasTrail && cosmetics.trail) {
    const textureKey = cosmetics.trail.textureKey;
    if (scene.textures.exists(textureKey)) {
      trailEmitter = scene.add.particles(0, 0, textureKey, {
        // Emit at the actor's position (updated in update()).
        x: 0,
        y: 0,
        // Emit one particle every 50ms while moving.
        frequency: 50,
        // Particles live for 400ms then fade.
        lifespan: 400,
        // Small scale + alpha for a subtle trail.
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.7, end: 0 },
        // Tint with the trail's color.
        tint: cosmetics.trail.color,
        // Slight random offset so particles don't all stack on one
        // point. Phaser 3.80 uses `speed` (no spread field) — a small
        // radial speed gives the same scatter effect.
        speed: { min: 0, max: 20 },
        // Don't emit by gravity (top-down game).
        gravityY: 0,
      });
      trailEmitter.stop(); // start paused; update() will pulse on movement
    }
  }

  // --- Slap FX ---
  // No persistent object — playSlapFx creates a one-shot image + fade
  // tween on each call. The image auto-destroys when the tween completes.

  function update(actorX: number, actorY: number, velocitySq: number): void {
    // Update headwear position.
    if (headwearImage) {
      headwearImage.setPosition(actorX, actorY + headwearOffsetY);
    }
    // Update trail emitter position + emit while moving.
    if (trailEmitter) {
      trailEmitter.setPosition(actorX, actorY);
      // Emit only when the actor is actually moving (velocity > threshold).
      // 100 (px/s)^2 = ~10 px/s in any direction — well below intentional
      // movement but above float jitter.
      if (velocitySq > 100) {
        if (!trailEmitter.emitting) {
          trailEmitter.start();
        }
      } else {
        if (trailEmitter.emitting) {
          trailEmitter.stop();
        }
      }
    }
  }

  function playSlapFx(x: number, y: number): void {
    if (!hasSlapFx || !cosmetics.slapFx) return;
    const textureKey = cosmetics.slapFx;
    if (!scene.textures.exists(textureKey)) return;

    // One-shot image at the slap location, with a quick scale-up +
    // fade-out tween. Auto-destroys when the tween completes.
    const fx = scene.add.image(x, y, textureKey).setDepth(20).setAlpha(1).setScale(0.5);
    scene.tweens.add({
      targets: fx,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: "Cubic.out",
      onComplete: () => fx.destroy(),
    });
  }

  function destroy(): void {
    headwearImage?.destroy();
    headwearImage = null;
    trailEmitter?.destroy();
    trailEmitter = null;
  }

  return { update, playSlapFx, destroy };
}

/**
 * Apply the outline cosmetic to an actor's sprite. Call once during
 * BattleScene.create() — the outline stays applied for the actor's
 * lifetime. No-op when no outline cosmetic is equipped.
 *
 * Implementation: Phaser 3.80's Outline pipeline (`setPostPipeline`)
 * requires the WebGL renderer. To stay compatible with the Canvas
 * fallback, we draw a duplicate stroke rectangle behind the sprite
 * instead. The stroke is set to the outline color; the rectangle is
 * slightly larger than the actor (size + 4) so the stroke is visible
 * around the edges.
 */
export function applyOutline(
  scene: Phaser.Scene,
  actorSprite: Phaser.GameObjects.Rectangle,
  outlineColor: number,
  size: number,
): Phaser.GameObjects.Rectangle | null {
  // Draw a slightly larger rectangle behind the actor with the outline
  // color as its stroke. This is a simple, renderer-agnostic way to
  // achieve an outline without post-pipeline complexity.
  const outline = scene.add
    .rectangle(
      actorSprite.x,
      actorSprite.y,
      size + 8,
      size + 8,
      0x000000,
      0,
    )
    .setStrokeStyle(3, outlineColor, 1)
    .setDepth(-1); // behind the actor
  return outline;
}

/**
 * Build the HUD label text for an actor, combining nickname + title.
 * Returns just the nickname when no title cosmetic is equipped.
 */
export function applyTitleToLabel(
  nickname: string,
  title: string | null,
  titleTranslator: (titleKey: string) => string,
): string {
  if (!title) return nickname;
  const titleText = titleTranslator(title);
  if (!titleText) return nickname;
  return `${nickname}\n${titleText}`;
}
