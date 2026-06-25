/**
 * IAPService — manages in-app purchases via Yandex SDK.
 *
 * Responsibilities:
 *   - init(): restore purchases from Yandex → profile.cosmetics.owned
 *   - purchase(): buy a product → add cosmetics to owned → saveProfile
 *   - isPurchased(): check if a product is already purchased
 *   - getCatalog(): get all products with purchased flag
 *
 * In dev mode (no SDK), init() is a no-op and purchase() throws.
 * The game still works — cosmetics are just not purchasable.
 */

import type { Profile } from "../config/profile";
import { IAP_PRODUCTS, getIAPProduct, type IAPProduct } from "../config/IAPManifest";

type PurchaseFn = (productId: string) => Promise<{ productID: string; purchaseToken: string }>;
type GetPurchasesFn = () => Promise<{ productID: string; purchaseToken: string }[]>;
type SaveProfileFn = (profile: Profile) => void;

export type IAPCatalogEntry = IAPProduct & {
  purchased: boolean;
};

let profile: Profile | null = null;
let saveProfileFn: SaveProfileFn | null = null;

export const IAPService = {
  /**
   * Initialize: restore purchases from Yandex. For each purchased product,
   * add its cosmetics to profile.cosmetics.owned (deduped).
   */
  async init(
    p: Profile,
    saveProfile: SaveProfileFn,
    getPurchases: GetPurchasesFn,
  ): Promise<void> {
    profile = p;
    saveProfileFn = saveProfile;

    try {
      const purchases = await getPurchases();
      let changed = false;

      for (const purchase of purchases) {
        const product = getIAPProduct(purchase.productID);
        if (!product) {
          console.warn(`[IAPService] Unknown product: ${purchase.productID}`);
          continue;
        }
        for (const cosmeticId of product.cosmetics) {
          if (!profile.cosmetics.owned.includes(cosmeticId)) {
            profile.cosmetics.owned.push(cosmeticId);
            changed = true;
          }
        }
      }

      if (changed) {
        saveProfileFn(profile);
        console.log("[IAPService] Restored purchases — profile updated");
      }
    } catch (err) {
      console.warn("[IAPService] Init failed:", err);
    }
  },

  /**
   * Purchase a product. Calls the Yandex purchase function, then adds
   * the product's cosmetics to profile.cosmetics.owned and saves.
   * Throws if the purchase fails (player cancelled, network error, etc.).
   */
  async purchase(productId: string, purchaseFn: PurchaseFn): Promise<void> {
    const product = getIAPProduct(productId);
    if (!product) {
      throw new Error(`[IAPService] Unknown product: ${productId}`);
    }

    const result = await purchaseFn(productId);
    console.log(`[IAPService] Purchase successful: ${result.productID}`);

    if (!profile) {
      throw new Error("[IAPService] Not initialized — call init() first");
    }

    for (const cosmeticId of product.cosmetics) {
      if (!profile.cosmetics.owned.includes(cosmeticId)) {
        profile.cosmetics.owned.push(cosmeticId);
      }
    }

    saveProfileFn?.(profile);
  },

  /** Whether a product has been purchased (all its cosmetics are in owned). */
  isPurchased(productId: string): boolean {
    if (!profile) return false;
    const product = getIAPProduct(productId);
    if (!product) return false;
    return product.cosmetics.every((id) => profile!.cosmetics.owned.includes(id));
  },

  /** Get all products with a `purchased` flag. */
  getCatalog(): IAPCatalogEntry[] {
    return IAP_PRODUCTS.map((p) => ({
      ...p,
      purchased: this.isPurchased(p.productId),
    }));
  },

  /** Test helpers — not for production use. */
  setProfileForTest(p: Profile, save?: SaveProfileFn): void {
    profile = p;
    saveProfileFn = save ?? (() => {});
  },

  reset(): void {
    profile = null;
    saveProfileFn = null;
  },
};
