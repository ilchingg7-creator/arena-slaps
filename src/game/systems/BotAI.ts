import Phaser from "phaser";
import type { ActorState } from "../entities/Player";
import type { PowerUpState } from "./PowerUpSystem";
import type { BotDifficulty } from "../config/gameSettings";

export type BotAIState = {
  difficulty: BotDifficulty;
  lastDodgeAt: number;
  lastPlayerAttackSeenAt: number;
  lastSlapAttemptAt: number;
};

type Vec2 = { x: number; y: number };

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

/**
 * Decide where the bot should move this frame.
 *
 * Behavior priority:
 * 1. Dodge perpendicular when the player just attacked (and dodge cooldown ok).
 * 2. Move toward an active power-up if it's close and the bot can reach it first.
 * 3. Otherwise, move toward the player.
 *
 * The function is deterministic for a given Math.random sequence so it can be
 * tested by stubbing Math.random.
 */
export function computeBotDirection(
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
