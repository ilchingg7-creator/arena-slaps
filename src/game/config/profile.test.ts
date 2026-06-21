import { describe, expect, it } from "vitest";
import {
  createDefaultProfile,
  DEFAULT_PROFILE,
  loadProfile,
  resetProfileStats,
  saveProfile,
  type Profile,
} from "./profile";

describe("profile", () => {
  it("DEFAULT_PROFILE has all fields with correct defaults", () => {
    expect(DEFAULT_PROFILE.nickname).toBe("Player");
    expect(DEFAULT_PROFILE.avatar).toBe("player-idle");
    expect(DEFAULT_PROFILE.totalGames).toBe(0);
    expect(DEFAULT_PROFILE.wins).toBe(0);
    expect(DEFAULT_PROFILE.losses).toBe(0);
    expect(DEFAULT_PROFILE.draws).toBe(0);
    expect(DEFAULT_PROFILE.ringOutsInflicted).toBe(0);
    expect(DEFAULT_PROFILE.ringOutsSuffered).toBe(0);
    expect(DEFAULT_PROFILE.powerUpsCollected).toBe(0);
    expect(DEFAULT_PROFILE.powerUpStats).toEqual({});
    expect(DEFAULT_PROFILE.favoriteMode).toBe("1p-vs-bot");
    expect(DEFAULT_PROFILE.createdAt).toBe(0);
    expect(DEFAULT_PROFILE.lastPlayedAt).toBe(0);
  });

  it("loadProfile returns DEFAULT_PROFILE when storage is null/undefined", () => {
    expect(loadProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(loadProfile(undefined)).toEqual(DEFAULT_PROFILE);
  });

  it("loadProfile returns DEFAULT_PROFILE when storage has no entry", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        /* noop */
      },
    };
    expect(loadProfile(storage)).toEqual(DEFAULT_PROFILE);
  });

  it("loadProfile returns DEFAULT_PROFILE when storage JSON is corrupt", () => {
    const storage = {
      getItem: () => "not-json{",
      setItem: () => {
        /* noop */
      },
    };
    expect(loadProfile(storage)).toEqual(DEFAULT_PROFILE);
  });

  it("loadProfile merges partial stored profile over defaults (missing fields get defaults)", () => {
    const storage = {
      getItem: () => JSON.stringify({ nickname: "Alice", wins: 5 }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadProfile(storage);
    expect(loaded.nickname).toBe("Alice");
    expect(loaded.wins).toBe(5);
    expect(loaded.avatar).toBe(DEFAULT_PROFILE.avatar);
    expect(loaded.totalGames).toBe(DEFAULT_PROFILE.totalGames);
    expect(loaded.losses).toBe(DEFAULT_PROFILE.losses);
    expect(loaded.draws).toBe(DEFAULT_PROFILE.draws);
    expect(loaded.ringOutsInflicted).toBe(DEFAULT_PROFILE.ringOutsInflicted);
    expect(loaded.ringOutsSuffered).toBe(DEFAULT_PROFILE.ringOutsSuffered);
    expect(loaded.powerUpsCollected).toBe(DEFAULT_PROFILE.powerUpsCollected);
    expect(loaded.powerUpStats).toEqual({});
    expect(loaded.favoriteMode).toBe(DEFAULT_PROFILE.favoriteMode);
    expect(loaded.createdAt).toBe(DEFAULT_PROFILE.createdAt);
    expect(loaded.lastPlayedAt).toBe(DEFAULT_PROFILE.lastPlayedAt);
  });

  it("saveProfile serializes to JSON and persists via setItem", () => {
    let capturedKey = "";
    let capturedValue = "";
    const storage = {
      getItem: () => null,
      setItem: (key: string, value: string) => {
        capturedKey = key;
        capturedValue = value;
      },
    };
    const profile: Profile = {
      nickname: "Alice",
      avatar: "player-idle",
      totalGames: 5,
      wins: 3,
      losses: 2,
      draws: 0,
      ringOutsInflicted: 4,
      ringOutsSuffered: 1,
      powerUpsCollected: 2,
      powerUpStats: { speed: 2 },
      favoriteMode: "2p-local",
      createdAt: 12345,
      lastPlayedAt: 67890,
    };
    saveProfile(storage, profile);
    expect(capturedKey).toBe("arena-slaps:profile");
    expect(JSON.parse(capturedValue)).toEqual(profile);
  });

  it("createDefaultProfile sets createdAt to current time", () => {
    const before = Date.now();
    const profile = createDefaultProfile();
    const after = Date.now();
    expect(profile.createdAt).toBeGreaterThanOrEqual(before);
    expect(profile.createdAt).toBeLessThanOrEqual(after);
    // All other fields match the defaults.
    expect(profile.nickname).toBe(DEFAULT_PROFILE.nickname);
    expect(profile.avatar).toBe(DEFAULT_PROFILE.avatar);
    expect(profile.totalGames).toBe(0);
    expect(profile.wins).toBe(0);
    expect(profile.losses).toBe(0);
    expect(profile.draws).toBe(0);
    expect(profile.ringOutsInflicted).toBe(0);
    expect(profile.ringOutsSuffered).toBe(0);
    expect(profile.powerUpsCollected).toBe(0);
    expect(profile.powerUpStats).toEqual({});
    expect(profile.favoriteMode).toBe(DEFAULT_PROFILE.favoriteMode);
    expect(profile.lastPlayedAt).toBe(0);
  });

  it("resetProfileStats zeroes all stats but keeps nickname + avatar", () => {
    const profile: Profile = {
      nickname: "Alice",
      avatar: "player-idle",
      totalGames: 10,
      wins: 5,
      losses: 3,
      draws: 2,
      ringOutsInflicted: 8,
      ringOutsSuffered: 4,
      powerUpsCollected: 6,
      powerUpStats: { speed: 4, shield: 2 },
      favoriteMode: "2p-local",
      createdAt: 1234567890,
      lastPlayedAt: 9876543210,
    };
    const reset = resetProfileStats(profile);
    expect(reset.nickname).toBe("Alice");
    expect(reset.avatar).toBe("player-idle");
    expect(reset.totalGames).toBe(0);
    expect(reset.wins).toBe(0);
    expect(reset.losses).toBe(0);
    expect(reset.draws).toBe(0);
    expect(reset.ringOutsInflicted).toBe(0);
    expect(reset.ringOutsSuffered).toBe(0);
    expect(reset.powerUpsCollected).toBe(0);
    expect(reset.powerUpStats).toEqual({});
    expect(reset.favoriteMode).toBe(DEFAULT_PROFILE.favoriteMode);
    expect(reset.lastPlayedAt).toBe(0);
  });

  it("resetProfileStats creates a NEW object (doesn't mutate input)", () => {
    const original: Profile = {
      ...DEFAULT_PROFILE,
      powerUpStats: { speed: 2, shield: 1 },
      nickname: "Bob",
      totalGames: 7,
      wins: 5,
      losses: 2,
      draws: 0,
      ringOutsInflicted: 3,
      ringOutsSuffered: 1,
      powerUpsCollected: 3,
      favoriteMode: "2p-local",
      createdAt: 111,
      lastPlayedAt: 222,
    };
    const snapshot: Profile = {
      ...original,
      powerUpStats: { ...original.powerUpStats },
    };
    const reset = resetProfileStats(original);
    expect(reset).not.toBe(original);
    expect(reset.powerUpStats).not.toBe(original.powerUpStats);
    // Input is untouched.
    expect(original).toEqual(snapshot);
    expect(original.totalGames).toBe(7);
    expect(original.powerUpStats).toEqual({ speed: 2, shield: 1 });
  });
});
