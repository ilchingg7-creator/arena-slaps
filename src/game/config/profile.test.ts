import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE,
  loadProfile,
  migrateProfile,
  resetProfileStats,
  saveProfile,
  type Profile,
} from "./profile";

function makeStorage(initial: Record<string, string> = {}): {
  storage: Storage;
  store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  const storage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as Storage;
  return { storage, store };
}

describe("profile", () => {
  it("DEFAULT_PROFILE has the achievements-related fields", () => {
    expect(DEFAULT_PROFILE.achievements).toEqual([]);
    expect(DEFAULT_PROFILE.currentWinStreak).toBe(0);
    expect(DEFAULT_PROFILE.maxWinStreak).toBe(0);
    expect(DEFAULT_PROFILE.powerUpTypesUsed).toEqual([]);
    expect(DEFAULT_PROFILE.mapsPlayed).toEqual([]);
    expect(DEFAULT_PROFILE.p2GamesPlayed).toBe(0);
    expect(DEFAULT_PROFILE.totalGames).toBe(0);
    expect(DEFAULT_PROFILE.wins).toBe(0);
    expect(DEFAULT_PROFILE.ringOutsInflicted).toBe(0);
    expect(DEFAULT_PROFILE.ringOutsSuffered).toBe(0);
    expect(DEFAULT_PROFILE.powerUpsCollected).toBe(0);
  });

  it("loadProfile returns DEFAULT_PROFILE when storage is null", () => {
    expect(loadProfile(null)).toEqual(DEFAULT_PROFILE);
  });

  it("saveProfile + loadProfile round-trip preserves all fields", () => {
    const { storage } = makeStorage();
    const profile: Profile = {
      ...DEFAULT_PROFILE,
      totalGames: 42,
      wins: 30,
      losses: 12,
      currentWinStreak: 5,
      maxWinStreak: 7,
      ringOutsInflicted: 100,
      ringOutsSuffered: 20,
      powerUpsCollected: 50,
      powerUpTypesUsed: ["speed", "knockback", "shield"],
      mapsPlayed: ["arena-default", "arena-ice"],
      p2GamesPlayed: 11,
      achievements: ["first_blood", "streak_5"],
      xp: 1500,
      level: 5,
    };
    saveProfile(storage, profile);
    expect(loadProfile(storage)).toEqual(profile);
  });

  it("migrateProfile fills in missing fields on old profiles", () => {
    // Old profile persisted before achievements existed — only has totalGames.
    const oldProfile = { totalGames: 5 } as Partial<Profile>;
    const migrated = migrateProfile(oldProfile);
    expect(migrated.totalGames).toBe(5);
    expect(migrated.achievements).toEqual([]);
    expect(migrated.currentWinStreak).toBe(0);
    expect(migrated.maxWinStreak).toBe(0);
    expect(migrated.powerUpTypesUsed).toEqual([]);
    expect(migrated.mapsPlayed).toEqual([]);
    expect(migrated.p2GamesPlayed).toBe(0);
    expect(migrated.wins).toBe(0);
    expect(migrated.losses).toBe(0);
  });

  it("migrateProfile coerces non-array achievements to []", () => {
    const migrated = migrateProfile({
      achievements: "first_blood" as unknown as string[],
    });
    expect(migrated.achievements).toEqual([]);
  });

  it("migrateProfile coerces NaN numeric fields to defaults", () => {
    const migrated = migrateProfile({
      totalGames: "not-a-number" as unknown as number,
      wins: null as unknown as number,
    });
    expect(migrated.totalGames).toBe(0);
    expect(migrated.wins).toBe(0);
  });

  it("migrateProfile returns DEFAULT_PROFILE for null/undefined input", () => {
    expect(migrateProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(migrateProfile(undefined)).toEqual(DEFAULT_PROFILE);
  });

  it("loadProfile returns DEFAULT_PROFILE on corrupt JSON", () => {
    const { storage, store } = makeStorage();
    store.set("arena-slaps:profile", "{not json");
    expect(loadProfile(storage)).toEqual(DEFAULT_PROFILE);
  });

  it("resetProfileStats zeroes transient stats but keeps achievements", () => {
    const profile: Profile = {
      ...DEFAULT_PROFILE,
      totalGames: 42,
      wins: 30,
      losses: 12,
      currentWinStreak: 5,
      maxWinStreak: 7,
      ringOutsInflicted: 100,
      ringOutsSuffered: 20,
      powerUpsCollected: 50,
      p2GamesPlayed: 11,
      achievements: ["first_blood", "streak_5"],
      powerUpTypesUsed: ["speed"],
      mapsPlayed: ["arena-default"],
    };
    const reset = resetProfileStats(profile);
    expect(reset.totalGames).toBe(0);
    expect(reset.wins).toBe(0);
    expect(reset.losses).toBe(0);
    expect(reset.currentWinStreak).toBe(0);
    expect(reset.maxWinStreak).toBe(0);
    expect(reset.ringOutsInflicted).toBe(0);
    expect(reset.ringOutsSuffered).toBe(0);
    expect(reset.powerUpsCollected).toBe(0);
    expect(reset.p2GamesPlayed).toBe(0);
    // Achievements are permanent — never reset.
    expect(reset.achievements).toEqual(["first_blood", "streak_5"]);
    // Career collections (power-up types + maps) are also kept.
    expect(reset.powerUpTypesUsed).toEqual(["speed"]);
    expect(reset.mapsPlayed).toEqual(["arena-default"]);
  });
});
