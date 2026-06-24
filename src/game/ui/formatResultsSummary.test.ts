import { describe, expect, it } from "vitest";
import { formatResultsSummary } from "./formatResultsSummary";
import type { BattleEndOutput } from "../services/processBattleEnd";
import { DEFAULT_PROFILE } from "../config/profile";

function makeBattleEnd(
  overrides: Partial<BattleEndOutput> = {},
): BattleEndOutput {
  return {
    updatedProfile: { ...DEFAULT_PROFILE, powerUpStats: {} },
    xpGained: 100,
    levelUp: {
      leveledUp: false,
      newLevel: 1,
      newUnlocks: [],
    },
    newlyUnlocked: [],
    xpDoubled: false,
    ...overrides,
  };
}

describe("formatResultsSummary", () => {
  it("returns an empty array when battleEnd is null (2P mode / no data)", () => {
    expect(formatResultsSummary({ battleEnd: null })).toEqual([]);
  });

  it("includes XP gained + current level even when no achievements / level-up", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        xpGained: 240,
        updatedProfile: {
          ...DEFAULT_PROFILE,
          powerUpStats: {},
          xp: 240,
          level: 2,
        },
      }),
      t: (_key, fallback) => fallback,
    });
    expect(lines).toContain("XP: +240");
    expect(lines).toContain("Level: 2");
    expect(lines.some((l) => l.startsWith("Level up!"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Achievement unlocked"))).toBe(false);
  });

  it("includes a level-up line with the new level when leveledUp is true", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        xpGained: 500,
        updatedProfile: {
          ...DEFAULT_PROFILE,
          powerUpStats: {},
          xp: 500,
          level: 3,
        },
        levelUp: {
          leveledUp: true,
          newLevel: 3,
          newUnlocks: [{ type: "bot", key: "bot-hard" }],
        },
      }),
      t: (_key, fallback) => fallback,
    });
    const levelUpLine = lines.find((l) => l.startsWith("Level up!"));
    expect(levelUpLine).toBeDefined();
    expect(levelUpLine).toContain("3");
    expect(levelUpLine).toContain("bot-hard");
  });

  it("includes a level-up line WITHOUT unlock keys when newUnlocks is empty", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        levelUp: {
          leveledUp: true,
          newLevel: 2,
          newUnlocks: [],
        },
      }),
      t: (_key, fallback) => fallback,
    });
    const levelUpLine = lines.find((l) => l.startsWith("Level up!"));
    expect(levelUpLine).toBeDefined();
    expect(levelUpLine).toContain("2");
    // No "new:" suffix when there are no unlocks.
    expect(levelUpLine).not.toContain("new:");
  });

  it("includes one achievement line per newlyUnlocked id (with icon + name)", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        newlyUnlocked: ["first_blood", "flawless"],
      }),
      t: (key, fallback) => {
        // Stub translator: return the key's last segment as a stand-in name.
        if (key === "achievement.first_blood.name") return "First Blood";
        if (key === "achievement.flawless.name") return "Flawless";
        return fallback;
      },
    });
    const achLines = lines.filter((l) =>
      l.startsWith("Achievement unlocked"),
    );
    expect(achLines).toHaveLength(2);
    // first_blood icon is 🩸, flawless icon is 💎
    expect(achLines.some((l) => l.includes("🩸") && l.includes("First Blood"))).toBe(true);
    expect(achLines.some((l) => l.includes("💎") && l.includes("Flawless"))).toBe(true);
  });

  it("skips unknown achievement ids (defensive — manifest changed)", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        newlyUnlocked: ["first_blood", "nonexistent_id"],
      }),
      t: (_key, fallback) => fallback,
    });
    const achLines = lines.filter((l) =>
      l.startsWith("Achievement unlocked"),
    );
    expect(achLines).toHaveLength(1);
    expect(achLines[0]).toContain("first_blood");
  });

  it("uses fallback strings when translator is omitted", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        xpGained: 100,
        updatedProfile: { ...DEFAULT_PROFILE, powerUpStats: {}, level: 1 },
      }),
    });
    expect(lines).toContain("XP: +100");
    expect(lines).toContain("Level: 1");
  });

  it("combines XP + level + level-up + achievements into a single ordered list", () => {
    const lines = formatResultsSummary({
      battleEnd: makeBattleEnd({
        xpGained: 300,
        updatedProfile: {
          ...DEFAULT_PROFILE,
          powerUpStats: {},
          xp: 300,
          level: 2,
        },
        levelUp: {
          leveledUp: true,
          newLevel: 2,
          newUnlocks: [{ type: "map", key: "arena-neon" }],
        },
        newlyUnlocked: ["first_blood"],
      }),
      t: (_key, fallback) => fallback,
    });
    // XP first, then level, then level-up, then achievement.
    expect(lines[0]).toContain("XP");
    expect(lines[1]).toContain("Level");
    expect(lines[2]).toContain("Level up");
    expect(lines[3]).toContain("Achievement unlocked");
  });
});
