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
});
