import Phaser from "phaser";
import type { ActorState } from "../entities/Player";
import type { PowerUpState } from "./PowerUpSystem";
import { isShieldActive } from "./PowerUpSystem";
import type { BotDifficulty } from "../config/gameSettings";
import { AI_CONFIG } from "../config/aiConfig";

type Vec2 = { x: number; y: number };

export type BotAIState = {
  difficulty: BotDifficulty;
  lastDodgeAt: number;
  lastPlayerAttackSeenAt: number;
  lastSlapAttemptAt: number;
  currentDir: Vec2;
  dodgeUntil: number;
  /**
   * When the bot decides to chase a power-up, it commits to that decision
   * until the power-up is collected/despawns. This prevents per-frame RNG
   * dithering between "chase power-up" and "chase player" which caused
   * visible jitter in the bot's movement direction.
   * - `committedPowerUpSpawnedAt`: the spawnedAt timestamp of the power-up
   *   the bot is currently chasing, or null if not chasing.
   */
  committedPowerUpSpawnedAt: number | null;
};

type DifficultyParams = {
  dodgeChance: number;
  powerUpPriority: number;
  reactionMs: number;
  slapIntervalMs: number;
};

const DIFFICULTY_PARAMS: Record<BotDifficulty, DifficultyParams> = {
  easy: {
    dodgeChance: 0.25,
    powerUpPriority: 0.3,
    reactionMs: 400,
    slapIntervalMs: 800,
  },
  medium: {
    dodgeChance: 0.45,
    powerUpPriority: 0.6,
    reactionMs: 250,
    slapIntervalMs: 500,
  },
  hard: {
    dodgeChance: 0.55,
    powerUpPriority: 0.9,
    reactionMs: 200,
    slapIntervalMs: 450,
  },
};

export function getDifficultyParams(
  difficulty: BotDifficulty,
): DifficultyParams {
  return DIFFICULTY_PARAMS[difficulty];
}

export function createBotAI(difficulty: BotDifficulty): BotAIState {
  return {
    difficulty,
    lastDodgeAt: 0,
    lastPlayerAttackSeenAt: 0,
    lastSlapAttemptAt: 0,
    currentDir: { x: 0, y: 0 },
    committedPowerUpSpawnedAt: null,
    dodgeUntil: 0,
  };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);

  if (len === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / len, y: y / len };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the raw target direction for this frame, before smoothing.
 * Extracted so it can be tested independently of the smoothing layer.
 */
export function computeRawBotDirection(
  bot: ActorState,
  player: ActorState,
  powerUp: PowerUpState,
  ai: BotAIState,
  now: number,
  random: () => number = Math.random,
): Vec2 {
  const params = DIFFICULTY_PARAMS[ai.difficulty];

  if (player.lastSlapAttemptAt > ai.lastPlayerAttackSeenAt) {
    ai.lastPlayerAttackSeenAt = player.lastSlapAttemptAt;

    if (now - ai.lastDodgeAt > params.reactionMs) {
      const dist = distance(
        bot.sprite.x,
        bot.sprite.y,
        player.sprite.x,
        player.sprite.y,
      );

      if (dist < player.slapRange * AI_CONFIG.dodgeRangeMultiplier && random() < params.dodgeChance) {
        ai.lastDodgeAt = now;
        ai.dodgeUntil = now + AI_CONFIG.dodgeDurationMs;
        const dx = bot.sprite.x - player.sprite.x;
        const dy = bot.sprite.y - player.sprite.y;
        const perpX = -dy;
        const perpY = dx;
        const sign = random() < 0.5 ? 1 : -1;
        return normalize(perpX * sign, perpY * sign);
      }
    }
  }

  // --- Power-up chase decision (per-spawn, NOT per-frame) ---
  // Previously this was `if (powerUp.active && random() < powerUpPriority)`
  // checked every frame, causing the bot to dither between chasing the
  // power-up and chasing the player — visible as jittery movement.
  // Now: when a new power-up appears, the bot rolls ONCE whether to commit
  // to chasing it. The commitment persists until the power-up is gone.
  if (powerUp.active) {
    const powerUpSpawnedAt = (powerUp.active as { spawnedAt?: number }).spawnedAt ?? 0;

    // Check if this is a new power-up (different from what we committed to)
    if (powerUpSpawnedAt !== ai.committedPowerUpSpawnedAt) {
      // New power-up — decide whether to chase it
      ai.committedPowerUpSpawnedAt = null;
      const distToPowerUp = distance(
        bot.sprite.x, bot.sprite.y,
        powerUp.active.sprite.x, powerUp.active.sprite.y,
      );
      const distPlayerToPowerUp = distance(
        player.sprite.x, player.sprite.y,
        powerUp.active.sprite.x, powerUp.active.sprite.y,
      );
      if (
        distToPowerUp < AI_CONFIG.powerUpChaseDistance &&
        distToPowerUp < distPlayerToPowerUp + AI_CONFIG.powerUpAdvantageMargin &&
        random() < params.powerUpPriority
      ) {
        ai.committedPowerUpSpawnedAt = powerUpSpawnedAt;
      }
    }

    // If committed to this power-up, chase it
    if (ai.committedPowerUpSpawnedAt === powerUpSpawnedAt) {
      const dx = powerUp.active.sprite.x - bot.sprite.x;
      const dy = powerUp.active.sprite.y - bot.sprite.y;
      return normalize(dx, dy);
    }
  } else {
    // No active power-up — clear commitment
    ai.committedPowerUpSpawnedAt = null;
  }

  const dx = player.sprite.x - bot.sprite.x;
  const dy = player.sprite.y - bot.sprite.y;
  return normalize(dx, dy);
}

