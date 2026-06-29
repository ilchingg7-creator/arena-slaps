import Phaser from "phaser";
import { loadProfile, saveProfile } from "../config/profile";
import { createStyledButton } from "../ui/StyledButton";
import { drawNeonPanel } from "../ui/neonPrimitives";
import { NEON_COLORS, getHudTextStyle } from "../ui/neonTheme";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import { IAPService } from "../services/IAPService";
import { IAP_PRODUCTS, type IAPProduct } from "../config/IAPManifest";
import { YandexSDK, type YandexProduct } from "../yandex/SDK";
import { getCosmeticById } from "../config/CosmeticsManifest";

/** Per-category accent colors for shop item cards. Mirrors the
 * ProgressScene achievements-tab mapping for visual consistency. */
const SHOP_CATEGORY_COLORS: Record<string, number> = {
  headwear: NEON_COLORS.cyan,
  trail: NEON_COLORS.lime,
  slapFx: NEON_COLORS.magenta,
  outline: NEON_COLORS.cyan,
  title: NEON_COLORS.impact,
  pack: NEON_COLORS.magenta,
};

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

    // --- Background: solid ink color (replaces noisy menu-bg PNG so
    // item names and prices read). Persistent across tab switches. ---
    this.add
      .rectangle(width / 2, height / 2, width, height, NEON_COLORS.bgInk)
      .setDepth(-100);
    const outerFrame = this.add.graphics().setDepth(-99);
    outerFrame.lineStyle(2, NEON_COLORS.cyan, 0.18);
    outerFrame.strokeRect(24, 24, width - 48, height - 48);

    // --- Title (neon HUD style on a panel) ---
    const titleText = this.i18n.t("shop.title");
    const titleY = height * 0.05;
    const titlePanelW = 280;
    const titlePanelH = 52;
    const titlePanel = drawNeonPanel(
      this as unknown as Phaser.Scene,
      width / 2 - titlePanelW / 2,
      titleY - titlePanelH / 2,
      titlePanelW,
      titlePanelH,
    ) as unknown as Phaser.GameObjects.Graphics;
    titlePanel.setDepth(0);
    void titlePanel;
    this.add
      .text(width / 2, titleY, titleText, getHudTextStyle("title"))
      .setOrigin(0.5)
      .setDepth(1);

    // --- Dev mode notice ---
    if (!YandexSDK.isAvailable()) {
      this.add
        .text(width / 2, height * 0.10, this.i18n.t("shop.devMode"), {
          color: "#ff5a36", fontFamily: "Arial", fontSize: "13px",
          stroke: "#05070d", strokeThickness: 2,
        })
        .setOrigin(0.5);
    }

    // --- Bug 1 fix: tabs higher, more gap before grid (neon-styled) ---
    const tabY = height * 0.12;
    this.tabTexts.items = this.add
      .text(width / 2 - 100, tabY, this.i18n.t("shop.individual"), {
        color: this.currentTab === "items" ? "#20f6ff" : "#c4cfdd",
        fontFamily: "Arial", fontSize: "18px",
        fontStyle: this.currentTab === "items" ? "bold" : "normal",
        stroke: "#05070d", strokeThickness: 3,
        shadow: this.currentTab === "items"
          ? { offsetX: 0, offsetY: 0, color: "#20f6ff", blur: 10, fill: false }
          : undefined,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabTexts.packs = this.add
      .text(width / 2 + 100, tabY, this.i18n.t("shop.packs"), {
        color: this.currentTab === "packs" ? "#20f6ff" : "#c4cfdd",
        fontFamily: "Arial", fontSize: "18px",
        fontStyle: this.currentTab === "packs" ? "bold" : "normal",
        stroke: "#05070d", strokeThickness: 3,
        shadow: this.currentTab === "packs"
          ? { offsetX: 0, offsetY: 0, color: "#20f6ff", blur: 10, fill: false }
          : undefined,
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
      this.tabTexts.items.setColor(this.currentTab === "items" ? "#20f6ff" : "#c4cfdd");
      this.tabTexts.items.setFontStyle(this.currentTab === "items" ? "bold" : "normal");
      this.tabTexts.items.setShadow(
        this.currentTab === "items" ? 0 : 0,
        this.currentTab === "items" ? 0 : 0,
        "#20f6ff",
        this.currentTab === "items" ? 10 : 0,
        this.currentTab === "items" ? false : false,
      );
    }
    if (this.tabTexts.packs) {
      this.tabTexts.packs.setColor(this.currentTab === "packs" ? "#20f6ff" : "#c4cfdd");
      this.tabTexts.packs.setFontStyle(this.currentTab === "packs" ? "bold" : "normal");
      this.tabTexts.packs.setShadow(
        this.currentTab === "packs" ? 0 : 0,
        this.currentTab === "packs" ? 0 : 0,
        "#20f6ff",
        this.currentTab === "packs" ? 10 : 0,
        this.currentTab === "packs" ? false : false,
      );
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

    // 6 columns per row (was 5). Cell size shrunk from 140 to 115 so
    // the grid width stays roughly the same (~760px) and the grid
    // remains centered. Individual items (headwear/trail/slapFx/
    // outline) fit 6-per-row; packs tab has only 6 entries total so
    // they now all fit on a single row.
    const cellW = 115;
    const cellH = 140;
    const gap = 14;
    const cols = 6;
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

      // --- Neon card panel (replaces flat rectangle) ---
      const panel = drawNeonPanel(
        this as unknown as Phaser.Scene,
        x,
        y,
        cellW,
        cellH,
      ) as unknown as Phaser.GameObjects.Graphics;
      panel.setDepth(0);
      this.gridObjects.push(panel);

      // --- Category-tinted accent stroke ---
      const firstCosmeticForAccent = product.cosmetics[0];
      const cosmeticDefForAccent = getCosmeticById(firstCosmeticForAccent);
      const accentKey = product.isPack
        ? "pack"
        : (cosmeticDefForAccent?.category ?? "title");
      const accent = SHOP_CATEGORY_COLORS[accentKey] ?? NEON_COLORS.cyan;
      const accentStroke = this.add.graphics().setDepth(0);
      accentStroke.lineStyle(2, accent, isPurchased ? 0.9 : 0.55);
      accentStroke.strokeRoundedRect(x + 4, y + 4, cellW - 8, cellH - 8, 10);
      this.gridObjects.push(accentStroke);

      if (isPurchased) {
        panel.setAlpha(0.92);
      }

      // Hover tooltip for packs — shows full contents on pointerover.
      // Attach the interactive hit area to an invisible rectangle over
      // the card (drawNeonPanel returns a Graphics which doesn't accept
      // pointer events in our stub setup).
      const hitArea = this.add.rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0x000000, 0)
        .setOrigin(0.5)
        .setDepth(1);
      this.gridObjects.push(hitArea);

      if (product.isPack) {
        hitArea.setInteractive({ useHandCursor: true });
        const tooltipLines = product.cosmetics.map((cid) => {
          const def = getCosmeticById(cid);
          return def ? (this.i18n?.t(def.nameKey as never) ?? cid) : cid;
        });
        let tooltip: Phaser.GameObjects.Container | null = null;

        hitArea.on("pointerover", () => {
          if (tooltip) return;
          tooltip = this.add.container(x + cellW / 2, y - 10);
          tooltip.setDepth(100);

          const lineSpacing = 16;
          const tooltipH = tooltipLines.length * lineSpacing + 16;
          const tooltipW = 220;

          const tooltipBg = this.add.rectangle(0, -tooltipH / 2, tooltipW, tooltipH, NEON_COLORS.bgPanel, 0.96)
            .setStrokeStyle(2, NEON_COLORS.cyan, 1)
            .setOrigin(0.5);
          tooltip.add(tooltipBg);

          tooltipLines.forEach((line, i) => {
            const txt = this.add.text(
              -tooltipW / 2 + 10,
              -tooltipH + 8 + i * lineSpacing,
              `• ${line}`,
              { color: "#f6fbff", fontFamily: "Arial", fontSize: "12px",
                stroke: "#05070d", strokeThickness: 2 },
            );
            tooltip!.add(txt);
          });

          this.gridObjects.push(tooltip);
        });

        hitArea.on("pointerout", () => {
          if (tooltip) {
            const tip = tooltip;
            tooltip = null;
            tip.destroy();
            const idx = this.gridObjects.indexOf(tip);
            if (idx >= 0) this.gridObjects.splice(idx, 1);
          }
        });
      }

      // --- Visual preview based on cosmetic type ---
      const firstCosmetic = product.cosmetics[0];
      const cosmeticDef = getCosmeticById(firstCosmetic);
      const previewY = y + 40;

      if (cosmeticDef) {
        if (cosmeticDef.category === "headwear" && !product.isPack) {
          const spriteKey = (cosmeticDef.effect as { spriteKey: string }).spriteKey;
          if (spriteKey && this.textures.exists(spriteKey)) {
            const img = this.add.image(x + cellW / 2, previewY, spriteKey)
              .setDisplaySize(36, 36).setOrigin(0.5).setDepth(1);
            this.gridObjects.push(img);
          }
        } else if (cosmeticDef.category === "outline" && !product.isPack) {
          const colorVal = (cosmeticDef.effect as { value: number }).value;
          const rect = this.add.rectangle(x + cellW / 2, previewY, 32, 32, NEON_COLORS.bgPanelAlt)
            .setStrokeStyle(4, colorVal).setOrigin(0.5).setDepth(1);
          this.gridObjects.push(rect);
        } else if (cosmeticDef.category === "trail" && !product.isPack) {
          const trailEff = cosmeticDef.effect as { textureKey: string; color: number };
          if (trailEff.textureKey && this.textures.exists(trailEff.textureKey)) {
            const img = this.add.image(x + cellW / 2, previewY, trailEff.textureKey)
              .setDisplaySize(30, 30).setTint(trailEff.color).setOrigin(0.5).setDepth(1);
            this.gridObjects.push(img);
          }
        } else if (cosmeticDef.category === "slapFx" && !product.isPack) {
          const fxKey = (cosmeticDef.effect as { textureKey: string }).textureKey;
          if (fxKey && this.textures.exists(fxKey)) {
            const img = this.add.image(x + cellW / 2, previewY, fxKey)
              .setDisplaySize(36, 36).setOrigin(0.5).setDepth(1);
            this.gridObjects.push(img);
          }
        } else if (product.isPack) {
          // Pack: show count badge on a small neon chip.
          const chipW = 86;
          const chipH = 26;
          const chip = drawNeonPanel(
            this as unknown as Phaser.Scene,
            x + cellW / 2 - chipW / 2,
            previewY - chipH / 2,
            chipW,
            chipH,
          ) as unknown as Phaser.GameObjects.Graphics;
          chip.setDepth(1);
          this.gridObjects.push(chip);
          const countText = this.add.text(x + cellW / 2, previewY, `${product.cosmetics.length} предметов`, {
            color: "#ffffff", fontFamily: "Arial", fontSize: "11px", fontStyle: "bold",
            stroke: "#05070d", strokeThickness: 4,
            shadow: { offsetX: 0, offsetY: 0, color: "#ff4fd8", blur: 8, fill: false },
          }).setOrigin(0.5).setDepth(2);
          this.gridObjects.push(countText);
        }
      }

      // --- Item name ---
      const itemName = product.isPack
        ? (this.i18n?.t(product.titleKey as never) ?? product.productId)
        : (cosmeticDef
          ? (this.i18n?.t(cosmeticDef.nameKey as never) ?? product.productId)
          : product.productId);
      const nameText = this.add
        .text(x + cellW / 2, y + 78, itemName, {
          color: "#f6fbff", fontFamily: "Arial", fontSize: "12px", fontStyle: "bold",
          stroke: "#05070d", strokeThickness: 3,
          align: "center", wordWrap: { width: cellW - 12 },
        })
        .setOrigin(0.5)
        .setDepth(1);
      this.gridObjects.push(nameText);

      // --- Price or Purchased badge ---
      if (isPurchased) {
        const pText = this.add
          .text(x + cellW / 2, y + 112, (this.i18n?.t("shop.purchased") ?? "✓"), {
            color: "#b7ff3c", fontFamily: "Arial", fontSize: "11px", fontStyle: "bold",
            stroke: "#05070d", strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(1);
        this.gridObjects.push(pText);
      } else {
        const buyText = `${this.i18n?.t("shop.buy") ?? "Buy"} ${price}`;
        // Price button on a small neon chip.
        const btnW = 96;
        const btnH = 24;
        const btnX = x + cellW / 2 - btnW / 2;
        const btnY = y + 112 - btnH / 2;
        const btnPanel = drawNeonPanel(
          this as unknown as Phaser.Scene,
          btnX,
          btnY,
          btnW,
          btnH,
        ) as unknown as Phaser.GameObjects.Graphics;
        btnPanel.setDepth(1);
        this.gridObjects.push(btnPanel);

        const buyBtn = this.add
          .text(x + cellW / 2, y + 112, buyText, {
            color: "#ffffff", fontFamily: "Arial", fontSize: "11px", fontStyle: "bold",
            shadow: { offsetX: 0, offsetY: 0, color: "#20f6ff", blur: 8, fill: false },
          })
          .setOrigin(0.5)
          .setDepth(2);

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
