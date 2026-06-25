import { describe, expect, it, vi, beforeEach } from "vitest";

describe("YandexSDK — cloud save methods", () => {
  beforeEach(() => {
    vi.resetModules();
    if (typeof window !== "undefined") {
      delete (window as unknown as { __yaSdkLang?: string }).__yaSdkLang;
    }
  });

  it("getPlayer returns a player object when SDK is available", async () => {
    const mockPlayer = {
      getData: vi.fn().mockResolvedValue({ profile: '{"level":5}' }),
      setData: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPlayer: async () => mockPlayer,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const player = await YandexSDK.getPlayer();
    expect(player).toBeDefined();
  });

  it("playerGetData returns cloud data when available", async () => {
    const mockPlayer = {
      getData: vi.fn().mockResolvedValue({ profile: '{"level":5}', settings: '{"mode":"1p-vs-bot"}' }),
      setData: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPlayer: async () => mockPlayer,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const data = await YandexSDK.playerGetData(["profile", "settings"]);
    expect(data).toBeDefined();
    expect(data.profile).toBe('{"level":5}');
    expect(data.settings).toBe('{"mode":"1p-vs-bot"}');
  });

  it("playerSetData writes data to cloud", async () => {
    const mockPlayer = {
      getData: vi.fn().mockResolvedValue({}),
      setData: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPlayer: async () => mockPlayer,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    await YandexSDK.playerSetData({ profile: '{"level":10}' });
    expect(mockPlayer.setData).toHaveBeenCalledWith({ profile: '{"level":10}' }, false);
  });

  it("returns null from getPlayer in dev mode (no SDK)", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const player = await YandexSDK.getPlayer();
    expect(player).toBeNull();
  });

  it("playerGetData returns {} in dev mode (no SDK)", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const data = await YandexSDK.playerGetData();
    expect(data).toEqual({});
  });

  it("playerSetData is a no-op in dev mode (no SDK)", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    // Should not throw
    await YandexSDK.playerSetData({ profile: "test" });
  });
});
