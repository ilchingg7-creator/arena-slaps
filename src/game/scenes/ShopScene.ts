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
    this.audio.playMenuTheme();

    const profile = loadProfile(this.storage);
    IAPService.setProfileForTest(profile, (p) => {
      if (this.storage) saveProfile(this.storage, p);
    });

    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.05, this.i18n.t("shop.title"), {
        color: "#f4f1de", fontFamily: "Arial", fontSize: "32px",
        stroke: "#000000", strokeThickness: 5,
      })
      .setOrigin(0.5);

    // --- Dev mode notice ---
    if (!YandexSDK.isAvailable()) {
      this.add
        .text(width / 2, height * 0.10, this.i18n.t("shop.devMode"), {
          color: "#e07a5f", fontFamily: "Arial", fontSize: "13px",
          stroke: "#000000", strokeThickness: 2,
        })
        .setOrigin(0.5);
    }

    // --- Bug 1 fix: tabs higher, more gap before grid ---
    const tabY = height * 0.12;
    this.tabTexts.items = this.add
      .text(width / 2 - 100, tabY, this.i18n.t("shop.individual"), {
        color: this.currentTab === "items" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial", fontSize: "18px",
        fontStyle: this.currentTab === "items" ? "bold" : "normal",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.packs = this.add
      .text(width / 2 + 100, tabY, this.i18n.t("shop.packs"), {
        color: this.currentTab === "packs" ? "#f4d35e" : "#f4f1de",
        fontFamily: "Arial", fontSize: "18px",
        fontStyle: this.currentTab === "packs" ? "bold" : "normal",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.items.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "items") { this.currentTab = "items"; this.updateTabColors(); this.refreshGrid(); }
    });
    this.tabTexts.packs.on("pointerup", () => {
      this.audio?.playMenuClick();
      if (this.currentTab !== "packs") { this.currentTab = "packs"; this.updateTabColors(); this.refreshGrid(); }
    });

    // --- Bug 7: Load Yandex prices ---
    this.loadYandexPrices();

    this.refreshGrid();

    // --- Bottom buttons ---
    const buttonY = height * 0.93;
    if (YandexSDK.isAvailable()) {
      createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
        x: width / 2 - 120, y: buttonY,
        text: this.i18n.t("shop.restore"), variant: "secondary",
        width: 200, height: 40, fontSize: 14,
        onClick: () => this.restorePurchases(),
      });
    }
    createStyledButton(this as unknown as Parameters<typeof createStyledButton>[0], {
      x: width / 2 + 120, y: buttonY,
      text: this.i18n.t("shop.back"), variant: "primary",
      width: 200, height: 40, fontSize: 14,
      onClick: () => { this.audio?.playMenuClick(); this.scene.start("MainMenuScene"); },
    });

    this.input.keyboard?.on("keydown-ESC", () => { this.audio?.playMenuClick(); this.scene.start("MainMenuScene"); });
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

    // Bug 3+4 fix: only show items with isPack=false on items tab,
    // isPack=true on packs tab. Individual titles removed from manifest.
    const products = this.currentTab === "items"
      ? IAP_PRODUCTS.filter((p) => !p.isPack)
      : IAP_PRODUCTS.filter((p) => p.isPack);

    this.renderGrid(products);
  }

  private renderGrid(products: readonly IAPProduct[]): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const cellW = 130;
    const cellH = 110;
    const gap = 14;
    const cols = 5;
    const gridStartY = height * 0.20;
    const gridWidth = cols * (cellW + gap) - gap;
    const gridStartX = (width - gridWidth) / 2;

    products.forEach((product, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = gridStartX + col * (cellW + gap);
      const y = gridStartY + row * (cellH + gap);

      const isPurchased = IAPService.isPurchased(product.productId);
      const price = this.yandexPrices.get(product.productId) ?? product.defaultPrice;

      // Cell background
      const bg = this.add
        .rectangle(x, y, cellW, cellH, isPurchased ? 0x1a3a1a : 0x2a2d44, 1)
        .setOrigin(0)
        .setStrokeStyle(1, isPurchased ? 0x81b29a : 0x444444);
      this.gridObjects.push(bg);

      // Hover tooltip for packs — shows full contents on pointerover
      if (product.isPack) {
        bg.setInteractive({ useHandCursor: true });
        const tooltipLines = product.cosmetics.map((cid) => {
          const def = getCosmeticById(cid);
          return def ? (this.i18n?.t(def.nameKey as never) ?? cid) : cid;
        });
        let tooltip: Phaser.GameObjects.Container | null = null;

        bg.on("pointerover", () => {
          if (tooltip) return;
          tooltip = this.add.container(x + cellW / 2, y - 10);
          tooltip.setDepth(100);

          const lineSpacing = 16;
          const tooltipH = tooltipLines.length * lineSpacing + 16;
          const tooltipW = 200;

          const tooltipBg = this.add.rectangle(0, -tooltipH / 2, tooltipW, tooltipH, 0x101820, 0.95)
            .setStrokeStyle(2, 0xf4d35e, 1)
            .setOrigin(0.5);
          tooltip.add(tooltipBg);

          tooltipLines.forEach((line, i) => {
            const txt = this.add.text(
              -tooltipW / 2 + 10,
              -tooltipH + 8 + i * lineSpacing,
              `• ${line}`,
              { color: "#f4f1de", fontFamily: "Arial", fontSize: "12px" },
            );
            tooltip!.add(txt);
          });

          this.gridObjects.push(tooltip);
        });

        bg.on("pointerout", () => {
          if (tooltip) {
            const tip = tooltip;
            tooltip = null;
            tip.destroy();
            const idx = this.gridObjects.indexOf(tip);
            if (idx >= 0) this.gridObjects.splice(idx, 1);
          }
        });
      }

      // Bug 2: visual preview based on cosmetic type
      const firstCosmetic = product.cosmetics[0];
      const cosmeticDef = getCosmeticById(firstCosmetic);
      const previewY = y + 32;

      if (cosmeticDef) {
        if (cosmeticDef.category === "headwear" && !product.isPack) {
          const spriteKey = (cosmeticDef.effect as { spriteKey: string }).spriteKey;
          if (spriteKey && this.textures.exists(spriteKey)) {
            const img = this.add.image(x + cellW / 2, previewY, spriteKey)
              .setDisplaySize(40, 40).setOrigin(0.5);
            this.gridObjects.push(img);
          }
        } else if (cosmeticDef.category === "outline" && !product.isPack) {
          const colorVal = (cosmeticDef.effect as { value: number }).value;
          const rect = this.add.rectangle(x + cellW / 2, previewY, 36, 36, 0x222222)
            .setStrokeStyle(4, colorVal).setOrigin(0.5);
          this.gridObjects.push(rect);
        } else if (cosmeticDef.category === "trail" && !product.isPack) {
          const trailEff = cosmeticDef.effect as { textureKey: string; color: number };
          if (trailEff.textureKey && this.textures.exists(trailEff.textureKey)) {
            const img = this.add.image(x + cellW / 2, previewY, trailEff.textureKey)
              .setDisplaySize(32, 32).setTint(trailEff.color).setOrigin(0.5);
            this.gridObjects.push(img);
          }
        } else if (cosmeticDef.category === "slapFx" && !product.isPack) {
          const fxKey = (cosmeticDef.effect as { textureKey: string }).textureKey;
          if (fxKey && this.textures.exists(fxKey)) {
            const img = this.add.image(x + cellW / 2, previewY, fxKey)
              .setDisplaySize(40, 40).setOrigin(0.5);
            this.gridObjects.push(img);
          }
        } else if (product.isPack) {
          // Pack: show count badge
          const countText = this.add.text(x + cellW / 2, previewY, `${product.cosmetics.length} предметов`, {
            color: "#f4d35e", fontFamily: "Arial", fontSize: "12px",
          }).setOrigin(0.5);
          this.gridObjects.push(countText);
        }
      }

      // Item name
      const itemName = cosmeticDef
        ? (this.i18n?.t(cosmeticDef.nameKey as never) ?? product.productId)
        : product.productId;
      const nameText = this.add
        .text(x + cellW / 2, y + 64, itemName, {
          color: "#f4f1de", fontFamily: "Arial", fontSize: "11px",
          align: "center", wordWrap: { width: cellW - 8 },
        })
        .setOrigin(0.5);
      this.gridObjects.push(nameText);

      // Price or Purchased
      if (isPurchased) {
        const pText = this.add
          .text(x + cellW / 2, y + 92, (this.i18n?.t("shop.purchased") ?? "✓"), {
            color: "#81b29a", fontFamily: "Arial", fontSize: "13px", fontStyle: "bold",
          })
          .setOrigin(0.5);
        this.gridObjects.push(pText);
      } else {
        const buyText = `${this.i18n?.t("shop.buy") ?? "Buy"} ${price}`;
        const buyBtn = this.add
          .text(x + cellW / 2, y + 92, buyText, {
            color: "#f4d35e", fontFamily: "Arial", fontSize: "12px", fontStyle: "bold",
            backgroundColor: "#2a2d44", padding: { x: 6, y: 3 },
          })
          .setOrigin(0.5);

        if (YandexSDK.isAvailable()) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on("pointerup", () => {
            this.audio?.playMenuClick();
            this.handlePurchase(product);
          });
        } else {
          buyBtn.setColor("#555555");
        }
        this.gridObjects.push(buyBtn);
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
      if (this.yandexPrices.size > 0) this.refreshGrid();
    } catch { /* keep defaults */ }
  }

  private async handlePurchase(product: IAPProduct): Promise<void> {
    try {
      await IAPService.purchase(product.productId, (id) => YandexSDK.iapPurchase(id));
      this.scene.restart();
    } catch (err) {
      console.warn("[ShopScene] Purchase failed:", err);
    }
  }

  private async restorePurchases(): Promise<void> {
    if (!this.audio || !this.storage) return;
    this.audio.playMenuClick();
    try {
      const profile = loadProfile(this.storage);
      await IAPService.init(
        profile,
        (p) => { if (this.storage) saveProfile(this.storage, p); },
        () => YandexSDK.iapGetPurchases(),
      );
      this.scene.restart();
    } catch (err) {
      console.warn("[ShopScene] Restore failed:", err);
    }
  }
}
