/**
 * Tuning constants for the bot AI. Extracted from `BotAI.ts` so they live
 * alongside the rest of the gameplay tuning (`battleConfig.ts`) and can be
 * adjusted in one place.
 *
 * All values are intentionally `as const` so consumers get literal-type
 * inference and the object is deeply readonly at compile time.
 */
export const AI_CONFIG = {
  /**
   * How long (ms) the bot commits to a single perpendicular dodge before
   * smoothing is allowed to blend the direction back toward chase.
   */
  dodgeDurationMs: 200,
  /**
   * Smoothing factor (lerp `t`) applied between frames to the bot's current
   * direction. Lower values produce smoother (but slower) turns; higher
   * values produce snappier (but more jittery) movement.
   */
  smoothing: 0.3,
  /**
   * Multiplier on the player's `slapRange` that defines the dodge trigger
   * distance. If the bot is within `player.slapRange * dodgeRangeMultiplier`
   * when the player attacks, the bot may dodge perpendicular to the attack.
   */
  dodgeRangeMultiplier: 1.8,
  /**
   * Maximum distance (px) from the bot at which an active power-up is
   * considered worth chasing. Beyond this distance the bot ignores the
   * power-up and prioritises chasing / dodging the player.
   */
  powerUpChaseDistance: 350,
  /**
   * Margin (px) used when comparing the bot's distance to a power-up
   * against the player's distance. The bot only chases a power-up if it is
   * closer to the power-up than the player is, by at least this margin
   * (i.e. `distBotToPowerUp < distPlayerToPowerUp + powerUpAdvantageMargin`).
   */
  powerUpAdvantageMargin: 80,
} as const;
