import Phaser from "phaser";
import { loadProfile, saveProfile, type Profile, type EquippedCosmetics } from "../config/profile";
import { createBackground } from "../ui/Background";
import { createStyledButton } from "../ui/StyledButton";
import { I18nService } from "../i18n/I18nService";
import { getAudioService } from "../audio/getAudioService";
import { loadSettings } from "../config/gameSettings";
import {
  COSMETICS,
  getCosmeticsByCategory,
  isCosmeticAvailable,
  type CosmeticCategory,
  type CosmeticDefinition,
} from "../config/CosmeticsManifest";
import { equipCosmetic } from "../cosmetics/CosmeticsPickerState";
import type { GameMode } from "../config/gameSettings";

/**
 * Cosmetics scene — full-screen overlay where the player picks
 * cosmetics for P1 (always) and P2 (only in 2P-local mode).
 *
 * Bug 4 fix: previously every tab/target/equip click called
 * `scene.restart()`, which destroyed + recreated ALL game objects
 * (title, tabs, toggle, grid, back button) on every click. This caused
 * visible UI hangs. Fix: persistent UI elements (title, toggle, tabs,
 * back button) are created ONCE in create(); only the grid cells are
 * destroyed + re-rendered via `refreshGrid()`.
 *
 * Bug 5 fix: added a live preview at the top showing the currently
 * equipped color + headwear so the player can see what they're picking.
 *
 * Bug 6 fix: the name label position in BattleScene was adjusted so
 * the title text doesn't overlap the sprite.
 */
export class CosmeticsScene extends Phaser.Scene {
  private selectedCategory: CosmeticCategory = "outline";
  private target: "p1" | "p2" = "p1";
  private is2P = false;
  private profile: Profile | null = null;
  private gridObjects: Phaser.GameObjects.GameObject[] = [];
  private p1Button: Phaser.GameObjects.Text | null = null;
  private p2Button: Phaser.GameObjects.Text | null = null;
  private tabTexts: Map<CosmeticCategory, Phaser.GameObjects.Text> = new Map();
  private previewObjects: Phaser.GameObjects.GameObject[] = [];
  private i18n: I18nService | null = null;
  private audio: ReturnType<typeof getAudioService> | null = null;
  private storage: Storage | null = null;
  /**
   * Issue 3 fix: re-entrancy guard for refreshGrid(). When the player
   * clicks rapidly, multiple pointerup events can fire before the
   * previous refreshGrid() finishes destroying + re-creating objects.
   * This causes Phaser to leak objects and stutter. The guard skips
   * re-entry while a refresh is in progress.
   */
  private refreshInProgress = false;

  constructor() {
    super("CosmeticsScene");
  }