/**
 * Decide where the bot should move this frame, with smoothing applied.
 *
 * The raw target direction is computed by {@link computeRawBotDirection},
 * then the bot's current direction is lerped toward it by a smoothing
 * factor. This prevents the bot from jittering when the player moves by
 * a pixel or two between frames.
 *
 * On the very first call, `currentDir` is {0,0}, so the lerp produces a
 * vector in the same direction as the target — normalization then yields
 * the exact target direction. This means the first call returns the raw
 * direction (important for tests), and subsequent calls smooth transitions.
 *
 * Dodge maneuvers are exempt from smoothing: when `computeRawBotDirection`
 * decides to dodge it stamps `ai.dodgeUntil = now + DODGE_DURATION_MS`.
 * For the next 200 ms we keep returning the cached perpendicular dodge
 * direction directly, so the evasive move is not blended back toward the
 * chase direction by the 0.3 lerp factor (which would produce a weak
 * diagonal instead of a sharp dodge).
 */
export function computeBotDirection(
  bot: ActorState,
  player: ActorState,
  powerUp: PowerUpState,
  ai: BotAIState,
  now: number,
  random: () => number = Math.random,
): Vec2 {
  const target = computeRawBotDirection(
    bot,
    player,
    powerUp,
    ai,
    now,
    random,
  );

  // If a dodge was triggered on this frame, cache its perpendicular
  // direction into currentDir so we can keep returning it for the rest
  // of the dodge window. (`computeRawBotDirection` sets `ai.lastDodgeAt`
  // to `now` exactly when a dodge is triggered, so this is a reliable
  // one-frame signal.)
  if (ai.lastDodgeAt === now) {
    ai.currentDir.x = target.x;
    ai.currentDir.y = target.y;
  }

  // During the dodge window, bypass the smoothing lerp and return the
  // (cached) perpendicular dodge direction directly.
  if (now < ai.dodgeUntil) {
    return { x: ai.currentDir.x, y: ai.currentDir.y };
  }

  const smoothing = AI_CONFIG.smoothing;
  ai.currentDir.x = lerp(ai.currentDir.x, target.x, smoothing);
  ai.currentDir.y = lerp(ai.currentDir.y, target.y, smoothing);

  const len = Math.hypot(ai.currentDir.x, ai.currentDir.y);
  if (len > 0) {
    ai.currentDir.x /= len;
    ai.currentDir.y /= len;
  }

  return { x: ai.currentDir.x, y: ai.currentDir.y };
}

/**
 * Decide whether the bot should attempt a slap this frame.
 * Respects a per-difficulty slap interval (independent of the combat cooldown
 * inside applySlap) so easy bots slap less frequently than hard bots.
 */
export function shouldBotSlap(
  bot: ActorState,
  player: ActorState,
  ai: BotAIState,
  now: number,
): boolean {
  const params = DIFFICULTY_PARAMS[ai.difficulty];

  if (now - ai.lastSlapAttemptAt < params.slapIntervalMs) {
    return false;
  }

  // Fix E: don't waste a slap attempt on a shielded player. Without this
  // gate the bot swings into the shield, gets blocked (no cooldown consumed
  // for the attacker), but STILL pays the bot-side `slapIntervalMs` (800ms
  // on easy = a long self-stun). Holding the slap until the shield drops
  // lets the bot keep its swing cadence.
  if (isShieldActive(player, now)) {
    return false;
  }

  const dist = distance(
    bot.sprite.x,
    bot.sprite.y,
    player.sprite.x,
    player.sprite.y,
  );

  if (dist > bot.slapRange) {
    return false;
  }

  ai.lastSlapAttemptAt = now;
  return true;
}
