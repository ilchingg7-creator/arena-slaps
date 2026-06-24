/**
 * Per-difficulty bot tuning. Hard bot is strong but NOT at full player
 * parity — the bot's AI is simpler than a human (no real strategy, just
 * chase + slap), so giving it equal stats would make it frustrating.
 *
 *   - easy:   much slower / short range / weak knockback (160 / 60 / 400)
 *   - medium: moderate speed / decent range (200 / 70 / 470)
 *   - hard:   fast / good range / strong knockback (240 / 80 / 530)
 *
 * Player stats for reference: speed=260, slapRange=84, knockback=560.
 * Hard bot is ~92% of player speed, ~95% range, ~95% knockback —
 * competitive but beatable with good play.
 */
export const botByDifficulty = {
  easy: {
    color: 0xe07a5f,
    knockbackSpeed: 400,
    speed: 160,
    slapRange: 44,
    size: 36,
  },
  medium: {
    color: 0xe07a5f,
    knockbackSpeed: 470,
    speed: 200,
    slapRange: 54,
    size: 36,
  },
  hard: {
    color: 0xe07a5f,
    knockbackSpeed: 530,
    speed: 240,
    slapRange: 64,
    size: 36,
  },
} as const;

export const battleConfig = {
  arena: {
    height: 520,
    // The platform PNG has ~24px of transparent padding inside the
    // 920x520 canvas. The visible platform edge is ~24px inside the
    // arena rectangle. With halfSize=18 (actor is 36px), the actor's
    // edge needs to clear the visible platform edge. So margin = 0
    // means "ring-out when the actor's bounding box clears the arena
    // rectangle" — which already accounts for the 24px padding since
    // the arena rect matches the full PNG canvas.
    ringOutMargin: 0,
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
    slapRange: 58,
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