  init(
    data:
      | {
          mode?: GameMode;
          target?: "p1" | "p2";
          selectedCategory?: CosmeticCategory;
        }
      | undefined,
  ): void {
    this.is2P = data?.mode === "2p-local";
    this.target = data?.target ?? "p1";
    this.selectedCategory = data?.selectedCategory ?? "outline";
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.storage = typeof window !== "undefined" ? window.localStorage : null;
    this.i18n = I18nService.load(this.storage);
    const settings = loadSettings(this.storage);
    this.audio = getAudioService(this, settings);
    this.audio.playMenuTheme();

    this.profile = loadProfile(this.storage);
    // Restore P2's transient cosmetics from registry.
    const p2FromRegistry = this.registry.get("p2CosmeticsEquipped") as
      | EquippedCosmetics
      | undefined;
    if (p2FromRegistry) {
      this.profile = {
        ...this.profile,
        cosmetics: {
          ...this.profile.cosmetics,
          p2Equipped: p2FromRegistry,
        },
      };
    }

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.06, this.i18n.t("cosmetics.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "34px",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // --- Target toggle (P1 / P2) — only in 2P mode ---
    if (this.is2P) {
      const toggleY = height * 0.12;
      this.p1Button = this.add
        .text(width / 2 - 80, toggleY, this.i18n.t("cosmetics.player1"), {
          color: this.target === "p1" ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.p2Button = this.add
        .text(width / 2 + 80, toggleY, this.i18n.t("cosmetics.player2"), {
          color: this.target === "p2" ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.p1Button.on("pointerup", () => {
        this.audio?.playMenuClick();
        if (this.target === "p1") return;
        this.target = "p1";
        this.updateToggleColors();
        this.refreshGrid();
      });
      this.p2Button.on("pointerup", () => {
        this.audio?.playMenuClick();
        if (this.target === "p2") return;
        this.target = "p2";
        this.updateToggleColors();
        this.refreshGrid();
      });
    }

    // --- Preview (live preview of equipped cosmetics) ---
    this.renderPreview();

    // --- Category tabs ---
    const categories: CosmeticCategory[] = [
      "outline",
      "trail",
      "slapFx",
      "title",
      "headwear",
    ];
    const tabY = height * 0.22;
    const tabStep = width / (categories.length + 1);
    const i18n = this.i18n!;
    categories.forEach((cat, index) => {
      const tabX = tabStep * (index + 1);
      const isActive = cat === this.selectedCategory;
      const tab = this.add
        .text(tabX, tabY, i18n.t(`cosmetics.category.${cat}` as never), {
          color: isActive ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "15px",
          fontStyle: isActive ? "bold" : "normal",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      tab.on("pointerup", () => {
        this.audio?.playMenuClick();
        if (this.selectedCategory === cat) return;
        this.selectedCategory = cat;
        this.updateTabColors();
        this.refreshGrid();
      });
      this.tabTexts.set(cat, tab);
    });

    // --- Grid (initial render) ---
    this.refreshGrid();

    // --- Back button ---
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.93,
        text: this.i18n.t("battlesetup.back"),
        variant: "primary",
        onClick: () => {
          this.audio?.playMenuClick();
          this.scene.start("BattleSetupScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      this.audio?.playMenuClick();
      this.scene.start("BattleSetupScene");
    });
  }

  /** Update P1/P2 toggle colors without restarting the scene. */
  private updateToggleColors(): void {
    if (this.p1Button) {
      this.p1Button.setColor(this.target === "p1" ? "#f4d35e" : "#f4f1de");
    }
    if (this.p2Button) {
      this.p2Button.setColor(this.target === "p2" ? "#f4d35e" : "#f4f1de");
    }
  }

  /** Update category tab colors without restarting the scene. */
  private updateTabColors(): void {
    for (const [cat, tab] of this.tabTexts) {
      const isActive = cat === this.selectedCategory;
      tab.setColor(isActive ? "#f4d35e" : "#f4f1de");
      tab.setFontStyle(isActive ? "bold" : "normal");
    }
  }

  /** Destroy old grid cells + render new ones. Does NOT restart the scene. */
  private refreshGrid(): void {
    // Issue 3 fix: re-entrancy guard. If a refresh is already in
    // progress, skip this call — the in-progress refresh will pick up
    // the latest state when it finishes.
    if (this.refreshInProgress) return;
    this.refreshInProgress = true;
    try {
      // Destroy old grid cells.
      for (const obj of this.gridObjects) {
        obj.destroy();
      }
      this.gridObjects = [];
      this.renderGrid();
      // Also refresh the preview to reflect any equip changes.
      this.renderPreview();
    } finally {
      this.refreshInProgress = false;
    }
  }

  /** Render the grid of cosmetic cells for the selected category. */
  private renderGrid(): void {
    if (!this.profile || !this.i18n || !this.audio) return;
    const width = this.scale.width;
    const height = this.scale.height;
    const cells = getCosmeticsByCategory(this.selectedCategory);

    const cellSize = 56;
    const cellGap = 12;
    const cellsPerRow = 6;
    const gridStartY = height * 0.34;

    cells.forEach((def, index) => {
      const row = Math.floor(index / cellsPerRow);
      const col = index % cellsPerRow;
      const gridWidth = cellsPerRow * (cellSize + cellGap) - cellGap;
      const gridStartX = (width - gridWidth) / 2 + cellSize / 2;
      const x = gridStartX + col * (cellSize + cellGap);
      const y = gridStartY + row * (cellSize + cellGap);

      const equippedSlot =
        this.target === "p1"
          ? this.profile!.cosmetics.equipped
          : this.profile!.cosmetics.p2Equipped;
      const isEquipped = equippedSlot[this.selectedCategory] === def.id;
      const isAvailable = isCosmeticAvailable(
        this.profile!,
        def.id,
        this.is2P,
      );

      const bgColor = isEquipped
        ? 0xf4d35e
        : isAvailable
          ? 0x2a2d44
          : 0x3a3a44;
      const cell = this.add
        .rectangle(x, y, cellSize, cellSize, bgColor, 1)
        .setOrigin(0.5)
        .setStrokeStyle(
          isEquipped ? 3 : 1,
          isEquipped ? 0xf4d35e : 0x444444,
        );
      this.gridObjects.push(cell);

      // Preview content — always visible (even when locked), but dimmed
      // for locked items so the player can see what they'd get.
      const previewAlpha = isAvailable ? 1.0 : 0.4;
      const previewY = y - 4; // shift preview up to leave room for name

      if (this.selectedCategory === "outline") {
        const outlineVal = (def.effect as { value: number }).value;
        const preview = this.add
          .rectangle(x, previewY, cellSize - 16, cellSize - 20, 0x222222, 1)
          .setOrigin(0.5)
          .setStrokeStyle(3, outlineVal)
          .setAlpha(previewAlpha);
        this.gridObjects.push(preview);
      } else if (this.selectedCategory === "headwear") {
        const spriteKey = (def.effect as { spriteKey: string }).spriteKey;
        if (spriteKey && this.textures.exists(spriteKey)) {
          const preview = this.add
            .image(x, previewY, spriteKey)
            .setDisplaySize(cellSize - 12, cellSize - 12)
            .setOrigin(0.5)
            .setAlpha(previewAlpha);
          this.gridObjects.push(preview);
        } else {
          const name = this.i18n!.t(def.nameKey as never);
          const preview = this.add
            .text(x, previewY, name.slice(0, 4), {
              color: "#f4f1de",
              fontFamily: "Arial",
              fontSize: "12px",
              align: "center",
            })
            .setOrigin(0.5)
            .setAlpha(previewAlpha);
          this.gridObjects.push(preview);
        }
      } else {
        const name = this.i18n!.t(def.nameKey as never);
        const isNoneVariant = def.id.endsWith("-none");
        const previewText = isNoneVariant ? "—" : name.slice(0, 4);
        const preview = this.add
          .text(x, previewY, previewText, {
            color: isAvailable ? "#f4f1de" : "#aaaaaa",
            fontFamily: "Arial",
            fontSize: "13px",
            align: "center",
          })
          .setOrigin(0.5);
        this.gridObjects.push(preview);
      }

      // Lock indicator — top-right corner of cell, above preview
      if (!isAvailable) {
        const source = def.source;
        const lockText =
          source.kind === "free" && source.unlockLevel !== undefined
            ? `🔒L${source.unlockLevel}`
            : source.kind === "2p-free"
              ? "🔒2P"
              : "🔒";
        const lock = this.add
          .text(x + cellSize / 2 - 2, y - cellSize / 2 + 4, lockText, {
            color: "#f4d35e",
            fontFamily: "Arial",
            fontSize: "9px",
            fontStyle: "bold",
          })
          .setOrigin(1, 0);
        this.gridObjects.push(lock);
      } else {
        // Clickable — equip on click
        cell.setInteractive(
          new Phaser.Geom.Rectangle(-cellSize / 2, -cellSize / 2, cellSize, cellSize),
          Phaser.Geom.Rectangle.Contains,
        );
        cell.on("pointerup", () => {
          this.audio?.playMenuClick();
          this.equipCosmetic(def.id);
        });
      }

      // Cell name — below the cell, with enough gap so it doesn't
      // overlap the preview content inside the cell.
      const nameLabel = this.add
        .text(x, y + cellSize / 2 + 16, this.i18n!.t(def.nameKey as never), {
          color: isAvailable ? "#f4f1de" : "#888888",
          fontFamily: "Arial",
          fontSize: "10px",
          align: "center",
        })
        .setOrigin(0.5);
      this.gridObjects.push(nameLabel);
    });
  }

  /** Render a live preview of the currently equipped cosmetics. */
  private renderPreview(): void {
    // Destroy old preview objects.
    for (const obj of this.previewObjects) {
      obj.destroy();
    }
    this.previewObjects = [];

    if (!this.profile || !this.i18n) return;
    const width = this.scale.width;
    const height = this.scale.height;
    const previewY = height * 0.16;

    const equipped =
      this.target === "p1"
        ? this.profile.cosmetics.equipped
        : this.profile.cosmetics.p2Equipped;

    // Issue 1 fix: removed color preview (color category removed).
    // Show headwear overlay on the preview.
    if (equipped.headwear) {
      const def = COSMETICS.find((c) => c.id === equipped.headwear);
      if (def) {
        const spriteKey = (def.effect as { spriteKey: string }).spriteKey;
        if (spriteKey && this.textures.exists(spriteKey)) {
          const hat = this.add
            .image(width / 2, previewY - 10, spriteKey)
            .setDisplaySize(48, 48)
            .setOrigin(0.5);
          this.previewObjects.push(hat);
        }
      }
    }

    // Show title text.
    if (equipped.title) {
      const def = COSMETICS.find((c) => c.id === equipped.title);
      if (def && def.id !== "title-none") {
        const titleKey = (def.effect as { key: string }).key;
        const titleText = this.add
          .text(width / 2 + 30, previewY, this.i18n.t(`cosmetic.title.${titleKey}` as never), {
            color: "#f4d35e",
            fontFamily: "Arial",
            fontSize: "16px",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 2,
          })
          .setOrigin(0.5);
        this.previewObjects.push(titleText);
      }
    }
  }

  private equipCosmetic(cosmeticId: string): void {
    if (!this.profile) return;
    const currentEquipped =
      this.target === "p1"
        ? this.profile.cosmetics.equipped
        : this.profile.cosmetics.p2Equipped;
    const next = equipCosmetic(
      currentEquipped,
      cosmeticId,
      this.profile,
      this.is2P,
    );
    if (this.target === "p1") {
      this.profile = {
        ...this.profile,
        cosmetics: {
          ...this.profile.cosmetics,
          equipped: next,
        },
      };
      if (this.storage) saveProfile(this.storage, this.profile);
    } else {
      this.profile = {
        ...this.profile,
        cosmetics: {
          ...this.profile.cosmetics,
          p2Equipped: next,
        },
      };
      this.registry.set("p2CosmeticsEquipped", next);
    }
    // Bug 4 fix: refresh the grid in-place instead of scene.restart().
    this.refreshGrid();
  }
}
