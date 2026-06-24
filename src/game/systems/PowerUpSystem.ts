import type { ActorState } from "../entities/Player";
import {
  POWERUP_DEFINITIONS,
  getPowerUpDefinitionByIndex,
  type PowerUpDefinition,
  type PowerUpEffect,
} from "../config/powerUpConfig";
import { POWERUP_TIMINGS } from "../config/powerUpTimings";
import {
  createPowerUpSprite,
  type PowerUpSpriteScene,
} from "../sprites/PowerUpSprite";

// Re-export the types so existing callers (BotAI, CombatSystem, tests) can
// still import them from "./PowerUpSystem" without churning the import graph.
export type { PowerUpEffect, PowerUpDefinition };

/**
 * Duck-typed view of the power-up sprite. The {@link createPowerUpSprite}
 * wrapper satisfies this shape — it exposes `destroy` / `setVisible` /
 * `setAlpha` / `x` / `y` (delegating to the underlying
 * `Phaser.GameObjects.Image`) plus the 3 animation methods
 * (`playSpawnAnimation` / `playCollectedAnimation` / `playDespawnAnimation`)
 * introduced in Phase 3C.
 *
 * The animation methods drive the visual transitions:
 *   - spawn: scale 0 → 1 over 200ms (Back.out ease) — the "pop in".
 *   - collected: scale → 1.5× + alpha → 0 over 250ms, then onComplete.
 *   - despawn: alpha → 0 over 300ms, then onComplete.
 *
 * The collected / despawn animations defer the sprite's `destroy()` to
 * their `onComplete` callback so the player sees the full transition
 * before the sprite is removed from the scene graph. Callers must null
 * out `state.active` *before* starting the animation so subsequent
 * `tryCollectPowerUp` calls during the 250ms window return false (no
 * double-collect).
 */
type PowerUpSprite = {
  destroy: () => void;
  setVisible: (visible: boolean) => void;
  setAlpha: (alpha: number) => void;
  x: number;
  y: number;
  /** Play the spawn animation: scale 0 → 1 over durationMs. */
  playSpawnAnimation: (durationMs?: number) => void;
  /** Play the collected animation: scale up + fade out, then call onComplete. */
  playCollectedAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
  /** Play the despawn animation: fade out, then call onComplete. */
  playDespawnAnimation: (
    onComplete: () => void,
    durationMs?: number,
  ) => void;
};

type PowerUpLabel = {
  /**
   * Sets the render depth so the label draws above the power-up sprite
   * (which defaults to depth 0). Optional so unit-test stubs without it
   * remain structurally compatible; the real Phaser.Text always has it.
   */
  setDepth?: (depth: number) => PowerUpLabel;
  destroy: () => void;
};

/**
 * Duck-typed scene the PowerUpSystem needs. Extends {@link PowerUpSpriteScene}
 * (which provides `add.image` for `createPowerUpSprite` and `tweens.add` for
 * the animation methods) with `add.text` for the power-up label.
 *
 * Real `Phaser.Scene` instances satisfy this shape — `Phaser.Scene.add.image`
 * returns `Phaser.GameObjects.Image` (which `PowerUpSpriteScene.add.image`
 * accepts), `Phaser.Scene.tweens.add` accepts `TweenBuilderConfig | object`
 * (which `PowerUpSpriteScene.tweens.add` accepts via parameter
 * contravariance), and `Phaser.Scene.add.text` returns the label type.
 */
type SceneLike = PowerUpSpriteScene & {
  add: {
    text: (
      x: number,
      y: number,
      value: string,
      style?: { color?: string; fontFamily?: string; fontSize?: string },
    ) => {
      setOrigin: (x?: number, y?: number) => PowerUpLabel;
      destroy: () => void;
    };
  };
};

type ArenaLike = {
  bottom: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
};

type ActivePowerUp = {
  definition: PowerUpDefinition;
  sprite: PowerUpSprite;
  label: PowerUpLabel;
  /** Wall-clock timestamp (ms) when this power-up was spawned. Used by the despawn timer. */
  spawnedAt: number;
};

export type PowerUpState = {
  active: ActivePowerUp | null;
  spawnIndex: number;
};

export function createPowerUpState(): PowerUpState {
  return {
    active: null,
    spawnIndex: 0,
  };
}

