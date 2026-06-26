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
  /** Update headwear + outline position + trail emission to track the actor. */
  update: (actorX: number, actorY: number, velocitySq: number, velocityX: number) => void;
  /** Play the slap FX burst at the given coordinates. */
  playSlapFx: (x: number, y: number) => void;
  /** Destroy all managed game objects. */
  destroy: () => void;
};

/**
 * Create the cosmetic visuals for an actor. Returns null when no visual
 * cosmetics are equipped (no headwear, no trail, no slapFx, no outline) —
 * the caller can skip the per-frame update() call in that case.
 */
export function createCosmeticVisuals(
  scene: Phaser.Scene,
  cosmetics: ResolvedCosmetics,
  actorSprite: Phaser.GameObjects.Rectangle,
  actorSize: number,
): CosmeticVisuals | null {
  const hasHeadwear = cosmetics.headwear !== null;
  const hasTrail = cosmetics.trail !== null;
  const hasSlapFx = cosmetics.slapFx !== null;
  const hasOutline = cosmetics.outline !== null;

  if (!hasHeadwear && !hasTrail && !hasSlapFx && !hasOutline) {
    return null;
  }

  // --- Outline (Bug 3 fix: now tracked in update()) ---
  // A duplicate stroke rectangle around the actor. Updated every frame
  // to track the actor's position so it doesn't get left behind when
  // the actor moves.
  //
  // Depth: 11 — ABOVE the actor sprite (depth 10) so the outline draws
  // ON TOP of the sprite, not behind it. Was depth -1 which painted
  // the outline behind the actor where it was barely visible against
  // the background. Headwear still renders above the outline at depth 15.
  let outlineRect: Phaser.GameObjects.Rectangle | null = null;
  if (hasOutline && cosmetics.outline !== null) {
    outlineRect = scene.add
      .rectangle(
        actorSprite.x,
        actorSprite.y,
        actorSize + 8,
        actorSize + 8,
        0x000000,
        0,
      )
      .setStrokeStyle(3, cosmetics.outline, 1)
      .setDepth(11);
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
  //
  // Rainbow trail: when the trail's textureKey is "trail-rainbow", we
  // replace the static tint with a Phaser color callback that cycles
  // through the spectrum over the particle's lifespan. Each particle
  // gets a different starting hue based on its emission time, so the
  // trail looks like a moving rainbow instead of a single color.
  let trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  if (hasTrail && cosmetics.trail) {
    const textureKey = cosmetics.trail.textureKey;
    if (scene.textures.exists(textureKey)) {
      const isRainbow = textureKey === "trail-rainbow";
      const baseConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
        // Manual emission via emitParticleAt in update(). frequency=-1
        // disables auto-emission so particles only spawn when we call
        // emitParticleAt.
        frequency: -1,
        lifespan: 600,
        scale: { start: 1.0, end: 0 },
        alpha: { start: 1.0, end: 0 },
        speed: { min: 0, max: 30 },
        gravityY: 0,
        quantity: 2,
      };
      if (isRainbow) {
        // Phaser 3.80 `color` accepts a number[] of evenly-spaced color
        // stops interpolated across the particle's lifespan. We pass 7
        // spectrum stops (red→orange→yellow→green→cyan→blue→magenta)
        // which combined with `colorEase: 'linear'` makes each particle
        // shift through the rainbow as it fades out. The emitter also
        // rotates the starting tint per emit via emitParticleAt, so
        // successive particles don't all start at red — the result is
        // a true moving rainbow.
        baseConfig.color = [
          0xff0000, // red
          0xff8000, // orange
          0xffff00, // yellow
          0x00ff00, // green
          0x00ffff, // cyan
          0x0000ff, // blue
          0xff00ff, // magenta
        ];
        baseConfig.colorEase = "linear";
        // Keep the texture's own color (white radial gradient) visible
        // — no tint override, the color array takes over.
      } else {
        // Non-rainbow trails use the static tint from the manifest.
        baseConfig.tint = cosmetics.trail.color;
      }
      trailEmitter = scene.add.particles(0, 0, textureKey, baseConfig);
    }
  }

  // --- Slap FX ---
  // No persistent object — playSlapFx creates a one-shot image + fade
  // tween on each call. The image auto-destroys when the tween completes.

  function update(actorX: number, actorY: number, velocitySq: number, velocityX: number): void {
    // Update outline position (Bug 3 fix — was previously static).
    if (outlineRect) {
      outlineRect.setPosition(actorX, actorY);
    }
    // Update headwear position.
    if (headwearImage) {
      headwearImage.setPosition(actorX, actorY + headwearOffsetY);
    }
    // Update trail — manually emit particles at the actor's feet.
    // Phaser 3.80's emitter.x/y + frequency approach is unreliable for
    // moving emitters. Instead we pause the auto-emitter and manually
    // emit a particle at the actor's position each frame while moving.
    if (trailEmitter) {
      const shouldEmit = velocitySq > 100;
      if (shouldEmit) {
        // Offset trail to the side opposite of movement direction:
        // moving right → trail on the left, moving left → trail on the right.
        // Vertical-only movement → trail centered.
        const sideOffset = velocityX > 30 ? -14 : velocityX < -30 ? 14 : 0;
        trailEmitter.emitParticleAt(actorX + sideOffset, actorY + 20);
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
    outlineRect?.destroy();
    outlineRect = null;
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
 * fallback, we draw a duplicate stroke rectangle ABOVE the sprite
 * instead. The stroke is set to the outline color; the rectangle is
 * slightly larger than the actor (size + 8) so the stroke is visible
 * around the edges. Depth 11 puts it above the actor sprite (depth 10)
 * and below headwear (depth 15).
 */
export function applyOutline(
  scene: Phaser.Scene,
  actorSprite: Phaser.GameObjects.Rectangle,
  outlineColor: number,
  size: number,
): Phaser.GameObjects.Rectangle | null {
  // Draw a slightly larger rectangle ON TOP of the actor with the
  // outline color as its stroke. Depth 11 = above actor (10), below
  // headwear (15).
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
    .setDepth(11); // above the actor
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
