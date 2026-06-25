import Phaser from "phaser";
import { loadProfile, saveProfile } from "../config/profile";
import { createBackground } from "../ui/Background";
import { createStyledButton } from "../ui/StyledButton";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import { IAPService } from "../services/IAPService";
import { IAP_PRODUCTS, type IAPProduct } from "../config/IAPManifest";
import { YandexSDK, type YandexProduct } from "../yandex/SDK";
import { getCosmeticById } from "../config/CosmeticsManifest";

type Tab = "items" | "packs";

/**
 * Shop scene — displays purchasable cosmetics and packs, handles
 * purchase flow via Yandex IAP, and restore purchases.
 *
 * Bug 5 fix: uses tab-based layout (Items / Packs) instead of a single
 * scrolling list that overflowed 1280×720.
 *
 * Bug 6 fix: buy buttons are non-interactive in dev mode.
 *
 * Bug 7 fix: loads real prices from Yandex catalog on create.
 */
export class ShopScene extends Phaser.Scene {
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private i18n: I18nService | null = null;
  private audio: ReturnType<typeof getAudioService> | null = null;
  private storage: Storage | null = null;
  private currentTab: Tab = "items";
  private yandexPrices: Map<string, string> = new Map();
  private tabTexts: { items: Phaser.GameObjects.Text | null; packs: Phaser.GameObjects.Text | null } = { items: null, packs: null };

