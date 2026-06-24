import type { TranslationKey } from "./translations";

export type ArenaMap = {
  /** Unique key, e.g. "arena-default". Used as the map identifier in settings. */
  key: string;
  /** Translation key for the map's display name, e.g. "map.default". */
  nameKey: TranslationKey;
  /** Sprite key for the background image (must exist in spriteManifest). */
  bgKey: string;
  /** Sprite key for the platform image (must exist in spriteManifest). */
  platformKey: string;
  /** Unlock key in the progression system, e.g. "arena-neon". null = always available. */
  unlockKey: string | null;
  /** Short description translation key. */
  descriptionKey: TranslationKey;
};

export const MAPS: readonly ArenaMap[] = [
  {
    key: "arena-default",
    nameKey: "map.default",
    bgKey: "arena-bg",
    platformKey: "arena-platform",
    unlockKey: null, // always available
    descriptionKey: "map.default.desc",
  },
  {
    key: "arena-neon",
    nameKey: "map.neon",
    bgKey: "arena-bg-neon",
    platformKey: "arena-platform-neon",
    unlockKey: "arena-neon",
    descriptionKey: "map.neon.desc",
  },
  {
    key: "arena-cosmic",
    nameKey: "map.cosmic",
    bgKey: "arena-bg-cosmic",
    platformKey: "arena-platform-cosmic",
    unlockKey: "arena-cosmic",
    descriptionKey: "map.cosmic.desc",
  },
  {
    key: "arena-volcano",
    nameKey: "map.volcano",
    bgKey: "arena-bg-volcano",
    platformKey: "arena-platform-volcano",
    unlockKey: "arena-volcano",
    descriptionKey: "map.volcano.desc",
  },
  {
    key: "arena-ice",
    nameKey: "map.ice",
    bgKey: "arena-bg-ice",
    platformKey: "arena-platform-ice",
    unlockKey: "arena-ice",
    descriptionKey: "map.ice.desc",
  },
  {
    key: "arena-grass",
    nameKey: "map.grass",
    bgKey: "arena-bg-grass",
    platformKey: "arena-platform-grass",
    unlockKey: "arena-grass",
    descriptionKey: "map.grass.desc",
  },
];

export const DEFAULT_MAP_KEY = "arena-default";

/** Special unlock key that unlocks every map regardless of its own unlockKey. */
const ALL_MAPS_UNLOCK_KEY = "all-maps";

/**
 * Look up a single map by its unique key. Returns `undefined` when no map
 * matches — callers should fall back to {@link DEFAULT_MAP_KEY} (or
 * {@link getMapByIndex}(0)) in that case.
 */
export function getMapByKey(key: string): ArenaMap | undefined {
  return MAPS.find((m) => m.key === key);
}

/**
 * Return the map at the given 0-based index, wrapping around for both
 * positive out-of-range and negative indices via modulo arithmetic.
 * `getMapByIndex(0)` is the first map; `getMapByIndex(MAPS.length)` wraps
 * back to index 0; `getMapByIndex(-1)` returns the last map.
 */
export function getMapByIndex(index: number): ArenaMap {
  const count = MAPS.length;
  // `((index % count) + count) % count` handles negative indices correctly.
  const wrapped = ((index % count) + count) % count;
  return MAPS[wrapped];
}

/** Return the total number of registered maps. */
export function getMapCount(): number {
  return MAPS.length;
}

/**
 * Return the subset of maps the player can currently select. A map is
 * available when its `unlockKey` is `null` (always available) or when the
 * provided `unlockedKeys` list contains the map's `unlockKey`. The special
 * `"all-maps"` key in `unlockedKeys` unlocks every map regardless of its
 * individual `unlockKey`.
 */
export function getAvailableMaps(
  unlockedKeys: readonly string[],
): readonly ArenaMap[] {
  const unlockSet = new Set(unlockedKeys);
  if (unlockSet.has(ALL_MAPS_UNLOCK_KEY)) {
    return MAPS;
  }
  return MAPS.filter(
    (m) => m.unlockKey === null || unlockSet.has(m.unlockKey),
  );
}

/**
 * Return a random map from the available set (see {@link getAvailableMaps}).
 * When only one map is available (e.g. new player with no unlocks) that map
 * is returned deterministically — `Math.random` is not invoked.
 */
export function getRandomMap(unlockedKeys: readonly string[]): ArenaMap {
  const available = getAvailableMaps(unlockedKeys);
  if (available.length === 1) {
    return available[0];
  }
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/**
 * Return the 0-based index of the map with the given key inside the
 * {@link MAPS} array, or `-1` when no map matches. Useful for cycling
 * selection UIs (next/previous) that need to wrap around.
 */
export function getMapIndex(key: string): number {
  return MAPS.findIndex((m) => m.key === key);
}
