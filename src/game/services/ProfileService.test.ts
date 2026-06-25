import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../config/profile";
import { ProfileService, type GameResult } from "./ProfileService";

function makeDefaultService(): ProfileService {
  return new ProfileService({ ...DEFAULT_PROFILE, powerUpStats: {} });
}

function win(
  overrides: Partial<GameResult> = {},
): GameResult {
  return {
    mode: "1p-vs-bot",
    outcome: "win",
    ringOutsInflicted: 0,
    ringOutsSuffered: 0,
    powerUpsCollected: 0,
    powerUpTypes: [],
    mapKey: "arena-default",
    ...overrides,
  };
}

describe("ProfileService", () => {
  it("recordGameResult increments totalGames", () => {
    const service = makeDefaultService();
    service.recordGameResult(win());
    expect(service.getProfile().totalGames).toBe(1);
    expect(service.getTotalGames()).toBe(1);
    service.recordGameResult(win());
    expect(service.getTotalGames()).toBe(2);
  });

  it("recordGameResult increments wins/losses/draws based on outcome", () => {
    const service = makeDefaultService();
    service.recordGameResult(win({ outcome: "win" }));
    service.recordGameResult(win({ outcome: "loss" }));
    service.recordGameResult(win({ outcome: "draw" }));
    const p = service.getProfile();
    expect(p.wins).toBe(1);
    expect(p.losses).toBe(1);
    expect(p.draws).toBe(1);
  });

  it("recordGameResult increments ringOutsInflicted/Suffered", () => {
    const service = makeDefaultService();
    service.recordGameResult(win({ ringOutsInflicted: 3, ringOutsSuffered: 1 }));
    service.recordGameResult(win({ ringOutsInflicted: 1, ringOutsSuffered: 2 }));
    const p = service.getProfile();
    expect(p.ringOutsInflicted).toBe(4);
    expect(p.ringOutsSuffered).toBe(3);
  });

  it("recordGameResult increments powerUpsCollected", () => {
    const service = makeDefaultService();
    service.recordGameResult(
      win({ powerUpsCollected: 3, powerUpTypes: ["speed", "shield", "speed"] }),
    );
    expect(service.getProfile().powerUpsCollected).toBe(3);
    service.recordGameResult(win({ powerUpsCollected: 2, powerUpTypes: ["knockback", "knockback"] }));
    expect(service.getProfile().powerUpsCollected).toBe(5);
  });

  it("recordGameResult updates powerUpStats by type", () => {
    const service = makeDefaultService();
    service.recordGameResult(
      win({ powerUpsCollected: 3, powerUpTypes: ["speed", "shield", "speed"] }),
    );
    expect(service.getProfile().powerUpStats).toEqual({ speed: 2, shield: 1 });
    service.recordGameResult(
      win({ powerUpsCollected: 1, powerUpTypes: ["knockback"] }),
    );
    expect(service.getProfile().powerUpStats).toEqual({
      speed: 2,
      shield: 1,
      knockback: 1,
    });
  });

  it("recordGameResult updates lastPlayedAt", () => {
    const service = makeDefaultService();
    expect(service.getProfile().lastPlayedAt).toBe(0);
    const before = Date.now();
    service.recordGameResult(win());
    const after = Date.now();
    const last = service.getProfile().lastPlayedAt;
    expect(last).toBeGreaterThanOrEqual(before);
    expect(last).toBeLessThanOrEqual(after);
  });

  it("recordGameResult updates favoriteMode", () => {
    const service = makeDefaultService();
    expect(service.getProfile().favoriteMode).toBe("1p-vs-bot");
    service.recordGameResult(win({ mode: "2p-local" }));
    expect(service.getProfile().favoriteMode).toBe("2p-local");
  });

  it("getWinRate returns 0 when no games played", () => {
    const service = makeDefaultService();
    expect(service.getWinRate()).toBe(0);
  });

  it("getWinRate returns wins/totalGames", () => {
    const service = makeDefaultService();
    service.recordGameResult(win());
    service.recordGameResult(win({ outcome: "loss" }));
    service.recordGameResult(win());
    expect(service.getWinRate()).toBeCloseTo(2 / 3);
  });

  it("getFavoritePowerUp returns null when no power-ups collected", () => {
    const service = makeDefaultService();
    expect(service.getFavoritePowerUp()).toBeNull();
  });

  it("getFavoritePowerUp returns the most-collected type", () => {
    const service = makeDefaultService();
    service.recordGameResult(
      win({
        powerUpsCollected: 3,
        powerUpTypes: ["speed", "shield", "speed"],
      }),
    );
    service.recordGameResult(
      win({ powerUpsCollected: 1, powerUpTypes: ["knockback"] }),
    );
    expect(service.getFavoritePowerUp()).toBe("speed");
  });

  it("getFavoriteMode returns most-played mode", () => {
    const service = makeDefaultService();
    service.recordGameResult(win({ mode: "1p-vs-bot" }));
    service.recordGameResult(win({ mode: "2p-local" }));
    service.recordGameResult(win({ mode: "1p-vs-bot" }));
    expect(service.getFavoriteMode()).toBe("1p-vs-bot");
  });

  // --- Bug 8: favoriteMode must use accurate mode counts ---
  describe("Bug 8: accurate mode counts from p2GamesPlayed", () => {
    it("does NOT attribute all prior games to favoriteMode when loading an existing profile", () => {
      // Bug 8: previously the constructor did
      //   modeCounts[profile.favoriteMode] = profile.totalGames
      // which meant ALL prior games were counted as the favorite mode.
      // If a player had 10 games (5 in 1P, 5 in 2P) with favoriteMode
      // = "1p-vs-bot", the constructor would say 10 × 1P + 0 × 2P,
      // losing the 2P history.
      //
      // Fix: derive from p2GamesPlayed. 2P count = p2GamesPlayed,
      // 1P count = totalGames - p2GamesPlayed.
      const profile = {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        totalGames: 10,
        p2GamesPlayed: 4,
        favoriteMode: "1p-vs-bot" as const,
      };
      const service = new ProfileService(profile);
      // 1P = 10 - 4 = 6, 2P = 4. favoriteMode should be "1p-vs-bot" (6 > 4).
      expect(service.getFavoriteMode()).toBe("1p-vs-bot");
      // Record one more 2P game → 2P = 5, 1P = 6. Still 1P.
      service.recordGameResult(win({ mode: "2p-local" }));
      expect(service.getFavoriteMode()).toBe("1p-vs-bot");
      // Record another 2P → 2P = 6, 1P = 6. Tie → keeps current favorite.
      service.recordGameResult(win({ mode: "2p-local" }));
      expect(service.getFavoriteMode()).toBe("1p-vs-bot");
      // Record another 2P → 2P = 7, 1P = 6. Now 2P wins.
      service.recordGameResult(win({ mode: "2p-local" }));
      expect(service.getFavoriteMode()).toBe("2p-local");
    });

    it("handles a profile with p2GamesPlayed > totalGames (defensive — corrupt save)", () => {
      // p2GamesPlayed should never exceed totalGames, but a corrupt save
      // could have it. The constructor clamps p2Count to totalGames so
      // 1P count doesn't go negative.
      const profile = {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        totalGames: 5,
        p2GamesPlayed: 99, // corrupt
        favoriteMode: "1p-vs-bot" as const,
      };
      const service = new ProfileService(profile);
      // 2P clamped to 5, 1P = 0. favoriteMode = "2p-local" (5 > 0).
      expect(service.getFavoriteMode()).toBe("2p-local");
    });

    it("preserves accurate counts across save/load cycle", () => {
      // Simulate: play 3 1P + 2 2P games, save profile, reload, play
      // 1 more 2P game. favoriteMode should reflect 3 × 1P + 3 × 2P
      // = tie → keeps current favorite.
      const profile1 = {
        ...DEFAULT_PROFILE,
        powerUpStats: {},
        totalGames: 5,
        p2GamesPlayed: 2,
        favoriteMode: "1p-vs-bot" as const,
      };
      const service1 = new ProfileService(profile1);
      service1.recordGameResult(win({ mode: "2p-local" }));
      const saved = service1.getProfile();
      // saved: totalGames=6, p2GamesPlayed=3, favoriteMode still "1p-vs-bot" (3=3 tie).
      expect(saved.totalGames).toBe(6);
      expect(saved.p2GamesPlayed).toBe(3);
      expect(saved.favoriteMode).toBe("1p-vs-bot");

      // Reload from saved profile.
      const service2 = new ProfileService(saved);
      expect(service2.getFavoriteMode()).toBe("1p-vs-bot");
      // The counts should be 3 × 1P + 3 × 2P, NOT 6 × 1P + 0 × 2P.
      // Play 1 more 2P → 3 × 1P + 4 × 2P → 2P wins.
      service2.recordGameResult(win({ mode: "2p-local" }));
      expect(service2.getFavoriteMode()).toBe("2p-local");
    });
  });

  it("getProfile returns a copy (mutating returned object doesn't affect service)", () => {
    const service = makeDefaultService();
    const p1 = service.getProfile();
    p1.nickname = "Mutated";
    p1.totalGames = 999;
    p1.powerUpStats.foo = 5;
    const p2 = service.getProfile();
    expect(p2.nickname).toBe(DEFAULT_PROFILE.nickname);
    expect(p2.totalGames).toBe(DEFAULT_PROFILE.totalGames);
    expect(p2.powerUpStats).toEqual({});
    // The two snapshots are independent objects.
    expect(p2).not.toBe(p1);
    expect(p2.powerUpStats).not.toBe(p1.powerUpStats);
  });

  it("setNickname updates the nickname", () => {
    const service = makeDefaultService();
    service.setNickname("Alice");
    expect(service.getProfile().nickname).toBe("Alice");
  });

  // --- RED: streak tracking ---
  describe("recordGameResult — win/loss streak", () => {
    it("increments currentWinStreak on a win (from 0)", () => {
      const service = makeDefaultService();
      service.recordGameResult(win());
      expect(service.getProfile().currentWinStreak).toBe(1);
      expect(service.getProfile().maxWinStreak).toBe(1);
    });

    it("increments currentWinStreak across consecutive wins and tracks max", () => {
      const service = makeDefaultService();
      service.recordGameResult(win());
      service.recordGameResult(win());
      service.recordGameResult(win());
      const p = service.getProfile();
      expect(p.currentWinStreak).toBe(3);
      expect(p.maxWinStreak).toBe(3);
    });

    it("resets currentWinStreak to 0 on a loss (but preserves maxWinStreak)", () => {
      const service = makeDefaultService();
      service.recordGameResult(win());
      service.recordGameResult(win());
      service.recordGameResult(win({ outcome: "loss" }));
      const p = service.getProfile();
      expect(p.currentWinStreak).toBe(0);
      expect(p.maxWinStreak).toBe(2);
    });

    it("resets currentWinStreak to 0 on a draw (but preserves maxWinStreak)", () => {
      const service = makeDefaultService();
      service.recordGameResult(win());
      service.recordGameResult(win({ outcome: "draw" }));
      const p = service.getProfile();
      expect(p.currentWinStreak).toBe(0);
      expect(p.maxWinStreak).toBe(1);
    });

    it("preserves maxWinStreak across a win-streak-loss-win cycle", () => {
      const service = makeDefaultService();
      // Win 4 in a row
      for (let i = 0; i < 4; i++) service.recordGameResult(win());
      // Lose one
      service.recordGameResult(win({ outcome: "loss" }));
      // Win 2 more
      service.recordGameResult(win());
      service.recordGameResult(win());
      const p = service.getProfile();
      expect(p.currentWinStreak).toBe(2);
      expect(p.maxWinStreak).toBe(4);
    });
  });

  // --- RED: mapsPlayed tracking ---
  describe("recordGameResult — mapsPlayed", () => {
    it("appends the mapKey to mapsPlayed on each game", () => {
      const service = makeDefaultService();
      service.recordGameResult(win({ mapKey: "arena-default" }));
      service.recordGameResult(win({ mapKey: "arena-ice" }));
      const p = service.getProfile();
      expect(p.mapsPlayed).toContain("arena-default");
      expect(p.mapsPlayed).toContain("arena-ice");
      expect(p.mapsPlayed).toHaveLength(2);
    });

    it("does not dedupe mapsPlayed (we want a play-count history)", () => {
      const service = makeDefaultService();
      service.recordGameResult(win({ mapKey: "arena-default" }));
      service.recordGameResult(win({ mapKey: "arena-default" }));
      expect(service.getProfile().mapsPlayed).toEqual([
        "arena-default",
        "arena-default",
      ]);
    });
  });

  // --- RED: p2GamesPlayed tracking ---
  describe("recordGameResult — p2GamesPlayed", () => {
    it("increments p2GamesPlayed when mode is 2p-local", () => {
      const service = makeDefaultService();
      service.recordGameResult(win({ mode: "2p-local" }));
      service.recordGameResult(win({ mode: "2p-local" }));
      expect(service.getProfile().p2GamesPlayed).toBe(2);
    });

    it("does NOT increment p2GamesPlayed when mode is 1p-vs-bot", () => {
      const service = makeDefaultService();
      service.recordGameResult(win({ mode: "1p-vs-bot" }));
      expect(service.getProfile().p2GamesPlayed).toBe(0);
    });
  });

  // --- RED: powerUpTypesUsed tracking ---
  describe("recordGameResult — powerUpTypesUsed", () => {
    it("merges new power-up types into powerUpTypesUsed (deduped)", () => {
      const service = makeDefaultService();
      service.recordGameResult(
        win({ powerUpTypes: ["speed", "shield", "speed"] }),
      );
      const p1 = service.getProfile();
      expect(p1.powerUpTypesUsed).toContain("speed");
      expect(p1.powerUpTypesUsed).toContain("shield");
      expect(p1.powerUpTypesUsed).toHaveLength(2);

      service.recordGameResult(win({ powerUpTypes: ["knockback", "speed"] }));
      const p2 = service.getProfile();
      expect(p2.powerUpTypesUsed).toContain("knockback");
      // speed is still only present once (deduped)
      expect(p2.powerUpTypesUsed.filter((t) => t === "speed")).toHaveLength(1);
      expect(p2.powerUpTypesUsed).toHaveLength(3);
    });

    it("handles empty powerUpTypes gracefully (no change)", () => {
      const service = makeDefaultService();
      service.recordGameResult(win({ powerUpTypes: [] }));
      expect(service.getProfile().powerUpTypesUsed).toEqual([]);
    });
  });
});
