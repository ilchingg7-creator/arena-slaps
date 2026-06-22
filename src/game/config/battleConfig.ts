/**
 * Per-difficulty bot tuning (Fix B). The single `bot` block used to be
 * shared across ALL difficulties, which left even the Hard bot strictly
 * weaker than the player on every axis (slower, shorter range, weaker
 * knockback). Each difficulty now has its own block:
 *   - easy:   slower / shorter range / weaker knockback (180 / 64 / 450)
 *   - medium: the legacy baseline                       (210 / 74 / 500)
 *   - hard:   EXACT parity with the player              (260 / 84 / 560)
 *
 * Declared as a standalone const so `battleConfig.bot` can alias
 * `botByDifficulty.medium` for backward compatibility (some existing code
 * references `battleConfig.bot.color` / `battleConfig.bot` directly).
 */
export const botByDifficulty = {
  easy: {
    color: 0xe07a5f,
    knockbackSpeed: 450,
    speed: 180,
    slapRange: 64,
    size: 36,
  },
  medium: {
    color: 0xe07a5f,
    knockbackSpeed: 500,
    speed: 210,
    slapRange: 74,
    size: 36,
  },
  hard: {
    color: 0xe07a5f,
    knockbackSpeed: 560,
    speed: 260,
    slapRange: 84,
    size: 36,
  },
} as const;

export const battleConfig = {
  arena: {
    height: 520,
    ringOutMargin: 56,
    width: 920,
  },
  botByDifficulty,
  /**
   * Backward-compat alias for `botByDifficulty.medium` — the legacy default
   * bot config. New code should look up `battleConfig.botByDifficulty[botDifficulty]`
   * via the settings; this alias only exists so existing references like
   * `battleConfig.bot.color` keep working without churn.
   */
  bot: botByDifficulty.medium,
  /**
   * Combat tuning constants shared across the slap / knockback pipeline.
   * Extracted from CombatSystem.ts so they live alongside the rest of the
   * battle tuning and can be tweaked in one place.
   */
  combat: {
    /** Minimum gap between two successful slaps by the same attacker (ms). */
    slapCooldownMs: 450,
    /** How long the defender is locked into knockback velocity (ms). */
    knockbackDurationMs: 280,
  },
  player: {
    color: 0x3d405b,
    knockbackSpeed: 560,
    speed: 260,
    slapRange: 84,
    size: 36,
  },
  powerUp: {
    size: 16,
  },
  round: {
    lengthSeconds: 60,
    winningScore: 5,
  },
} as const;
