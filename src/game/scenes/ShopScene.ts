import Phaser from "phaser";
import { loadProfile, saveProfile } from "../config/profile";
import { createBackground } from "../ui/Background";
import { createStyledButton } from "../ui/StyledButton";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import { IAPService } from "../services/IAPService";
import { IAP_PRODUCTS, type IAPProduct } from "../config/IAPManifest";
import { YandexSDK } from "../yandex/SDK";
import { getCosmeticById } from "../config/CosmeticsManifest";

/**
 * Shop scene — displays purchasable cosmetics and packs, handles
 * purchase flow via Yandex IAP, and restore purchases.
 *
 * Layout:
 *   - Title at top
 *   - "Individual Items" section (scrollable grid)
 *   - "Discount Packs" section
 *   - Restore + Back buttons at bottom
 *
 * In dev mode (no SDK), items show but purchase buttons are disabled
 * with a "local mode" notice.
 */
export class ShopScene extends Phaser.Scene {
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private i18n: I18nService | null = null;
  private audio: ReturnType<typeof getAudioService> | null = null;
  private storage: Storage | null = null;

  constructor() {
    super("ShopScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.storage = typeof window !== "undefined" ? window.localStorage : null;
    this.i18n = I18nService.load(this.storage!);
    const settings = loadSettings(this.storage!);
    this.audio = getAudioService(this, settings);
    this.audio?.playMenuTheme();

    const profile = loadProfile(this.storage!);
    IAPService.setProfileForTest(profile, (p) => {
      if (this.storage!) saveProfile(this.storage, p);
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
        .text(width / 2, height * 0.12, this.i18n?.t("shop.devMode"), {
          color: "#e07a5f",
          fontFamily: "Arial",
          fontSize: "14px",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5);
    }

    // --- Individual Items section ---
    const individuals = IAP_PRODUCTS.filter((p) => !p.isPack);
    this.renderSection(this.i18n?.t("shop.individual"), height * 0.16, individuals);

    // --- Packs section ---
    const packs = IAP_PRODUCTS.filter((p) => p.isPack);
    const packsStartY = height * 0.16 + Math.ceil(individuals.length / 4) * 80 + 40;
    this.renderSection(this.i18n?.t("shop.packs"), packsStartY, packs);

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

  private renderSection(
    title: string,
    startY: number,
    products: readonly IAPProduct[],
  ): void {
    const width = this.scale.width;
    if (!this.i18n) return;

    this.add
      .text(width / 2, startY, title, {
        color: "#f4d35e",
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const cellW = 140;
    const cellH = 70;
    const gap = 10;
    const cols = 4;
    const gridStartY = startY + 30;

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

      // Item name (first cosmetic in the product)
      const firstCosmetic = product.cosmetics[0];
      const cosmeticDef = getCosmeticById(firstCosmetic);
      const itemName = cosmeticDef
        ? (this.i18n?.t(cosmeticDef.nameKey as never) ?? product.productId)
        : product.productId;
      this.add
        .text(x + cellW / 2, y + 14, itemName, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "12px",
          align: "center",
        })
        .setOrigin(0.5);
      this.gridObjects.push(this.add.text(x + cellW / 2, y + 14, "", {}));

      // Price or "Purchased"
      if (isPurchased) {
        this.add
          .text(x + cellW / 2, y + 42, this.i18n?.t("shop.purchased") ?? "Purchased", {
            color: "#81b29a",
            fontFamily: "Arial",
            fontSize: "12px",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      } else {
        const priceText = product.defaultPrice;
        const buyBtn = this.add
          .text(x + cellW / 2, y + 42, `${this.i18n?.t("shop.buy")} ${priceText}`, {
            color: "#f4d35e",
            fontFamily: "Arial",
            fontSize: "12px",
            fontStyle: "bold",
            backgroundColor: "#2a2d44",
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });

        buyBtn.on("pointerup", () => {
          this.audio?.playMenuClick();
          this.handlePurchase(product);
        });
      }
    });
  }

  private async handlePurchase(product: IAPProduct): Promise<void> {
    if (!YandexSDK.isAvailable()) {
      console.log("[ShopScene] Dev mode — purchase not available");
      return;
    }

    try {
      await IAPService.purchase(product.productId, (id) =>
        YandexSDK.iapPurchase(id),
      );
      console.log(`[ShopScene] Purchase successful: ${product.productId}`);
      // Refresh the scene to show "Purchased" status
      this.scene.restart();
    } catch (err) {
      console.warn(`[ShopScene] Purchase failed:`, err);
      // Player cancelled or error — don't crash
    }
  }

  private async restorePurchases(): Promise<void> {
    if (!this.audio || !this.storage!) return;
    this.audio?.playMenuClick();

    try {
      const profile = loadProfile(this.storage!);
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
