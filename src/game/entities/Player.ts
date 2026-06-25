import Phaser from "phaser";
import { expirePowerUpBoosts } from "../systems/PowerUpSystem";
import { getSpeedPenaltyMultiplier } from "../systems/AntiCampSystem";

export type ActorConfig = {
  color: number;
  knockbackSpeed: number;
  slapRange: number;
  size: number;
  speed: number;
};

/**
 * Pure helper that computes the per-axis max-velocity cap for an actor's
 * physics body. The cap must be high enough that:
 *   1. Normal movement (speed * speedMultiplier, where the Boost power-up
 *      pushes speedMultiplier up to 1.35x) is never clipped, AND
 *   2. Knockback velocity (knockbackSpeed * knockbackMultiplier, where the
 *      Heavy Hand power-up pushes knockbackMultiplier up to 1.25x) is never
 *      clipped either.
 *
 * `speed * 2` covers (1) with plenty of headroom; `knockbackSpeed * 1.5`
 * covers (2) for the worst-case Heavy Hand multiplier (1.25 * 1.2 = 1.5).
 * Picking the larger of the two guarantees neither value is clipped.
 */
export function computeMaxVelocity(config: ActorConfig): number {
  return Math.max(config.speed * 2, config.knockbackSpeed * 1.5);
}

export type ActorState = {
  body: Phaser.Physics.Arcade.Body;
  facing: Phaser.Math.Vector2;
  knockbackSpeed: number;
  knockbackMultiplier: number;
  /** Wall-clock timestamp (ms) until which the Heavy Hand knockback boost is active. 0 = no boost. */
  knockbackBoostUntil: number;
  knockbackUntil: number;
  lastAttackAt: number;
  /**
   * Wall-clock timestamp (ms) of the most recent slap ATTEMPT — stamped at
   * the top of `applySlap` before any cooldown / range / shield gates fire.
   * Unlike `lastAttackAt` (which only stamps on a successful hit), this fires
   * on EVERY attempt (cooldown miss, out-of-range, shield block, hit). Used
   * by `BotAI.computeRawBotDirection` to key the dodge trigger so the bot
   * can react to the player's swing windup instead of waiting for the
   * knockback to actually land (which only happens on a clean hit).
   */
  lastSlapAttemptAt: number;
  moveSpeed: number;
  size: number;
  slapRange: number;
  spawn: Phaser.Math.Vector2;
  /** Wall-clock timestamp (ms) until which the Boost speed multiplier is active. 0 = no boost. */
  speedBoostUntil: number;
  speedMultiplier: number;
  /** Number of slaps the shield will still block. 0 = no shield. */
  shieldHitsRemaining: number;
  /** Wall-clock timestamp (ms) until which the shield can still block slaps. */
  shieldUntil: number;
  /** Wall-clock timestamp (ms) until which the actor is frozen (cannot move). 0 = not frozen. */
  frozenUntil: number;
  /** Wall-clock timestamp (ms) until which the next slap hits twice. 0 = no double-slap ready. */
  doubleSlapUntil: number;
  /**
   * Wall-clock timestamp (ms) until which the actor is mid-dodge (i-frames
   * active). Set by `DodgeSystem.startDodge` to `now + DODGE_DURATION_MS`
   * (200ms). While `now < dodgeUntil`, `applySlap` short-circuits and the
   * BattleScene movement block bypasses the `isKnockedBack` gate.
   * 0 = not dodging.
   */
  dodgeUntil: number;
  /**
   * Wall-clock timestamp (ms) until which dodge is on cooldown. Set by
   * `DodgeSystem.startDodge` to `now + DODGE_COOLDOWN_MS` (1500ms).
   * `DodgeSystem.canDodge` returns false while `now < dodgeCooldownUntil`.
   * 0 = dodge available.
   */
  dodgeCooldownUntil: number;
  /**
   * Current combo count (0-5). Incremented by `applySlap` on a successful
   * slap; reset to 0 by `getComboMultiplier` when the combo times out
   * (>3000ms since the last successful slap) and reset to 0 on the defender
   * when they get hit. At 3 stacks `getComboMultiplier` returns 1.5x
   * knockback; at 5 stacks it returns 3.0x (mega-launch).
   */
  comboStacks: number;
  /**
   * Wall-clock timestamp (ms) of the last SUCCESSFUL slap by this actor.
   * Used by `getComboMultiplier` to time out the combo (resets comboStacks
   * to 0 when `now - lastSlapAt > 3000`). Distinct from `lastAttackAt`
   * (cooldown tracking) and `lastSlapAttemptAt` (windup signal for the
   * bot's dodge logic) — `lastSlapAt` is specifically the combo timer.
   */
  lastSlapAt: number;
  sprite: Phaser.GameObjects.Rectangle;
};

