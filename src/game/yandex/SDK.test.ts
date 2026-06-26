import { describe, expect, it, vi, beforeEach } from "vitest";

describe("YandexSDK — Bug 5: language wiring", () => {
  beforeEach(() => {
    // Reset the module's internal state between tests by re-importing.
    vi.resetModules();
    // Clean up any window.__yaSdkLang left by previous tests.
    if (typeof window !== "undefined") {
      delete (window as unknown as { __yaSdkLang?: string }).__yaSdkLang;
      // Speed up the waitForYaGames poll in tests (default is 5000ms;
      // in tests where the SDK is intentionally absent we don't want
      // to burn 5s waiting for it).
      (window as unknown as { __yaSdkWaitMs?: number }).__yaSdkWaitMs = 50;
    }
  });

  it("writes the detected language to window.__yaSdkLang after init() on the Yandex platform", async () => {
    // Bug 5: I18nService.detectLanguage() reads window.__yaSdkLang, but
    // YandexSDK.init() never wrote it. This meant the Yandex platform's
    // language was ignored — the game always fell back to
    // navigator.language. On prod, a player with an English browser but
    // a Russian Yandex account would see EN instead of RU.
    //
    // Fix: after YaGames.init() resolves, YandexSDK.init() should call
    // getLanguage() and write the result to window.__yaSdkLang so
    // I18nService can pick it up.
    const win: Record<string, unknown> = {
      YaGames: {
        init: async () => ({
          environment: {
            i18n: { lang: "ru" },
          },
          features: { LoadingAPI: { ready: () => void 0 } },
        }),
      },
    };
    vi.stubGlobal("window", win);

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();

    expect(win.__yaSdkLang).toBe("ru");
  });

  it("maps non-Russian Yandex languages to 'en'", async () => {
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: {
            i18n: { lang: "en" },
          },
          features: { LoadingAPI: { ready: () => void 0 } },
        }),
      },
    });
    // Allow __yaSdkLang to be set:
    Object.defineProperty(window, "__yaSdkLang", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();

    expect((window as unknown as { __yaSdkLang?: string }).__yaSdkLang).toBe("en");
  });

  it("maps Cyrillic Yandex languages (be/uk/kk/uz) to 'ru'", async () => {
    for (const lang of ["be", "uk", "kk", "uz"]) {
      vi.resetModules();
      vi.stubGlobal("window", {
        YaGames: {
          init: async () => ({
            environment: {
              i18n: { lang },
            },
            features: { LoadingAPI: { ready: () => void 0 } },
          }),
        },
      });
      Object.defineProperty(window, "__yaSdkLang", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { YandexSDK } = await import("./SDK");
      await YandexSDK.init();

      expect((window as unknown as { __yaSdkLang?: string }).__yaSdkLang).toBe("ru");
    }
  });

  it("does NOT write __yaSdkLang in local dev mode (no YaGames global)", async () => {
    // In local dev, there's no /sdk.js → window.YaGames is undefined.
    // YandexSDK.init() should skip the language write so I18nService
    // falls back to navigator.language.
    //
    // beforeEach() sets window.__yaSdkWaitMs=50 so the SDK only polls
    // for 50ms before falling back to dev mode — keeps the test fast.
    vi.stubGlobal("window", { __yaSdkWaitMs: 50 });
    Object.defineProperty(window, "__yaSdkLang", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();

    expect((window as unknown as { __yaSdkLang?: string }).__yaSdkLang).toBeUndefined();
  });

  it("does NOT crash if the SDK has no environment.i18n.lang", async () => {
    // Defensive: if YaGames.init() returns an SDK without the language
    // field, init() should not throw and should not write __yaSdkLang.
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          // No environment.i18n
          features: { LoadingAPI: { ready: () => void 0 } },
        }),
      },
    });
    Object.defineProperty(window, "__yaSdkLang", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { YandexSDK } = await import("./SDK");
    await expect(YandexSDK.init()).resolves.toBeUndefined();
    expect((window as unknown as { __yaSdkLang?: string }).__yaSdkLang).toBeUndefined();
  });
});
