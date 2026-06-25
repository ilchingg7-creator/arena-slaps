/**
 * Cosmetics manifest — single source of truth for all cosmetic items
 * (colors, outlines, trails, slap effects, titles, power-up skins,
 * headwear overlays).
 *
 * Each cosmetic has:
 *   - `id` (stable, used in profile.cosmetics.owned[] + equipped)
 *   - `category` (which slot it occupies — only one cosmetic per
 *     category can be equipped at a time)
 *   - `nameKey` (i18n key, e.g. "cosmetic.color.crimson")
 *   - `source`:
 *       - `{ kind: "free"; unlockLevel?: number }` — unlocked via
 *         player level. `unlockLevel` undefined means always available
 *         (level 1).
 *       - `{ kind: "2p-free" }` — only available in 2P-local mode
 *         (free for both players for that session).
 *       - `{ kind: "paid"; productId: string; pack: string }` — paid
 *         DLC pack. Currently reserved for a future Yandex IAP
 *         integration; getCosmeticsForLevel skips these.
 *   - `effect` — category-specific data:
 *       - color:      `{ value: number }` (hex color)
 *       - outline:    `{ value: number }` (hex color)
 *       - trail:      `{ textureKey: string; color: number }`
 *       - slapFx:     `{ textureKey: string }` (PNG sprite for burst)
 *       - title:      `{ key: string }` (matches progression reward key)
 *       - powerUpSkin: `{ skinKey: string }`
 *       - headwear:   `{ spriteKey: string; offsetY: number }` (PNG
 *                     overlay sprite key + vertical offset for placing
 *                     it above the actor's head)
 *
 * The 2P-local free-cosmetics rule: in 2P mode, BOTH players can pick
 * ANY cosmetic (including paid ones) for free, for that session only.
 * `isCosmeticAvailable(profile, id, is2P)` returns true for everything
 * when is2P=true. The P2 selection is NOT persisted to the profile —
 * only P1's selection is saved.
 */

export type CosmeticCategory =
  | "color"
  | "outline"
  | "trail"
  | "slapFx"
  | "title"
  | "powerUpSkin"
  | "headwear";

export type CosmeticSource =
  | { kind: "free"; unlockLevel?: number }
  | { kind: "2p-free" }
  | { kind: "paid"; productId: string; pack: string };

export type CosmeticEffect =
  | { value: number }                                  // color
  | { value: number }                                  // outline
  | { textureKey: string; color: number }              // trail
  | { textureKey: string }                             // slapFx
  | { key: string }                                    // title
  | { skinKey: string }                                // powerUpSkin
  | { spriteKey: string; offsetY: number };            // headwear

export type CosmeticDefinition = {
  id: string;
  category: CosmeticCategory;
  nameKey: string;
  source: CosmeticSource;
  effect: CosmeticEffect;
};

