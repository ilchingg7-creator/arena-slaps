import Phaser from "phaser";
import type { ActorState } from "../entities/Player";
import type { PowerUpState } from "./PowerUpSystem";
import type { BotDifficulty } from "../config/gameSettings";

type Vec2 = { x: number; y: number };

export type BotAIState = {
  difficulty: BotDifficulty;
  lastDodgeAt: number;
  lastPlayerAttackSeenAt: number;
  lastSlapAttemptAt: number;
  currentDir: Vec2;
};

type DifficultyParams = {
  dodgeChance: number;
  powerUpPriority: number;
  reactionMs: number;
  slapIntervalMs: number;
};

const DIFFICULTY_PARAMS: Record<BotDifficulty, DifficultyParams> = {
  easy: {
    dodgeChance: 0.4,
    powerUpPriority: 0.3,
    reactionMs: 350,
    slapIntervalMs: 800,
  },
  medium: {
    dodgeChance: 0.75,
    powerUpPriority: 0.6,
    reactionMs: 200,
    slapIntervalMs: 500,
  },
  hard: {
    dodgeChance: 0.95,
    powerUpPriority: 0.9,
    reactionMs: 100,
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

  if (player.lastAttackAt > ai.lastPlayerAttackSeenAt) {
    ai.lastPlayerAttackSeenAt = player.lastAttackAt;

    if (now - ai.lastDodgeAt > params.reactionMs) {
      const dist = distance(
        bot.sprite.x,
        bot.sprite.y,
        player.sprite.x,
        player.sprite.y,
      );

      if (dist < player.slapRange * 1.8 && random() < params.dodgeChance) {
        ai.lastDodgeAt = now;
        const dx = bot.sprite.x - player.sprite.x;
        const dy = bot.sprite.y - player.sprite.y;
        const perpX = -dy;
        const perpY = dx;
        const sign = random() < 0.5 ? 1 : -1;
        return normalize(perpX * sign, perpY * sign);
      }
    }
  }

  if (powerUp.active && random() < params.powerUpPriority) {
    const distToPowerUp = distance(
      bot.sprite.x,
      bot.sprite.y,
      powerUp.active.sprite.x,
      powerUp.active.sprite.y,
    );
    const distPlayerToPowerUp = distance(
      player.sprite.x,
      player.sprite.y,
      powerUp.active.sprite.x,
      powerUp.active.sprite.y,
    );

    if (
      distToPowerUp < 350 &&
      distToPowerUp < distPlayerToPowerUp + 80
    ) {
      const dx = powerUp.active.sprite.x - bot.sprite.x;
      const dy = powerUp.active.sprite.y - bot.sprite.y;
      return normalize(dx, dy);
    }
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

  const smoothing = 0.3;
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