/**
 * Return the next power-up definition for the rotation. Cycles through all
 * 6 definitions in {@link POWERUP_DEFINITIONS} forever via modulo wrap.
 */
export function getNextPowerUpDefinition(index: number): PowerUpDefinition {
  return getPowerUpDefinitionByIndex(index);
}

/**
 * Spawn the next power-up in the rotation. Picks a position from
 * {@link POWERUP_TIMINGS.spawnSlots} (rotating through all 5 slots),
 * derives its absolute pixel position from the arena rectangle, and
 * records `spawnedAt = Date.now()` so the despawn timer can run. After
 * constructing the sprite, kicks off the spawn animation (scale 0 → 1
 * over 200ms with a `Back.out` ease) for a satisfying "pop in".
 *
 * Early-returns if a power-up is already active (the caller is expected
 * to despawn or collect the previous one first).
 */
export function spawnPowerUp(
  scene: SceneLike,
  state: PowerUpState,
  arena: ArenaLike,
  size: number,
  translator?: (key: string) => string,
): void {
  if (state.active) {
    return;
  }

  // Random position within the arena (avoiding edges by 15% margin).
  const arenaWidth = arena.right - arena.left;
  const arenaHeight = arena.bottom - arena.top;
  const marginX = arenaWidth * 0.15;
  const marginY = arenaHeight * 0.15;
  const x = arena.left + marginX + Math.random() * (arenaWidth - marginX * 2);
  const y = arena.top + marginY + Math.random() * (arenaHeight - marginY * 2);

  // Random power-up type (not sequential).
  const defIndex = Math.floor(Math.random() * POWERUP_DEFINITIONS.length);
  const definition = POWERUP_DEFINITIONS[defIndex];
  const labelText = translator ? translator(definition.labelKey) : definition.label;

  const label = scene.add
    .text(x, y + POWERUP_TIMINGS.labelOffsetY, labelText, {
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "14px",
    })
    .setOrigin(0.5, 0.5);
  // Render the label above the power-up sprite (MINOR-11). Both the label
  // and the sprite default to depth 0; without an explicit depth the
  // label could flicker behind the sprite depending on creation order.
  // The real Phaser.Text exposes `setDepth`; the optional-chained call
  // keeps unit-test stubs (which don't implement setDepth) compatible.
  label.setDepth?.(1);

  state.spawnIndex += 1;
  // Create the power-up sprite via the PowerUpSprite wrapper (Task 3C). The
  // wrapper:
  //   - calls `scene.add.image(x, y, "powerup-<effect>")` internally to
  //     instantiate the bare Phaser.GameObjects.Image,
  //   - captures `scene` in its closure so the animation methods can call
  //     `scene.tweens.add(...)` later,
  //   - exposes the duck-typed PowerUpSprite API (destroy / setVisible /
  //     setAlpha / x / y) plus the 3 animation methods.
  // The `size` arg is intentionally not applied to the image — PNGs render
  // at their natural size; the previous circle primitive used `size` as its
  // radius, but the new sprite art is authored at the correct pixel size.
  const sprite = createPowerUpSprite(scene, definition.key, x, y);
  state.active = {
    definition,
    sprite,
    label,
    spawnedAt: Date.now(),
  };
  // Kick off the spawn animation (scale 0 → 1, Back.out ease, 200ms) so the
  // power-up "pops in" instead of appearing at full size. The animation is
  // fire-and-forget — Phaser's tween system owns the timeline.
  sprite.playSpawnAnimation();
}

/**
 * Try to collect the active power-up for `actor`. Collection succeeds iff
 * the actor is within {@link POWERUP_TIMINGS.collectDistance} pixels of
 * the power-up sprite. On success: applies the power-up effect, kicks off
 * the collected animation (scale → 1.5× + alpha → 0 over 250ms), nulls
 * `state.active` immediately, and returns true. The sprite + label are
 * destroyed inside the animation's `onComplete` callback (i.e. ~250ms
 * later, after the player sees the pickup flash).
 *
 * Effect application dispatches on `definition.key`:
 *   - speed          → speedMultiplier + speedBoostUntil (on collector)
 *   - knockback      → knockbackMultiplier + knockbackBoostUntil (on collector)
 *   - shield         → shieldHitsRemaining = 1, shieldUntil (on collector)
 *   - mega-knockback → knockbackMultiplier + knockbackBoostUntil (on collector)
 *   - freeze         → frozenUntil (on OPPONENT, not collector)
 *   - double-slap    → doubleSlapUntil (on collector)
 *
 * The `opponent` parameter is required for the freeze effect (which freezes
 * the opponent, not the collector). For all other effects, opponent is
 * unused.
 *
 * Each effect duration is looked up from {@link POWERUP_TIMINGS} via the
 * definition's `durationKey`.
 */
