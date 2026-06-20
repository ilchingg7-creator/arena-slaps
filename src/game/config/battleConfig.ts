export const battleConfig = {
  arena: {
    height: 520,
    ringOutMargin: 56,
    width: 920,
  },
  bot: {
    color: 0xe07a5f,
    knockbackSpeed: 500,
    speed: 210,
    slapRange: 74,
    size: 36,
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
