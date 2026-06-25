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
  | "outline"
  | "trail"
  | "slapFx"
  | "title"
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
  // Issue 1 fix: removed the entire "color" category. The color tint
  // didn't work reliably on PNG sprites (Phaser's setTint multiplies
  // the texture color, making most cosmetics look muddy or invisible).
  // Instead, the game now focuses on more visible cosmetics: headwear,
  // trails, slap FX, outlines, and titles.

  // --- Outlines (free, level-gated) ---
  // Issue 4 fix: removed "outline-none" — it was a duplicate of
  // "outline-white" (both 0xffffff). Equipping "none" via toggle
  // (clicking an equipped outline unequips it) achieves the same
  // visual effect without a separate manifest entry.
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

  // --- Power-up skins ---
  // Issue 4 fix: removed both powerup-skin-default and powerup-skin-rounded.
  // Neither had any visual effect (the power-up sprites are always the
  // same regardless of the skinKey). Re-adding this category requires
  // implementing actual reskinned PNGs in PowerUpSystem. For now the
  // category is empty — getCosmeticsByCategory("powerUpSkin") returns [].

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
  {
    id: "headwear-halo",
    category: "headwear",
    nameKey: "cosmetic.headwear.halo",
    source: { kind: "free", unlockLevel: 5 },
    effect: { spriteKey: "headwear-halo", offsetY: -28 },
  },
  {
    id: "headwear-helmet",
    category: "headwear",
    nameKey: "cosmetic.headwear.helmet",
    source: { kind: "free", unlockLevel: 7 },
    effect: { spriteKey: "headwear-helmet", offsetY: -28 },
  },

  // --- 2P-free cosmetics (only available in 2P-local mode) ---
  {
    id: "headwear-2p-party-hat",
    category: "headwear",
    nameKey: "cosmetic.headwear.2p-party-hat",
    source: { kind: "2p-free" },
    effect: { spriteKey: "headwear-party-hat", offsetY: -30 },
  },

  // --- Paid headwear (19 ₽ each) ---
  { id: "headwear-wizard", category: "headwear", nameKey: "cosmetic.headwear.wizard", source: { kind: "paid", productId: "hw_wizard", pack: "" }, effect: { spriteKey: "headwear-wizard", offsetY: -28 } },
  { id: "headwear-pirate", category: "headwear", nameKey: "cosmetic.headwear.pirate", source: { kind: "paid", productId: "hw_pirate", pack: "" }, effect: { spriteKey: "headwear-pirate", offsetY: -28 } },
  { id: "headwear-space", category: "headwear", nameKey: "cosmetic.headwear.space", source: { kind: "paid", productId: "hw_space", pack: "" }, effect: { spriteKey: "headwear-space", offsetY: -28 } },
  { id: "headwear-ninja", category: "headwear", nameKey: "cosmetic.headwear.ninja", source: { kind: "paid", productId: "hw_ninja", pack: "" }, effect: { spriteKey: "headwear-ninja", offsetY: -26 } },
  { id: "headwear-viking", category: "headwear", nameKey: "cosmetic.headwear.viking", source: { kind: "paid", productId: "hw_viking", pack: "" }, effect: { spriteKey: "headwear-viking", offsetY: -28 } },
  { id: "headwear-tophat", category: "headwear", nameKey: "cosmetic.headwear.tophat", source: { kind: "paid", productId: "hw_tophat", pack: "" }, effect: { spriteKey: "headwear-tophat", offsetY: -28 } },

  // --- Paid trails (19 ₽ each) ---
  { id: "trail-fire", category: "trail", nameKey: "cosmetic.trail.fire", source: { kind: "paid", productId: "trail_fire", pack: "" }, effect: { textureKey: "trail-fire", color: 0xff6414 } },
  { id: "trail-rainbow", category: "trail", nameKey: "cosmetic.trail.rainbow", source: { kind: "paid", productId: "trail_rainbow", pack: "" }, effect: { textureKey: "trail-rainbow", color: 0xc864ff } },
  { id: "trail-galaxy", category: "trail", nameKey: "cosmetic.trail.galaxy", source: { kind: "paid", productId: "trail_galaxy", pack: "" }, effect: { textureKey: "trail-galaxy", color: 0x503cc8 } },
  { id: "trail-poison", category: "trail", nameKey: "cosmetic.trail.poison", source: { kind: "paid", productId: "trail_poison", pack: "" }, effect: { textureKey: "trail-poison", color: 0x50c832 } },

  // --- Paid slap FX (19 ₽ each) ---
  { id: "slapfx-explosion", category: "slapFx", nameKey: "cosmetic.slapfx.explosion", source: { kind: "paid", productId: "slapfx_explosion", pack: "" }, effect: { textureKey: "slapfx-explosion" } },
  { id: "slapfx-confetti", category: "slapFx", nameKey: "cosmetic.slapfx.confetti", source: { kind: "paid", productId: "slapfx_confetti", pack: "" }, effect: { textureKey: "slapfx-confetti" } },
  { id: "slapfx-skull", category: "slapFx", nameKey: "cosmetic.slapfx.skull", source: { kind: "paid", productId: "slapfx_skull", pack: "" }, effect: { textureKey: "slapfx-skull" } },
  { id: "slapfx-heart", category: "slapFx", nameKey: "cosmetic.slapfx.heart", source: { kind: "paid", productId: "slapfx_heart", pack: "" }, effect: { textureKey: "slapfx-heart" } },

  // --- Paid outlines (19 ₽ each) ---
  { id: "outline-gold", category: "outline", nameKey: "cosmetic.outline.gold", source: { kind: "paid", productId: "outline_gold", pack: "" }, effect: { value: 0xffd700 } },
  { id: "outline-rainbow", category: "outline", nameKey: "cosmetic.outline.rainbow", source: { kind: "paid", productId: "outline_rainbow", pack: "" }, effect: { value: 0xff00ff } },
  { id: "outline-neon-pink", category: "outline", nameKey: "cosmetic.outline.neon-pink", source: { kind: "paid", productId: "outline_neon_pink", pack: "" }, effect: { value: 0xff1493 } },
  { id: "outline-neon-green", category: "outline", nameKey: "cosmetic.outline.neon-green", source: { kind: "paid", productId: "outline_neon_green", pack: "" }, effect: { value: 0x39ff14 } },

  // --- Paid titles (19 ₽ each) ---
  { id: "title-titan", category: "title", nameKey: "cosmetic.title.titan", source: { kind: "paid", productId: "title_premium", pack: "" }, effect: { key: "titan" } },
  { id: "title-legend-plus", category: "title", nameKey: "cosmetic.title.legend-plus", source: { kind: "paid", productId: "title_legend_premium", pack: "" }, effect: { key: "legend-plus" } },
  { id: "title-patrician", category: "title", nameKey: "cosmetic.title.patrician", source: { kind: "paid", productId: "title_patron", pack: "" }, effect: { key: "patrician" } },
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
 * Rules (Issue 5 correct fix):
 *   - **1P-vs-bot mode** (`is2P = false`): cosmetics are available
 *     according to progression. A cosmetic is available when:
 *       - It's in `profile.cosmetics.owned` (purchased or granted), OR
 *       - It's `free` AND its unlockLevel <= profile.level.
 *     - `2p-free` cosmetics are NOT available in 1P mode (they're
 *       2P-exclusive bonus cosmetics).
 *     - `paid` cosmetics are NOT available unless in `owned`.
 *   - **2P-local mode** (`is2P = true`): ALL cosmetics are available
 *     to BOTH players regardless of progression. This includes paid,
 *     2p-free, and level-gated cosmetics — everything is unlocked for
 *     the session.
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

  // 2P-local mode: ALL cosmetics available to both players.
  if (is2P) return true;

  // 1P-vs-bot mode: progression-gated.
  // Owned cosmetics (purchased or granted) are always available.
  if (profile.cosmetics?.owned?.includes(cosmeticId)) return true;

  // Free cosmetics gated by level.
  if (def.source.kind === "free") {
    const requiredLevel = def.source.unlockLevel ?? 1;
    return (profile.level ?? 1) >= requiredLevel;
  }

  // 2p-free and paid cosmetics are NOT available in 1P mode (unless
  // they're in the owned list, checked above).
  return false;
}