export function tryCollectPowerUp(
  actor: ActorState,
  state: PowerUpState,
  now: number,
  opponent?: ActorState,
): boolean {
  if (!state.active) {
    return false;
  }

  const dx = actor.sprite.x - state.active.sprite.x;
  const dy = actor.sprite.y - state.active.sprite.y;
  const distance = Math.hypot(dx, dy);

  if (distance > POWERUP_TIMINGS.collectDistance) {
    return false;
  }

  const definition = state.active.definition;
  // `durationKey` is typed as `keyof typeof POWERUP_TIMINGS` (the full union)
  // so we narrow to a number at runtime. Every definition points at a
  // numeric duration key — verified by `powerUpConfig.test.ts`.
  const durationMs = POWERUP_TIMINGS[definition.durationKey] as number;

  if (definition.key === "speed") {
    actor.speedMultiplier = definition.speedMultiplier ?? actor.speedMultiplier;
    actor.speedBoostUntil = now + durationMs;
  } else if (definition.key === "knockback") {
    actor.knockbackMultiplier =
      definition.knockbackMultiplier ?? actor.knockbackMultiplier;
    actor.knockbackBoostUntil = now + durationMs;
  } else if (definition.key === "shield") {
    actor.shieldHitsRemaining = 1;
    actor.shieldUntil = now + durationMs;
  } else if (definition.key === "mega-knockback") {
    actor.knockbackMultiplier =
      definition.knockbackMultiplier ?? actor.knockbackMultiplier;
    actor.knockbackBoostUntil = now + durationMs;
  } else if (definition.key === "freeze") {
    // Freeze the OPPONENT, not the collector. If no opponent is provided
    // (e.g. in a unit test), the effect is a no-op.
    if (opponent) {
      opponent.frozenUntil = now + durationMs;
    }
  } else if (definition.key === "double-slap") {
    actor.doubleSlapUntil = now + durationMs;
  }

  // Play the collected animation (scale → 1.5× + alpha → 0 over 250ms) and
  // defer the sprite + label destruction to the animation's onComplete
  // callback. `state.active` is nulled IMMEDIATELY so subsequent
  // `tryCollectPowerUp` calls during the 250ms animation window return
  // false — no double-collect (the actor can't pick up the same power-up
  // twice while the pickup flash is still playing).
  const sprite = state.active.sprite;
  const label = state.active.label;
  state.active = null;
  sprite.playCollectedAnimation(() => {
    sprite.destroy();
    label.destroy();
  });
  return true;
}

/**
 * Whether the active power-up should despawn now. Returns true iff there
 * is an active power-up AND its age (`now - spawnedAt`) has reached
 * {@link POWERUP_TIMINGS.despawnAfterMs}.
 */
export function shouldDespawnPowerUp(
  state: PowerUpState,
  now: number,
): boolean {
  if (!state.active) {
    return false;
  }
  return now - state.active.spawnedAt >= POWERUP_TIMINGS.despawnAfterMs;
}

/**
 * Whether the active power-up is in its warning window — the last
 * {@link POWERUP_TIMINGS.despawnWarningMs} milliseconds before despawn.
 * The renderer uses this to drive the blink animation.
 *
 * Concretely: `age >= (despawnAfterMs - despawnWarningMs)` AND
 * `age < despawnAfterMs`. For the default config (8s / 2s warning) the
 * warning window is `[6s, 8s)`.
 */
export function isInDespawnWarning(
  state: PowerUpState,
  now: number,
): boolean {
  if (!state.active) {
    return false;
  }
  const age = now - state.active.spawnedAt;
  const warningStart =
    POWERUP_TIMINGS.despawnAfterMs - POWERUP_TIMINGS.despawnWarningMs;
  return age >= warningStart && age < POWERUP_TIMINGS.despawnAfterMs;
}

