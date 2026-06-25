/**
 * Yandex Games SDK wrapper with graceful fallback for local development.
 *
 * When running on the Yandex Games platform, `/sdk.js` is loaded in
 * index.html and `YaGames.init()` returns a promise with the SDK instance.
 * When running locally (no sdk.js), the SDK is unavailable and all
 * methods return safe defaults — the game works without SDK features.
 *
 * Usage:
 *   const sdk = await YandexSDK.init();
 *   sdk.ready();         // signal LoadingAPI.ready()
 *   const lang = sdk.getLanguage();  // "ru" | "en" | null
 *   sdk.showFullscreenAd();  // interstitial
 *   sdk.showRewardedAd(() => { ... });  // rewarded
 */

export type YandexLanguage = "ru" | "en" | "tr" | "kk" | "uk" | "be" | "uz" | "en-en";

type YandexSDKLike = {
  features?: {
    LoadingAPI?: {
      ready?: () => void;
    };
  };
  environment?: {
    i18n?: {
      lang?: YandexLanguage;
    };
  };
  adv?: {
    showFullscreenAdv?: (config?: {
      callbacks?: {
        onClose?: (wasShown: boolean) => void;
        onError?: (error: unknown) => void;
      };
    }) => void;
    showRewardedVideo?: (config?: {
      callbacks?: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: () => void;
        onError?: (error: unknown) => void;
      };
    }) => void;
  };
  getPlayer?: (options?: { scopes?: boolean }) => Promise<YandexPlayerLike>;
  getPayments?: (options?: { signed?: boolean }) => Promise<YandexPaymentsLike>;
  getFlags?: () => Promise<unknown>;
};

export type YandexPlayerLike = {
  getData?: (keys?: readonly string[]) => Promise<Record<string, unknown>>;
  setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
};

export type YandexProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: number;
  currency: string;
  imageURL?: string;
};

export type YandexPurchase = {
  productID: string;
  purchaseToken: string;
};

type YandexPaymentsLike = {
  getCatalog?: () => Promise<YandexProduct[]>;
  purchase?: (config: { id: string }) => Promise<YandexPurchase>;
  getPurchases?: () => Promise<YandexPurchase[]>;
};

class YandexSDKImpl {
  private sdk: YandexSDKLike | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Check if YaGames is available (loaded via /sdk.js in index.html)
    if (typeof window === "undefined" || typeof (window as unknown as { YaGames?: unknown }).YaGames === "undefined") {
      console.log("[YandexSDK] SDK not available (local dev mode)");
      this.initialized = true;
      return;
    }

