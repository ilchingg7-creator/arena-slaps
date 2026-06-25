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
  // --- Individual headwear (19 ₽ each) ---
  { productId: "hw_wizard", titleKey: "shop.hw_wizard.title", descriptionKey: "shop.hw_wizard.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-wizard"], isPack: false },
  { productId: "hw_pirate", titleKey: "shop.hw_pirate.title", descriptionKey: "shop.hw_pirate.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-pirate"], isPack: false },
  { productId: "hw_space", titleKey: "shop.hw_space.title", descriptionKey: "shop.hw_space.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-space"], isPack: false },
  { productId: "hw_ninja", titleKey: "shop.hw_ninja.title", descriptionKey: "shop.hw_ninja.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-ninja"], isPack: false },
  { productId: "hw_viking", titleKey: "shop.hw_viking.title", descriptionKey: "shop.hw_viking.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-viking"], isPack: false },
  { productId: "hw_tophat", titleKey: "shop.hw_tophat.title", descriptionKey: "shop.hw_tophat.desc", defaultPrice: "19 ₽", cosmetics: ["headwear-tophat"], isPack: false },

  // --- Individual trails (19 ₽ each) ---
  { productId: "trail_fire", titleKey: "shop.trail_fire.title", descriptionKey: "shop.trail_fire.desc", defaultPrice: "19 ₽", cosmetics: ["trail-fire"], isPack: false },
  { productId: "trail_rainbow", titleKey: "shop.trail_rainbow.title", descriptionKey: "shop.trail_rainbow.desc", defaultPrice: "19 ₽", cosmetics: ["trail-rainbow"], isPack: false },
  { productId: "trail_galaxy", titleKey: "shop.trail_galaxy.title", descriptionKey: "shop.trail_galaxy.desc", defaultPrice: "19 ₽", cosmetics: ["trail-galaxy"], isPack: false },
  { productId: "trail_poison", titleKey: "shop.trail_poison.title", descriptionKey: "shop.trail_poison.desc", defaultPrice: "19 ₽", cosmetics: ["trail-poison"], isPack: false },

  // --- Individual slap FX (19 ₽ each) ---
  { productId: "slapfx_explosion", titleKey: "shop.slapfx_explosion.title", descriptionKey: "shop.slapfx_explosion.desc", defaultPrice: "19 ₽", cosmetics: ["slapfx-explosion"], isPack: false },
  { productId: "slapfx_confetti", titleKey: "shop.slapfx_confetti.title", descriptionKey: "shop.slapfx_confetti.desc", defaultPrice: "19 ₽", cosmetics: ["slapfx-confetti"], isPack: false },
  { productId: "slapfx_skull", titleKey: "shop.slapfx_skull.title", descriptionKey: "shop.slapfx_skull.desc", defaultPrice: "19 ₽", cosmetics: ["slapfx-skull"], isPack: false },
  { productId: "slapfx_heart", titleKey: "shop.slapfx_heart.title", descriptionKey: "shop.slapfx_heart.desc", defaultPrice: "19 ₽", cosmetics: ["slapfx-heart"], isPack: false },

  // --- Individual outlines (19 ₽ each) ---
  { productId: "outline_gold", titleKey: "shop.outline_gold.title", descriptionKey: "shop.outline_gold.desc", defaultPrice: "19 ₽", cosmetics: ["outline-gold"], isPack: false },
  { productId: "outline_rainbow", titleKey: "shop.outline_rainbow.title", descriptionKey: "shop.outline_rainbow.desc", defaultPrice: "19 ₽", cosmetics: ["outline-rainbow"], isPack: false },
  { productId: "outline_neon_pink", titleKey: "shop.outline_neon_pink.title", descriptionKey: "shop.outline_neon_pink.desc", defaultPrice: "19 ₽", cosmetics: ["outline-neon-pink"], isPack: false },
  { productId: "outline_neon_green", titleKey: "shop.outline_neon_green.title", descriptionKey: "shop.outline_neon_green.desc", defaultPrice: "19 ₽", cosmetics: ["outline-neon-green"], isPack: false },

  // --- Individual titles (19 ₽ each) ---
  { productId: "title_premium", titleKey: "shop.title_premium.title", descriptionKey: "shop.title_premium.desc", defaultPrice: "19 ₽", cosmetics: ["title-titan"], isPack: false },
  { productId: "title_legend_premium", titleKey: "shop.title_legend_premium.title", descriptionKey: "shop.title_legend_premium.desc", defaultPrice: "19 ₽", cosmetics: ["title-legend-plus"], isPack: false },
  { productId: "title_patron", titleKey: "shop.title_patron.title", descriptionKey: "shop.title_patron.desc", defaultPrice: "19 ₽", cosmetics: ["title-patrician"], isPack: false },

  // --- Packs (with discount) ---
  { productId: "pack_headwear", titleKey: "shop.pack_headwear.title", descriptionKey: "shop.pack_headwear.desc", defaultPrice: "49 ₽", cosmetics: ["headwear-wizard", "headwear-pirate", "headwear-space", "headwear-ninja", "headwear-viking", "headwear-tophat"], isPack: true },
  { productId: "pack_trails", titleKey: "shop.pack_trails.title", descriptionKey: "shop.pack_trails.desc", defaultPrice: "39 ₽", cosmetics: ["trail-fire", "trail-rainbow", "trail-galaxy", "trail-poison"], isPack: true },
  { productId: "pack_slapfx", titleKey: "shop.pack_slapfx.title", descriptionKey: "shop.pack_slapfx.desc", defaultPrice: "39 ₽", cosmetics: ["slapfx-explosion", "slapfx-confetti", "slapfx-skull", "slapfx-heart"], isPack: true },
  { productId: "pack_outlines", titleKey: "shop.pack_outlines.title", descriptionKey: "shop.pack_outlines.desc", defaultPrice: "39 ₽", cosmetics: ["outline-gold", "outline-rainbow", "outline-neon-pink", "outline-neon-green"], isPack: true },
  { productId: "pack_titles", titleKey: "shop.pack_titles.title", descriptionKey: "shop.pack_titles.desc", defaultPrice: "29 ₽", cosmetics: ["title-titan", "title-legend-plus", "title-patrician"], isPack: true },
  { productId: "bundle_all", titleKey: "shop.bundle_all.title", descriptionKey: "shop.bundle_all.desc", defaultPrice: "149 ₽", cosmetics: [
    "headwear-wizard", "headwear-pirate", "headwear-space", "headwear-ninja", "headwear-viking", "headwear-tophat",
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