/**
 * Whether the power-up sprite should be visible *during the blink strobe*.
 *
 * Returns true iff the power-up is in its despawn warning window AND the
 * current blink cycle (based on `blinkIntervalMs`) is on a "visible" beat
 * (even cycles are visible, odd cycles are hidden).
 *
 * Outside the warning window this returns false — the renderer should
 * keep the sprite visible via `!isInDespawnWarning(state, now)` and only
 * consult `shouldBlink` to drive the strobe during the warning window.
 * The combined visibility expression is:
 *
 *   `sprite.visible = !isInDespawnWarning(state, now) || shouldBlink(state, now)`
 */
export function shouldBlink(state: PowerUpState, now: number): boolean {
  if (!state.active) {
    return false;
  }
  if (!isInDespawnWarning(state, now)) {
    // Outside the warning window: not blinking — caller should keep the
    // sprite visible via the negated `isInDespawnWarning` check.
    return false;
  }
  const cycle = Math.floor(
    (now - state.active.spawnedAt) / POWERUP_TIMINGS.blinkIntervalMs,
  );
  // Visible on even cycles, hidden on odd cycles — produces a strobe.
  return cycle % 2 === 0;
}

/**
 * Despawn the active power-up: play the despawn animation (alpha → 0 over
 * 300ms) and defer the sprite + label destruction to the animation's
 * `onComplete` callback. `state.active` is nulled immediately so the
 * BattleScene's `if (!runtime.powerUp.active) spawnPowerUp(...)` branch
 * can spawn the next power-up on the same frame (without waiting for the
 * 300ms fade to finish). No-op if no power-up is currently active.
 *
 * This is the cleanup counterpart to {@link spawnPowerUp}. The scene's
 * update loop should call {@link shouldDespawnPowerUp} each frame and,
 * when it returns true, call this function to release the sprite.
 */
export function despawnPowerUp(state: PowerUpState): void {
  if (!state.active) {
    return;
  }
  const sprite = state.active.sprite;
  const label = state.active.label;
  state.active = null;
  sprite.playDespawnAnimation(() => {
    sprite.destroy();
    label.destroy();
  });
}

/**
 * Whether the shield power-up is currently active. The shield is active iff
 * there is at least one hit remaining AND the shield's wall-clock expiry has
 * not yet passed.
 */
export function isShieldActive(actor: ActorState, now: number): boolean {
  return actor.shieldHitsRemaining > 0 && now < actor.shieldUntil;
}

/**
 * Consume one shield hit. Called by `applySlap` after a successful block.
 * Decrements `shieldHitsRemaining` (clamped at zero) so a 1-hit shield is
 * consumed after blocking a single slap.
 */
export function consumeShieldHit(actor: ActorState): void {
  if (actor.shieldHitsRemaining > 0) {
    actor.shieldHitsRemaining -= 1;
  }
}

/**
 * Reset any expired power-up boosts on the actor. Called every frame from
 * `moveActor` (and from `applySlap` for the attacker) so that an expired
 * Boost / Heavy Hand / Mega Hand reverts the actor's multiplier to its
 * baseline of 1 as soon as the duration elapses.
 *
 * We do NOT touch the shield here — shield expiry is handled by
 * `isShieldActive`, which already checks the wall-clock expiry. Likewise
 * the freeze and double-slap effects are timed via their own `frozenUntil`
 * / `doubleSlapUntil` fields and are not "boosts" that need reverting.
 */
export function expirePowerUpBoosts(actor: ActorState, now: number): void {
  if (actor.speedBoostUntil > 0 && now > actor.speedBoostUntil) {
    actor.speedMultiplier = 1;
    actor.speedBoostUntil = 0;
  }
  if (actor.knockbackBoostUntil > 0 && now > actor.knockbackBoostUntil) {
    actor.knockbackMultiplier = 1;
    actor.knockbackBoostUntil = 0;
  }
}

/**
 * Whether the actor is currently frozen (cannot move / slap). Set by the
 * `freeze` power-up effect for the opponent.
 */
export function isFrozen(actor: ActorState, now: number): boolean {
  return actor.frozenUntil > 0 && now < actor.frozenUntil;
}

/**
 * Whether the actor's next slap should hit twice. Set by the `double-slap`
 * power-up effect. The CombatSystem should consult this before applying
 * a slap and, if true, apply the slap twice and clear the field.
 */
export function isDoubleSlapReady(actor: ActorState, now: number): boolean {
  return actor.doubleSlapUntil > 0 && now < actor.doubleSlapUntil;
}
