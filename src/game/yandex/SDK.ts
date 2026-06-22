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
  getPlayer?: (options?: { scopes?: boolean }) => Promise<unknown>;
  getFlags?: () => Promise<unknown>;
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

  /** Show a fullscreen interstitial ad. No-op if SDK unavailable. */
  showFullscreenAd(onClose?: () => void): void {
    if (!this.sdk?.adv?.showFullscreenAdv) {
      onClose?.();
      return;
    }
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
}

export const YandexSDK = new YandexSDKImpl();
