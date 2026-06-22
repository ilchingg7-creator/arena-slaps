import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_KEY,
  MAPS,
  getAvailableMaps,
  getMapByIndex,
  getMapByKey,
  getMapCount,
  getMapIndex,
  getRandomMap,
} from "./mapManifest";

describe("mapManifest", () => {
  it("MAPS has exactly 6 entries", () => {
    expect(MAPS).toHaveLength(6);
  });

  it("all map keys are unique", () => {
    const keys = MAPS.map((m) => m.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('first map is "arena-default" with unlockKey null (always available)', () => {
    const first = MAPS[0];
    expect(first.key).toBe("arena-default");
    expect(first.unlockKey).toBeNull();
  });

  it('getMapByKey("arena-default") returns the correct map', () => {
    const map = getMapByKey("arena-default");
    expect(map).toBeDefined();
    expect(map?.key).toBe("arena-default");
    expect(map?.nameKey).toBe("map.default");
  });

  it('getMapByKey("nonexistent") returns undefined', () => {
    expect(getMapByKey("nonexistent")).toBeUndefined();
  });

  it("getMapByIndex(0) returns the first map", () => {
    const map = getMapByIndex(0);
    expect(map.key).toBe(MAPS[0].key);
  });

  it("getMapByIndex(6) wraps to index 0 (modulo)", () => {
    const map = getMapByIndex(6);
    expect(map.key).toBe(MAPS[0].key);
  });

  it("getMapByIndex(-1) wraps to the last map", () => {
    const map = getMapByIndex(-1);
    expect(map.key).toBe(MAPS[MAPS.length - 1].key);
  });

  it("getMapCount() returns 6", () => {
    expect(getMapCount()).toBe(6);
  });

  it('getAvailableMaps([]) returns only the default map (unlockKey null)', () => {
    const available = getAvailableMaps([]);
    expect(available).toHaveLength(1);
    expect(available[0].key).toBe("arena-default");
  });

  it('getAvailableMaps(["arena-neon", "arena-cosmic"]) returns 3 maps (default + neon + cosmic)', () => {
    const available = getAvailableMaps(["arena-neon", "arena-cosmic"]);
    expect(available).toHaveLength(3);
    const keys = available.map((m) => m.key);
    expect(keys).toContain("arena-default");
    expect(keys).toContain("arena-neon");
    expect(keys).toContain("arena-cosmic");
  });

  it('getAvailableMaps(["all-maps"]) returns ALL 6 maps (special "all-maps" key unlocks everything)', () => {
    const available = getAvailableMaps(["all-maps"]);
    expect(available).toHaveLength(MAPS.length);
    expect(available).toEqual(MAPS);
  });

  it('getRandomMap([]) returns the default map (only available)', () => {
    const map = getRandomMap([]);
    expect(map.key).toBe("arena-default");
  });

  it('getRandomMap(["all-maps"]) returns one of the 6 maps', () => {
    const map = getRandomMap(["all-maps"]);
    const keys = MAPS.map((m) => m.key);
    expect(keys).toContain(map.key);
  });

  it('getMapIndex("arena-default") returns 0', () => {
    expect(getMapIndex("arena-default")).toBe(0);
  });

  it('getMapIndex("nonexistent") returns -1', () => {
    expect(getMapIndex("nonexistent")).toBe(-1);
  });

  it("every map has a bgKey and platformKey that are non-empty strings", () => {
    for (const map of MAPS) {
      expect(typeof map.bgKey).toBe("string");
      expect(map.bgKey.length).toBeGreaterThan(0);
      expect(typeof map.platformKey).toBe("string");
      expect(map.platformKey.length).toBeGreaterThan(0);
    }
  });

  it('every map\'s nameKey starts with "map."', () => {
    for (const map of MAPS) {
      expect(map.nameKey.startsWith("map.")).toBe(true);
    }
  });

  it('every map\'s descriptionKey starts with "map."', () => {
    for (const map of MAPS) {
      expect(map.descriptionKey.startsWith("map.")).toBe(true);
    }
  });

  it('DEFAULT_MAP_KEY is "arena-default"', () => {
    expect(DEFAULT_MAP_KEY).toBe("arena-default");
  });
});
