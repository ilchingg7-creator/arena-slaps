/**
 * Level-based progression system.
 *
 * XP is earned from game results (win/loss/draw + ring-outs + power-ups).
 * Reaching new levels unlocks features (bots, maps, titles).
 *
 * To add a new level: append to {@link LEVELS} with the next level number,
 * xpRequired, unlocks, and optional reward.
 */

export type UnlockType = "bot" | "map" | "title";

export type Unlock = {
  type: UnlockType;
  key: string;
};

export type LevelReward = {
  type: "title";
  key: string;
} | null;

export type LevelDefinition = {
  level: number;
  xpRequired: number;
  unlocks: readonly Unlock[];
  reward: LevelReward;
};

export const XP_REWARDS = {
  win: 100,
  loss: 30,
  draw: 50,
  ringOut: 20,
  powerUpCollected: 10,
} as const;

export const LEVELS: readonly LevelDefinition[] = [
  { level: 1,  xpRequired: 0,    unlocks: [{ type: "bot", key: "bot-easy" }], reward: null },
  { level: 2,  xpRequired: 100,  unlocks: [{ type: "bot", key: "bot-medium" }], reward: { type: "title", key: "rookie" } },
  { level: 3,  xpRequired: 300,  unlocks: [{ type: "map", key: "arena-default" }], reward: null },
  { level: 4,  xpRequired: 600,  unlocks: [{ type: "bot", key: "bot-hard" }], reward: { type: "title", key: "fighter" } },
  { level: 5,  xpRequired: 1000, unlocks: [{ type: "map", key: "arena-neon" }], reward: null },
  { level: 6,  xpRequired: 1500, unlocks: [{ type: "map", key: "arena-cosmic" }], reward: { type: "title", key: "master" } },
  { level: 7,  xpRequired: 2200, unlocks: [{ type: "map", key: "arena-volcano" }], reward: null },
  { level: 8,  xpRequired: 3000, unlocks: [{ type: "map", key: "arena-ice" }], reward: { type: "title", key: "champion" } },
  { level: 9,  xpRequired: 4000, unlocks: [{ type: "map", key: "arena-grass" }], reward: null },
  { level: 10, xpRequired: 5500, unlocks: [{ type: "map", key: "all-maps" }], reward: { type: "title", key: "legend" } },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevelDefinition(level: number): LevelDefinition {
  if (level < 1 || level > MAX_LEVEL) {
    throw new Error(`Invalid level: ${level}. Must be 1..${MAX_LEVEL}.`);
  }
  return LEVELS[level - 1];
}

export function getLevelForXp(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      return LEVELS[i].level;
    }
  }
  return 1;
}

export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 0;
  }
  const nextDef = getLevelDefinition(currentLevel + 1);
  const currentDef = getLevelDefinition(currentLevel);
  return nextDef.xpRequired - currentDef.xpRequired;
}

export function getAllUnlocksUpTo(level: number): readonly Unlock[] {
  const unlocks: Unlock[] = [];
  const maxLevel = Math.min(level, MAX_LEVEL);
  for (let l = 1; l <= maxLevel; l++) {
    unlocks.push(...LEVELS[l - 1].unlocks);
  }
  return unlocks;
}

export function isUnlocked(unlocks: readonly Unlock[], key: string): boolean {
  return unlocks.some((u) => u.key === key);
}