  constructor() {
    super("ShopScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.storage = typeof window !== "undefined" ? window.localStorage : null;
    this.i18n = I18nService.load(this.storage);
    const settings = loadSettings(this.storage);
    this.audio = getAudioService(this, settings);
    this.audio?.playMenuTheme();

    const profile = loadProfile(this.storage);
    IAPService.setProfileForTest(profile, (p) => {
      if (this.storage) saveProfile(this.storage, p);
    });

    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.06, this.i18n?.t("shop.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "34px",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // --- Dev mode notice ---
    if (!YandexSDK.isAvailable()) {
      this.add
        .text(width / 2, height * 0.11, this.i18n?.t("shop.devMode"), {
          color: "#e07a5f",
          fontFamily: "Arial",
          fontSize: "14px",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5);
    }

    // --- Bug 7: Load Yandex catalog prices ---
    this.loadYandexPrices();

    // --- Tab buttons ---
    const tabY = height * 0.15;
    this.tabTexts.items = this.add
      .text(width / 2 - 80, tabY, this.i18n?.t("shop.individual"), {
        color: this.currentTab === "items" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "items" ? "bold" : "normal",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.packs = this.add
      .text(width / 2 + 80, tabY, this.i18n?.t("shop.packs"), {
        color: this.currentTab === "packs" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: this.currentTab === "packs" ? "bold" : "normal",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.items.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "items") {
        this.currentTab = "items";
        this.updateTabColors();
        this.refreshGrid();
      }
    });
    this.tabTexts.packs.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "packs") {
        this.currentTab = "packs";
        this.updateTabColors();
        this.refreshGrid();
      }
    });

    // --- Grid ---
    this.refreshGrid();

    // --- Restore + Back buttons ---
    const buttonY = height * 0.92;
    if (YandexSDK.isAvailable()) {
      createStyledButton(
        this as unknown as Parameters<typeof createStyledButton>[0],
        {
          x: width / 2 - 120,
          y: buttonY,
          text: this.i18n?.t("shop.restore"),
          variant: "secondary",
          width: 200,
          height: 40,
          fontSize: 14,
          onClick: () => this.restorePurchases(),
        },
      );
    }

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2 + 120,
        y: buttonY,
        text: this.i18n?.t("shop.back"),
        variant: "primary",
        width: 200,
        height: 40,
        fontSize: 14,
        onClick: () => {
          this.audio?.playMenuClick();
          this.scene.start("MainMenuScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      this.audio?.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  }

  private updateTabColors(): void {
    if (this.tabTexts.items) {
      this.tabTexts.items.setColor(this.currentTab === "items" ? "#f4d35e" : "#f4f1de");
      this.tabTexts.items.setFontStyle(this.currentTab === "items" ? "bold" : "normal");
    }
    if (this.tabTexts.packs) {
      this.tabTexts.packs.setColor(this.currentTab === "packs" ? "#f4d35e" : "#f4f1de");
      this.tabTexts.packs.setFontStyle(this.currentTab === "packs" ? "bold" : "normal");
    }
  }

  private refreshGrid(): void {
    for (const obj of this.gridObjects) obj.destroy();
    this.gridObjects = [];

    const products = this.currentTab === "items"
      ? IAP_PRODUCTS.filter((p) => !p.isPack)
      : IAP_PRODUCTS.filter((p) => p.isPack);

    this.renderGrid(products);
  }

  private renderGrid(products: readonly IAPProduct[]): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (!this.i18n) return;

    const cellW = 140;
    const cellH = 80;
    const gap = 12;
    const cols = 5;
    const gridStartY = height * 0.22;

    products.forEach((product, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const gridWidth = cols * (cellW + gap) - gap;
      const gridStartX = (width - gridWidth) / 2;
      const x = gridStartX + col * (cellW + gap);
      const y = gridStartY + row * (cellH + gap);

      const isPurchased = IAPService.isPurchased(product.productId);

      // Cell background
      const bg = this.add
        .rectangle(x, y, cellW, cellH, isPurchased ? 0x1a3a1a : 0x2a2d44, 1)
        .setOrigin(0)
        .setStrokeStyle(1, isPurchased ? 0x81b29a : 0x444444);
      this.gridObjects.push(bg);

      // Item name
      const firstCosmetic = product.cosmetics[0];
      const cosmeticDef = getCosmeticById(firstCosmetic);
      const itemName = cosmeticDef
        ? (this.i18n?.t(cosmeticDef.nameKey as never) ?? product.productId)
        : product.productId;
      this.add
        .text(x + cellW / 2, y + 16, itemName, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "12px",
          align: "center",
        })
        .setOrigin(0.5);
      this.gridObjects.push(this.add.text(0, 0, "", {})); // placeholder

      // Bug 7: use Yandex price if available, else default
      const price = this.yandexPrices.get(product.productId) ?? product.defaultPrice;

      if (isPurchased) {
        this.add
          .text(x + cellW / 2, y + 48, (this.i18n?.t("shop.purchased") ?? "Purchased"), {
            color: "#81b29a",
            fontFamily: "Arial",
            fontSize: "13px",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      } else {
        const buyText = `${this.i18n?.t("shop.buy")} ${price}`;
        const buyBtn = this.add
          .text(x + cellW / 2, y + 48, buyText, {
            color: "#f4d35e",
            fontFamily: "Arial",
            fontSize: "13px",
            fontStyle: "bold",
            backgroundColor: "#2a2d44",
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5);

        // Bug 6 fix: only make interactive if SDK is available
        if (YandexSDK.isAvailable()) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on("pointerup", () => {
            this.audio?.playMenuClick();
            this.handlePurchase(product);
          });
        } else {
          buyBtn.setColor("#555555");
        }
      }
    });
  }

  private async loadYandexPrices(): Promise<void> {
    if (!YandexSDK.isAvailable()) return;
    try {
      const catalog = await YandexSDK.iapGetCatalog();
      for (const product of catalog) {
        this.yandexPrices.set(product.id, product.price);
      }
      if (this.yandexPrices.size > 0) {
        this.refreshGrid();
      }
    } catch {
      // Keep default prices
    }
  }

  private async handlePurchase(product: IAPProduct): Promise<void> {
    try {
      await IAPService.purchase(product.productId, (id) =>
        YandexSDK.iapPurchase(id),
      );
      console.log(`[ShopScene] Purchase successful: ${product.productId}`);
      this.scene.restart();
    } catch (err) {
      console.warn(`[ShopScene] Purchase failed:`, err);
    }
  }

  private async restorePurchases(): Promise<void> {
    if (!this.audio || !this.storage) return;
    this.audio?.playMenuClick();
    try {
      const profile = loadProfile(this.storage);
      await IAPService.init(
        profile,
        (p) => { if (this.storage) saveProfile(this.storage, p); },
        () => YandexSDK.iapGetPurchases(),
      );
      console.log("[ShopScene] Purchases restored");
      this.scene.restart();
    } catch (err) {
      console.warn("[ShopScene] Restore failed:", err);
    }
  }
}