export const COSMETICS: readonly CosmeticDefinition[] = [
  // --- Colors (free, level-gated) ---
  {
    id: "color-navy",
    category: "color",
    nameKey: "cosmetic.color.navy",
    source: { kind: "free", unlockLevel: 1 },
    effect: { value: 0x3d405b },
  },
  {
    id: "color-orange",
    category: "color",
    nameKey: "cosmetic.color.orange",
    source: { kind: "free", unlockLevel: 1 },
    effect: { value: 0xe07a5f },
  },
  {
    id: "color-crimson",
    category: "color",
    nameKey: "cosmetic.color.crimson",
    source: { kind: "free", unlockLevel: 2 },
    effect: { value: 0xc0392b },
  },
  {
    id: "color-emerald",
    category: "color",
    nameKey: "cosmetic.color.emerald",
    source: { kind: "free", unlockLevel: 2 },
    effect: { value: 0x27ae60 },
  },
  {
    id: "color-gold",
    category: "color",
    nameKey: "cosmetic.color.gold",
    source: { kind: "free", unlockLevel: 4 },
    effect: { value: 0xf1c40f },
  },
  {
    id: "color-sky",
    category: "color",
    nameKey: "cosmetic.color.sky",
    source: { kind: "free", unlockLevel: 4 },
    effect: { value: 0x3498db },
  },
  {
    id: "color-violet",
    category: "color",
    nameKey: "cosmetic.color.violet",
    source: { kind: "free", unlockLevel: 6 },
    effect: { value: 0x8e44ad },
  },
  {
    id: "color-magenta",
    category: "color",
    nameKey: "cosmetic.color.magenta",
    source: { kind: "free", unlockLevel: 6 },
    effect: { value: 0xe84393 },
  },
  {
    id: "color-mint",
    category: "color",
    nameKey: "cosmetic.color.mint",
    source: { kind: "free", unlockLevel: 8 },
    effect: { value: 0x00b894 },
  },
  {
    id: "color-coral",
    category: "color",
    nameKey: "cosmetic.color.coral",
    source: { kind: "free", unlockLevel: 8 },
    effect: { value: 0xff7675 },
  },

  // --- Outlines (free, level-gated) ---
  {
    id: "outline-none",
    category: "outline",
    nameKey: "cosmetic.outline.none",
    source: { kind: "free", unlockLevel: 1 },
    effect: { value: 0xffffff },
  },
  {
    id: "outline-white",
    category: "outline",
    nameKey: "cosmetic.outline.white",
    source: { kind: "free", unlockLevel: 3 },
    effect: { value: 0xffffff },
  },
  {
    id: "outline-cyan",
    category: "outline",
    nameKey: "cosmetic.outline.cyan",
    source: { kind: "free", unlockLevel: 5 },
    effect: { value: 0x00ffff },
  },

  // --- Trails (free, level-gated) ---
  {
    id: "trail-none",
    category: "trail",
    nameKey: "cosmetic.trail.none",
    source: { kind: "free", unlockLevel: 1 },
    effect: { textureKey: "", color: 0xffffff },
  },
  {
    id: "trail-dust",
    category: "trail",
    nameKey: "cosmetic.trail.dust",
    source: { kind: "free", unlockLevel: 7 },
    effect: { textureKey: "trail-dust", color: 0xaaaaaa },
  },
  {
    id: "trail-sparkle",
    category: "trail",
    nameKey: "cosmetic.trail.sparkle",
    source: { kind: "free", unlockLevel: 9 },
    effect: { textureKey: "trail-sparkle", color: 0xffffff },
  },

  // --- Slap FX (free, level-gated) ---
  {
    id: "slapfx-none",
    category: "slapFx",
    nameKey: "cosmetic.slapfx.none",
    source: { kind: "free", unlockLevel: 1 },
    effect: { textureKey: "" },
  },
  {
    id: "slapfx-star",
    category: "slapFx",
    nameKey: "cosmetic.slapfx.star",
    source: { kind: "free", unlockLevel: 4 },
    effect: { textureKey: "slapfx-star" },
  },
  {
    id: "slapfx-lightning",
    category: "slapFx",
    nameKey: "cosmetic.slapfx.lightning",
    source: { kind: "free", unlockLevel: 6 },
    effect: { textureKey: "slapfx-lightning" },
  },

  // --- Titles (free, mirror the progression reward titles) ---
  {
    id: "title-none",
    category: "title",
    nameKey: "cosmetic.title.none",
    source: { kind: "free", unlockLevel: 1 },
    effect: { key: "" },
  },
  {
    id: "title-rookie",
    category: "title",
    nameKey: "cosmetic.title.rookie",
    source: { kind: "free", unlockLevel: 2 },
    effect: { key: "rookie" },
  },
  {
    id: "title-fighter",
    category: "title",
    nameKey: "cosmetic.title.fighter",
    source: { kind: "free", unlockLevel: 4 },
    effect: { key: "fighter" },
  },
  {
    id: "title-master",
    category: "title",
    nameKey: "cosmetic.title.master",
    source: { kind: "free", unlockLevel: 6 },
    effect: { key: "master" },
  },
  {
    id: "title-champion",
    category: "title",
    nameKey: "cosmetic.title.champion",
    source: { kind: "free", unlockLevel: 8 },
    effect: { key: "champion" },
  },
  {
    id: "title-veteran",
    category: "title",
    nameKey: "cosmetic.title.veteran",
    source: { kind: "free", unlockLevel: 9 },
    effect: { key: "veteran" },
  },
  {
    id: "title-legend",
    category: "title",
    nameKey: "cosmetic.title.legend",
    source: { kind: "free", unlockLevel: 10 },
    effect: { key: "legend" },
  },

  // --- Power-up skins (free, level-gated) ---
  {
    id: "powerup-skin-default",
    category: "powerUpSkin",
    nameKey: "cosmetic.powerupskin.default",
    source: { kind: "free", unlockLevel: 1 },
    effect: { skinKey: "default" },
  },
  {
    id: "powerup-skin-rounded",
    category: "powerUpSkin",
    nameKey: "cosmetic.powerupskin.rounded",
    source: { kind: "free", unlockLevel: 5 },
    effect: { skinKey: "rounded" },
  },

  // --- Headwear (free, level-gated) ---
  {
    id: "headwear-none",
    category: "headwear",
    nameKey: "cosmetic.headwear.none",
    source: { kind: "free", unlockLevel: 1 },
    effect: { spriteKey: "", offsetY: 0 },
  },
  {
    id: "headwear-cap",
    category: "headwear",
    nameKey: "cosmetic.headwear.cap",
    source: { kind: "free", unlockLevel: 3 },
    effect: { spriteKey: "headwear-cap", offsetY: -28 },
  },
  {
    id: "headwear-crown",
    category: "headwear",
    nameKey: "cosmetic.headwear.crown",
    source: { kind: "free", unlockLevel: 7 },
    effect: { spriteKey: "headwear-crown", offsetY: -28 },
  },
  {
    id: "headwear-horns",
    category: "headwear",
    nameKey: "cosmetic.headwear.horns",
    source: { kind: "free", unlockLevel: 9 },
    effect: { spriteKey: "headwear-horns", offsetY: -26 },
  },

  // --- 2P-free cosmetics (only available in 2P-local mode) ---
  {
    id: "color-2p-azure",
    category: "color",
    nameKey: "cosmetic.color.2p-azure",
    source: { kind: "2p-free" },
    effect: { value: 0x74b9ff },
  },
  {
    id: "headwear-2p-party-hat",
    category: "headwear",
    nameKey: "cosmetic.headwear.2p-party-hat",
    source: { kind: "2p-free" },
    effect: { spriteKey: "headwear-party-hat", offsetY: -30 },
  },
];

