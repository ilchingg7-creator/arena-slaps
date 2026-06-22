import type { Profile } from "../config/profile";
import {
  XP_REWARDS,
  getLevelDefinition,
  getLevelForXp,
  getAllUnlocksUpTo,
  isUnlocked,
  MAX_LEVEL,
  type LevelReward,
  type Unlock,
} from "../config/progression";

export type GameResultForXp = {
  outcome: "win" | "loss" | "draw";
  ringOutsInflicted: number;
  powerUpsCollected: number;
};

export type LevelUpResult = {
  leveledUp: boolean;
  newLevel: number;
  newUnlocks: readonly Unlock[];
  reward: LevelReward;
};

export type ProgressInfo = {
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  xpIntoLevel: number;
  xpRemaining: number;
};

export class ProgressionService {
  static calculateXp(result: GameResultForXp): number {
    const base = XP_REWARDS[result.outcome];
    const ringOutXp = result.ringOutsInflicted * XP_REWARDS.ringOut;
    const powerUpXp = result.powerUpsCollected * XP_REWARDS.powerUpCollected;
    return base + ringOutXp + powerUpXp;
  }

  static applyXp(
    profile: Profile,
    xpGained: number,
  ): { profile: Profile; levelUp: LevelUpResult } {
    const oldXp = profile.xp ?? 0;
    const newXp = oldXp + xpGained;
    const oldLevel = getLevelForXp(oldXp);
    const newLevel = getLevelForXp(newXp);
    const leveledUp = newLevel > oldLevel;

    let newUnlocks: Unlock[] = [];
    let reward: LevelReward = null;

    if (leveledUp) {
      const oldUnlocks = getAllUnlocksUpTo(oldLevel);
      const allUnlocks = getAllUnlocksUpTo(newLevel);
      newUnlocks = allUnlocks.filter(
        (u) => !oldUnlocks.some((ou) => ou.key === u.key),
      );
      const def = getLevelDefinition(newLevel);
      reward = def.reward;
    }

    return {
      profile: { ...profile, xp: newXp, level: newLevel },
      levelUp: { leveledUp, newLevel, newUnlocks, reward },
    };
  }

  static isFeatureUnlocked(profile: Profile, key: string): boolean {
    const level = profile.level ?? 1;
    const unlocks = getAllUnlocksUpTo(level);
    return isUnlocked(unlocks, key);
  }

  static getUnlockedFeatures(profile: Profile): readonly Unlock[] {
    const level = profile.level ?? 1;
    return getAllUnlocksUpTo(level);
  }

  static getProgressToNextLevel(profile: Profile): ProgressInfo {
    const xp = profile.xp ?? 0;
    const level = profile.level ?? 1;

    if (level >= MAX_LEVEL) {
      return {
        currentLevelXp: 0,
        nextLevelXp: 0,
        progress: 1,
        xpIntoLevel: 0,
        xpRemaining: 0,
      };
    }

    const currentDef = getLevelDefinition(level);
    const nextDef = getLevelDefinition(level + 1);
    const currentLevelXp = currentDef.xpRequired;
    const nextLevelXp = nextDef.xpRequired;
    const xpIntoLevel = xp - currentLevelXp;
    const xpRemaining = nextLevelXp - xp;
    const progress = xpIntoLevel / (nextLevelXp - currentLevelXp);

    return {
      currentLevelXp,
      nextLevelXp,
      progress,
      xpIntoLevel,
      xpRemaining,
    };
  }
}