    try {
      const YaGames = (window as unknown as {
        YaGames: {
          init: () => Promise<YandexSDKLike>;
        };
      }).YaGames;
      this.sdk = await YaGames.init();
      console.log("[YandexSDK] Initialized successfully");

      // Bug 5 fix: write the detected language to window.__yaSdkLang so
      // I18nService.detectLanguage() can pick it up. Without this, the
      // game always fell back to navigator.language, ignoring the Yandex
      // platform's language setting (e.g. a player with an English
      // browser but a Russian Yandex account would see EN instead of RU).
      const lang = this.getLanguage();
      if (lang === "ru" || lang === "en") {
        (window as unknown as { __yaSdkLang?: string }).__yaSdkLang = lang;
        console.log(`[YandexSDK] Language detected: ${lang}`);
      }
    } catch (err) {
      console.warn("[YandexSDK] Failed to initialize:", err);
    }
    this.initialized = true;
  }

  /** Call LoadingAPI.ready() to signal the game is playable. */
  ready(): void {
    this.sdk?.features?.LoadingAPI?.ready?.();
  }

  /** Get the player's language from the SDK, or null if unavailable. */
  getLanguage(): string | null {
    const lang = this.sdk?.environment?.i18n?.lang;
    if (!lang) return null;
    // Map Yandex language codes to our supported languages
    if (lang === "ru" || lang === "be" || lang === "uk" || lang === "kk" || lang === "uz") {
      return "ru";
    }
    return "en";
  }

  /** Check if the SDK is available (not local dev mode). */
  isAvailable(): boolean {
    return this.sdk !== null;
  }

  /** Timestamp of the last shown interstitial ad (for frequency capping). */
  private lastInterstitialAt = 0;
  /** Minimum gap between interstitial ads (Rule 4.4: ads at logical pauses). */
  private static readonly INTERSTITIAL_COOLDOWN_MS = 120_000; // 2 minutes

  /**
   * Show a fullscreen interstitial ad. Frequency-capped to 1 per 2 min.
   * No-op if SDK unavailable (calls onClose immediately in dev mode).
   */
  showFullscreenAd(onClose?: () => void): void {
    if (!this.sdk?.adv?.showFullscreenAdv) {
      // Dev mode — no ad, transition immediately
      onClose?.();
      return;
    }

    // Frequency cap: skip if last ad was < 2 min ago
    const now = Date.now();
    if (now - this.lastInterstitialAt < YandexSDKImpl.INTERSTITIAL_COOLDOWN_MS) {
      console.log("[YandexSDK] Interstitial skipped (cooldown)");
      onClose?.();
      return;
    }

    this.lastInterstitialAt = now;
    this.sdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: () => onClose?.(),
        onError: () => onClose?.(),
      },
    });
  }

  /** Show a rewarded video ad. No-op if SDK unavailable. */
  showRewardedAd(onRewarded: () => void, onClose?: () => void): void {
    if (!this.sdk?.adv?.showRewardedVideo) {
      // In dev mode, grant the reward immediately for testing
      onRewarded();
      onClose?.();
      return;
    }
    let rewarded = false;
    this.sdk.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => {
          rewarded = true;
          onRewarded();
        },
        onClose: () => {
          if (!rewarded) onClose?.();
        },
        onError: () => {
          if (!rewarded) onClose?.();
        },
      },
    });
  }

  private player: YandexPlayerLike | null = null;

  /**
   * Get the Yandex Player object (for cloud save). Returns null in dev
   * mode or if the player is not authorized. The player object exposes
   * getData / setData for cloud saves.
   */
  async getPlayer(): Promise<YandexPlayerLike | null> {
    if (!this.sdk?.getPlayer) return null;
    if (this.player) return this.player;
    try {
      this.player = await this.sdk.getPlayer({ scopes: true });
      return this.player;
    } catch (err) {
      console.warn("[YandexSDK] Failed to get player:", err);
      return null;
    }
  }

  /**
   * Read cloud data from the player. Returns {} in dev mode or on error.
   * @param keys Optional array of keys to fetch (fetches all if omitted).
   */
  async playerGetData(keys?: readonly string[]): Promise<Record<string, unknown>> {
    const p = await this.getPlayer();
    if (!p?.getData) return {};
    try {
      return await p.getData(keys);
    } catch (err) {
      console.warn("[YandexSDK] Failed to read cloud data:", err);
      return {};
    }
  }

  /**
   * Write cloud data to the player. No-op in dev mode or on error.
   * @param data Key-value map to store in the cloud.
   */
  async playerSetData(data: Record<string, unknown>): Promise<void> {
    const p = await this.getPlayer();
    if (!p?.setData) return;
    try {
      await p.setData(data);
    } catch (err) {
      console.warn("[YandexSDK] Failed to write cloud data:", err);
    }
  }

  // ─── In-App Purchases ──────────────────────────────────────────

  private payments: YandexPaymentsLike | null = null;

  /**
   * Get the Yandex Payments object. Returns null in dev mode or if
   * payments are not available.
   */
  async getPayments(): Promise<YandexPaymentsLike | null> {
    if (!this.sdk?.getPayments) return null;
    if (this.payments) return this.payments;
    try {
      this.payments = await this.sdk.getPayments({ signed: true });
      return this.payments;
    } catch (err) {
      console.warn("[YandexSDK] Failed to get payments:", err);
      return null;
    }
  }

  /**
   * Get the product catalog from Yandex. Returns [] in dev mode or on error.
   */
  async iapGetCatalog(): Promise<YandexProduct[]> {
    const p = await this.getPayments();
    if (!p?.getCatalog) return [];
    try {
      return await p.getCatalog();
    } catch (err) {
      console.warn("[YandexSDK] Failed to get catalog:", err);
      return [];
    }
  }

  /**
   * Purchase a product by its Yandex product ID. Throws in dev mode
   * or if the purchase fails (player cancels, network error, etc.).
   */
  async iapPurchase(productId: string): Promise<YandexPurchase> {
    const p = await this.getPayments();
    if (!p?.purchase) {
      throw new Error("[YandexSDK] Payments not available (dev mode)");
    }
    return await p.purchase({ id: productId });
  }

  /**
   * Get all previously purchased products (for restore). Returns [] in
   * dev mode or on error.
   */
  async iapGetPurchases(): Promise<YandexPurchase[]> {
    const p = await this.getPayments();
    if (!p?.getPurchases) return [];
    try {
      return await p.getPurchases();
    } catch (err) {
      console.warn("[YandexSDK] Failed to get purchases:", err);
      return [];
    }
  }
}

export const YandexSDK = new YandexSDKImpl();
