/**
 * IAP manifest — defines all purchasable products and the cosmetics
 * they unlock. Each product maps to a Yandex Developer Console product
 * ID (must be registered manually there).
 *
 * Product IDs use snake_case to match Yandex conventions.
 * Cosmetic IDs use kebab-case to match CosmeticsManifest conventions.
 */

export type IAPProduct = {
  /** Yandex product ID (must match Developer Console). */
  productId: string;
  /** i18n key for the product title. */
  titleKey: string;
  /** i18n key for the product description. */
  descriptionKey: string;
  /** Default price string shown in UI when Yandex catalog isn't loaded. */
  defaultPrice: string;
  /** Cosmetic ids that this product unlocks. */
  cosmetics: string[];
  /** Whether this is a pack (group of items) or a single item. */
  isPack: boolean;
};

export const IAP_PRODUCTS: readonly IAPProduct[] = [
  // --- Individual headwear (19 ЯН each) ---
  // Headwear swap 2026-06-25: halo/crown/horns are now paid;
  // ninja/wizard/viking are now free (level-gated), so their products
  // are removed from the catalog.
  { productId: "hw_halo", titleKey: "shop.hw_halo.title", descriptionKey: "shop.hw_halo.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-halo"], isPack: false },
  { productId: "hw_crown", titleKey: "shop.hw_crown.title", descriptionKey: "shop.hw_crown.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-crown"], isPack: false },
  { productId: "hw_horns", titleKey: "shop.hw_horns.title", descriptionKey: "shop.hw_horns.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-horns"], isPack: false },
  { productId: "hw_pirate", titleKey: "shop.hw_pirate.title", descriptionKey: "shop.hw_pirate.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-pirate"], isPack: false },
  { productId: "hw_space", titleKey: "shop.hw_space.title", descriptionKey: "shop.hw_space.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-space"], isPack: false },
  { productId: "hw_tophat", titleKey: "shop.hw_tophat.title", descriptionKey: "shop.hw_tophat.desc", defaultPrice: "19 ЯН", cosmetics: ["headwear-tophat"], isPack: false },

  // --- Individual trails (19 ЯН each) ---
  { productId: "trail_fire", titleKey: "shop.trail_fire.title", descriptionKey: "shop.trail_fire.desc", defaultPrice: "19 ЯН", cosmetics: ["trail-fire"], isPack: false },
  { productId: "trail_rainbow", titleKey: "shop.trail_rainbow.title", descriptionKey: "shop.trail_rainbow.desc", defaultPrice: "19 ЯН", cosmetics: ["trail-rainbow"], isPack: false },
  { productId: "trail_galaxy", titleKey: "shop.trail_galaxy.title", descriptionKey: "shop.trail_galaxy.desc", defaultPrice: "19 ЯН", cosmetics: ["trail-galaxy"], isPack: false },
  { productId: "trail_poison", titleKey: "shop.trail_poison.title", descriptionKey: "shop.trail_poison.desc", defaultPrice: "19 ЯН", cosmetics: ["trail-poison"], isPack: false },

  // --- Individual slap FX (19 ЯН each) ---
  { productId: "slapfx_explosion", titleKey: "shop.slapfx_explosion.title", descriptionKey: "shop.slapfx_explosion.desc", defaultPrice: "19 ЯН", cosmetics: ["slapfx-explosion"], isPack: false },
  { productId: "slapfx_confetti", titleKey: "shop.slapfx_confetti.title", descriptionKey: "shop.slapfx_confetti.desc", defaultPrice: "19 ЯН", cosmetics: ["slapfx-confetti"], isPack: false },
  { productId: "slapfx_skull", titleKey: "shop.slapfx_skull.title", descriptionKey: "shop.slapfx_skull.desc", defaultPrice: "19 ЯН", cosmetics: ["slapfx-skull"], isPack: false },
  { productId: "slapfx_heart", titleKey: "shop.slapfx_heart.title", descriptionKey: "shop.slapfx_heart.desc", defaultPrice: "19 ЯН", cosmetics: ["slapfx-heart"], isPack: false },

  // --- Individual outlines (19 ЯН each) ---
  { productId: "outline_gold", titleKey: "shop.outline_gold.title", descriptionKey: "shop.outline_gold.desc", defaultPrice: "19 ЯН", cosmetics: ["outline-gold"], isPack: false },
  { productId: "outline_rainbow", titleKey: "shop.outline_rainbow.title", descriptionKey: "shop.outline_rainbow.desc", defaultPrice: "19 ЯН", cosmetics: ["outline-rainbow"], isPack: false },
  { productId: "outline_neon_pink", titleKey: "shop.outline_neon_pink.title", descriptionKey: "shop.outline_neon_pink.desc", defaultPrice: "19 ЯН", cosmetics: ["outline-neon-pink"], isPack: false },
  { productId: "outline_neon_green", titleKey: "shop.outline_neon_green.title", descriptionKey: "shop.outline_neon_green.desc", defaultPrice: "19 ЯН", cosmetics: ["outline-neon-green"], isPack: false },

  // --- Individual titles: removed (only available via pack_titles) ---

  // --- Packs (with discount) ---
  { productId: "pack_headwear", titleKey: "shop.pack_headwear.title", descriptionKey: "shop.pack_headwear.desc", defaultPrice: "49 ЯН", cosmetics: ["headwear-halo", "headwear-crown", "headwear-horns", "headwear-pirate", "headwear-space", "headwear-tophat"], isPack: true },
  { productId: "pack_trails", titleKey: "shop.pack_trails.title", descriptionKey: "shop.pack_trails.desc", defaultPrice: "39 ЯН", cosmetics: ["trail-fire", "trail-rainbow", "trail-galaxy", "trail-poison"], isPack: true },
  { productId: "pack_slapfx", titleKey: "shop.pack_slapfx.title", descriptionKey: "shop.pack_slapfx.desc", defaultPrice: "39 ЯН", cosmetics: ["slapfx-explosion", "slapfx-confetti", "slapfx-skull", "slapfx-heart"], isPack: true },
  { productId: "pack_outlines", titleKey: "shop.pack_outlines.title", descriptionKey: "shop.pack_outlines.desc", defaultPrice: "39 ЯН", cosmetics: ["outline-gold", "outline-rainbow", "outline-neon-pink", "outline-neon-green"], isPack: true },
  { productId: "pack_titles", titleKey: "shop.pack_titles.title", descriptionKey: "shop.pack_titles.desc", defaultPrice: "29 ЯН", cosmetics: ["title-titan", "title-legend-plus", "title-patrician"], isPack: true },
  { productId: "bundle_all", titleKey: "shop.bundle_all.title", descriptionKey: "shop.bundle_all.desc", defaultPrice: "149 ЯН", cosmetics: [
    "headwear-halo", "headwear-crown", "headwear-horns", "headwear-pirate", "headwear-space", "headwear-tophat",
    "trail-fire", "trail-rainbow", "trail-galaxy", "trail-poison",
    "slapfx-explosion", "slapfx-confetti", "slapfx-skull", "slapfx-heart",
    "outline-gold", "outline-rainbow", "outline-neon-pink", "outline-neon-green",
    "title-titan", "title-legend-plus", "title-patrician",
  ], isPack: true },
];

/** Look up an IAP product by its Yandex product ID. */
export function getIAPProduct(productId: string): IAPProduct | undefined {
  return IAP_PRODUCTS.find((p) => p.productId === productId);
}

/** Get all cosmetics IDs that are unlockable via IAP. */
export function getAllIAPCosmeticIds(): readonly string[] {
  const ids = new Set<string>();
  for (const product of IAP_PRODUCTS) {
    for (const cosmeticId of product.cosmetics) {
      ids.add(cosmeticId);
    }
  }
  return [...ids];
}