export type Player = ActorState & {
  kind: "player";
};

export function createActor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ActorConfig,
  colorOverride?: number,
): ActorState {
  const sprite = scene.add.rectangle(
    x,
    y,
    config.size,
    config.size,
    colorOverride ?? config.color,
  );
  scene.physics.add.existing(sprite);

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setCollideWorldBounds(false);
  body.setDamping(true);
  body.setDrag(0.05);
  body.setMaxVelocity(computeMaxVelocity(config), computeMaxVelocity(config));
  body.setBounce(0.3, 0.3);

  return {
    body,
    facing: new Phaser.Math.Vector2(1, 0),
    knockbackSpeed: config.knockbackSpeed,
    knockbackMultiplier: 1,
    knockbackBoostUntil: 0,
    knockbackUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    lastSlapAttemptAt: Number.NEGATIVE_INFINITY,
    moveSpeed: config.speed,
    size: config.size,
    slapRange: config.slapRange,
    spawn: new Phaser.Math.Vector2(x, y),
    speedBoostUntil: 0,
    speedMultiplier: 1,
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    frozenUntil: 0,
    doubleSlapUntil: 0,
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    comboStacks: 0,
    lastSlapAt: Number.NEGATIVE_INFINITY,
    sprite,
  };
}

export function createPlayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: ActorConfig,
  colorOverride?: number,
): Player {
  return {
    ...createActor(scene, x, y, config, colorOverride),
    kind: "player",
  };
}

export function isKnockedBack(actor: ActorState, now: number): boolean {
  return now < actor.knockbackUntil;
}

export function moveActor(
  actor: ActorState,
  direction: Phaser.Math.Vector2,
  now: number,
): void {
  // Expire any power-up boosts whose timer has elapsed. This ensures the
  // Boost speed multiplier reverts to 1 as soon as the 8s window ends —
  // even if the player keeps moving.
  expirePowerUpBoosts(actor, now);

  if (direction.lengthSq() === 0) {
    actor.body.setVelocity(0, 0);
    return;
  }

  // Anti-camp penalty: actors who haven't landed a slap in a while move
  // progressively slower (1.0 → 0.4 over a 5s grace + 4s ramp window).
  // Resets instantly on the next successful slap (applySlap stamps
  // lastSlapAt = now). Stacks multiplicatively on top of any active
  // Boost power-up — effective speed = moveSpeed × speedMultiplier × penalty.
  const penalty = getSpeedPenaltyMultiplier(actor, now);

  const normalized = direction.clone().normalize();
  actor.body.setVelocity(
    normalized.x * actor.moveSpeed * actor.speedMultiplier * penalty,
    normalized.y * actor.moveSpeed * actor.speedMultiplier * penalty,
  );
  actor.facing.copy(normalized);
}

export function resetActor(actor: ActorState): void {
  // Use the spawn point (set at creation time). The caller (BattleScene)
  // updates actor.spawn to a random position within their half of the
  // arena before calling resetActor, so each respawn is random.
  actor.sprite.setPosition(actor.spawn.x, actor.spawn.y);
  actor.body.setVelocity(0, 0);
  actor.facing.set(1, 0);
  actor.knockbackMultiplier = 1;
  actor.knockbackBoostUntil = 0;
  actor.knockbackUntil = 0;
  actor.lastSlapAttemptAt = Number.NEGATIVE_INFINITY;
  actor.speedBoostUntil = 0;
  actor.speedMultiplier = 1;
  actor.shieldHitsRemaining = 0;
  actor.shieldUntil = 0;
  actor.frozenUntil = 0;
  actor.doubleSlapUntil = 0;
  // Combat-mechanics (Task 2ac): reset dodge windows + combo state so a
  // fresh round starts with no carried-over i-frames, cooldowns, or combo.
  actor.dodgeUntil = 0;
  actor.dodgeCooldownUntil = 0;
  actor.comboStacks = 0;
  actor.lastSlapAt = Number.NEGATIVE_INFINITY;
}
