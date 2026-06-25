import { describe, expect, it, vi, beforeEach } from "vitest";

describe("YandexSDK — IAP methods", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getPayments returns payments object when SDK is available", async () => {
    const mockPayments = {
      getCatalog: vi.fn().mockResolvedValue([{ id: "hw_wizard", title: "Wizard", price: "19 ₽" }]),
      purchase: vi.fn().mockResolvedValue({ productID: "hw_wizard", purchaseToken: "tok_123" }),
      getPurchases: vi.fn().mockResolvedValue([]),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPayments: async () => mockPayments,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const payments = await YandexSDK.getPayments();
    expect(payments).toBeDefined();
  });

  it("iapGetCatalog returns product list from Yandex", async () => {
    const mockPayments = {
      getCatalog: vi.fn().mockResolvedValue([
        { id: "hw_wizard", title: "Wizard Hat", price: "19 ₽", priceValue: 19, currency: "RUB" },
      ]),
      purchase: vi.fn(),
      getPurchases: vi.fn().mockResolvedValue([]),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPayments: async () => mockPayments,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const catalog = await YandexSDK.iapGetCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe("hw_wizard");
    expect(catalog[0].price).toBe("19 ₽");
  });

  it("iapPurchase calls payments.purchase and returns the result", async () => {
    const mockPayments = {
      getCatalog: vi.fn().mockResolvedValue([]),
      purchase: vi.fn().mockResolvedValue({ productID: "hw_wizard", purchaseToken: "tok_123" }),
      getPurchases: vi.fn().mockResolvedValue([]),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPayments: async () => mockPayments,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const result = await YandexSDK.iapPurchase("hw_wizard");
    expect(result.productID).toBe("hw_wizard");
    expect(result.purchaseToken).toBe("tok_123");
    expect(mockPayments.purchase).toHaveBeenCalledWith({ id: "hw_wizard" });
  });

  it("iapGetPurchases returns existing purchases", async () => {
    const mockPayments = {
      getCatalog: vi.fn().mockResolvedValue([]),
      purchase: vi.fn(),
      getPurchases: vi.fn().mockResolvedValue([
        { productID: "hw_wizard", purchaseToken: "tok_1" },
        { productID: "pack_trails", purchaseToken: "tok_2" },
      ]),
    };
    vi.stubGlobal("window", {
      YaGames: {
        init: async () => ({
          environment: { i18n: { lang: "ru" } },
          features: { LoadingAPI: { ready: () => void 0 } },
          getPayments: async () => mockPayments,
        }),
      },
    });

    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const purchases = await YandexSDK.iapGetPurchases();
    expect(purchases).toHaveLength(2);
    expect(purchases[0].productID).toBe("hw_wizard");
  });

  it("getPayments returns null in dev mode (no SDK)", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const payments = await YandexSDK.getPayments();
    expect(payments).toBeNull();
  });

  it("iapGetCatalog returns [] in dev mode", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const catalog = await YandexSDK.iapGetCatalog();
    expect(catalog).toEqual([]);
  });

  it("iapPurchase throws in dev mode", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    await expect(YandexSDK.iapPurchase("hw_wizard")).rejects.toThrow();
  });

  it("iapGetPurchases returns [] in dev mode", async () => {
    vi.stubGlobal("window", {});
    const { YandexSDK } = await import("./SDK");
    await YandexSDK.init();
    const purchases = await YandexSDK.iapGetPurchases();
    expect(purchases).toEqual([]);
  });
});