/** Look up a cosmetic by id. Returns undefined when not found. */
export function getCosmeticById(id: string): CosmeticDefinition | undefined {
  return COSMETICS.find((c) => c.id === id);
}

/** All cosmetics matching the given category, in manifest order. */
export function getCosmeticsByCategory(
  category: CosmeticCategory,
): readonly CosmeticDefinition[] {
  return COSMETICS.filter((c) => c.category === category);
}

/**
 * Free cosmetics whose unlockLevel is <= the given player level.
 * Paid cosmetics are NOT included — they require a shop purchase.
 * 2P-free cosmetics are NOT included — they only appear in 2P mode
 * (use getCosmeticsFor2P for that).
 */
export function getCosmeticsForLevel(
  level: number,
): readonly CosmeticDefinition[] {
  return COSMETICS.filter((c) => {
    if (c.source.kind !== "free") return false;
    if (c.source.unlockLevel === undefined) return true;
    return c.source.unlockLevel <= level;
  });
}

/**
 * ALL cosmetics available in 2P-local mode. Per the design rule, in 2P
 * mode both players can pick ANY cosmetic (including paid + 2p-free)
 * for free, for that session only.
 */
export function getCosmeticsFor2P(): readonly CosmeticDefinition[] {
  return [...COSMETICS];
}

/**
 * Resolve the cosmetic definitions for the ids in
 * `profile.cosmetics.owned`. Skips unknown ids (defensive against old
 * saves that reference deleted cosmetics). Returns [] when the profile
 * has no cosmetics field.
 */
export function getOwnedCosmetics(
  profile: { cosmetics?: { owned?: string[] } },
): readonly CosmeticDefinition[] {
  const owned = profile.cosmetics?.owned;
  if (!owned) return [];
  const result: CosmeticDefinition[] = [];
  for (const id of owned) {
    const def = getCosmeticById(id);
    if (def) result.push(def);
  }
  return result;
}

/**
 * Whether the given cosmetic is available for the player to equip.
 *
 * Rules:
 *   - If `is2P` is true, returns true for EVERY cosmetic in the manifest
 *     (the 2P-local free-cosmetics rule). Returns false for unknown ids.
 *   - Else, returns true when:
 *       - The cosmetic is in `profile.cosmetics.owned` (purchased or
 *         otherwise explicitly granted), OR
 *       - The cosmetic is `free` AND its unlockLevel <= profile.level.
 *   - Returns false for paid cosmetics not in `owned` (when not 2P).
 *   - Returns false for 2p-free cosmetics when not in 2P mode.
 *   - Returns false for unknown ids.
 */
export function isCosmeticAvailable(
  profile: {
    level?: number;
    cosmetics?: { owned?: string[] };
  },
  cosmeticId: string,
  is2P: boolean,
): boolean {
  const def = getCosmeticById(cosmeticId);
  if (!def) return false;

  // 2P-local: everything is available.
  if (is2P) return true;

  // Owned cosmetics (purchased or granted) are always available.
  if (profile.cosmetics?.owned?.includes(cosmeticId)) return true;

  // Free cosmetics gated by level.
  if (def.source.kind === "free") {
    const requiredLevel = def.source.unlockLevel ?? 1;
    return (profile.level ?? 1) >= requiredLevel;
  }

  // Paid (not in owned) and 2p-free (not in 2P mode) → unavailable.
  return false;
}
