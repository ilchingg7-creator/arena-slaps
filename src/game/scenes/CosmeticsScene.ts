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
} from "../config/CosmeticsManifest";
import { equipCosmetic } from "../cosmetics/CosmeticsPickerState";
import type { GameMode } from "../config/gameSettings";

/**
 * Cosmetics scene — full-screen overlay where the player picks
 * cosmetics for P1 (always) and P2 (only in 2P-local mode).
 *
 * Layout:
 *   - Title at top
 *   - Target toggle (P1 / P2) — only visible in 2P mode
 *   - Category tabs (Color / Outline / Trail / Slap FX / Title /
 *     Power-up Skin / Headwear)
 *   - Grid of cosmetic cells for the selected category
 *   - Back button at the bottom
 *
 * State:
 *   - P1 edits are persisted to profile.cosmetics.equipped.
 *   - P2 edits are kept in profile.cosmetics.p2Equipped (transient —
 *     cleared on resetProfileStats).
 *   - In 2P mode, both players can pick ANY cosmetic (the 2P free-cosmetics
 *     rule from isCosmeticAvailable with is2P=true).
 */
export class CosmeticsScene extends Phaser.Scene {
  private selectedCategory: CosmeticCategory = "color";
  private target: "p1" | "p2" = "p1";
  private is2P = false;
  private profile: Profile | null = null;
  private pickerObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("CosmeticsScene");
  }

  init(data: { mode?: GameMode } | undefined): void {
    this.is2P = data?.mode === "2p-local";
    this.target = "p1"; // always reset to P1 on entry
    this.selectedCategory = "color";
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const i18n = I18nService.load(storage);
    const settings = loadSettings(storage);
    const audio = getAudioService(this, settings);
    audio.playMenuTheme();

    this.profile = loadProfile(storage);

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.08, i18n.t("cosmetics.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "38px",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // --- Target toggle (P1 / P2) — only in 2P mode ---
    if (this.is2P) {
      const toggleY = height * 0.14;
      const p1Button = this.add
        .text(width / 2 - 80, toggleY, i18n.t("cosmetics.player1"), {
          color: this.target === "p1" ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "22px",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const p2Button = this.add
        .text(width / 2 + 80, toggleY, i18n.t("cosmetics.player2"), {
          color: this.target === "p2" ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "22px",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      p1Button.on("pointerup", () => {
        audio.playMenuClick();
        this.target = "p1";
        this.scene.restart({ mode: this.is2P ? "2p-local" : "1p-vs-bot" });
      });
      p2Button.on("pointerup", () => {
        audio.playMenuClick();
        this.target = "p2";
        this.scene.restart({ mode: this.is2P ? "2p-local" : "1p-vs-bot" });
      });
    }

    // --- Category tabs ---
    const categories: CosmeticCategory[] = [
      "color",
      "outline",
      "trail",
      "slapFx",
      "title",
      "powerUpSkin",
      "headwear",
    ];
    const tabY = height * 0.20;
    const tabStep = width / (categories.length + 1);
    categories.forEach((cat, index) => {
      const tabX = tabStep * (index + 1);
      const isActive = cat === this.selectedCategory;
      const tab = this.add
        .text(tabX, tabY, i18n.t(`cosmetics.category.${cat}` as never), {
          color: isActive ? "#f4d35e" : "#f4f1de",
          fontFamily: "Arial",
          fontSize: "16px",
          fontStyle: isActive ? "bold" : "normal",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      tab.on("pointerup", () => {
        audio.playMenuClick();
        this.selectedCategory = cat;
        this.scene.restart({ mode: this.is2P ? "2p-local" : "1p-vs-bot" });
      });
    });

    // --- Cosmetic cells grid ---
    this.renderCells(i18n, audio, storage);

    // --- Back button ---
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width / 2,
        y: height * 0.92,
        text: i18n.t("cosmetics.title"),
        variant: "primary",
        onClick: () => {
          audio.playMenuClick();
          this.scene.start("BattleSetupScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("BattleSetupScene");
    });
  }

  private renderCells(
    i18n: I18nService,
    audio: ReturnType<typeof getAudioService>,
    storage: Storage | null,
  ): void {
    if (!this.profile) return;
    const width = this.scale.width;
    const height = this.scale.height;
    const cells = getCosmeticsByCategory(this.selectedCategory);

    const cellSize = 56;
    const cellGap = 12;
    const cellsPerRow = 6;
    const gridStartY = height * 0.32;

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
          : 0x555555;
      const cell = this.add
        .rectangle(x, y, cellSize, cellSize, bgColor, 1)
        .setOrigin(0.5)
        .setStrokeStyle(
          isEquipped ? 3 : 1,
          isEquipped ? 0xf4d35e : 0x444444,
        );
      this.pickerObjects.push(cell);

      // Preview content
      if (this.selectedCategory === "color" && isAvailable) {
        const colorVal = (def.effect as { value: number }).value;
        this.add
          .rectangle(x, y, cellSize - 10, cellSize - 10, colorVal, 1)
          .setOrigin(0.5);
      } else if (this.selectedCategory === "outline" && isAvailable) {
        const outlineVal = (def.effect as { value: number }).value;
        this.add
          .rectangle(x, y, cellSize - 16, cellSize - 16, 0x222222, 1)
          .setOrigin(0.5)
          .setStrokeStyle(3, outlineVal);
      } else {
        // Text label preview
        const name = i18n.t(def.nameKey as never);
        const isNoneVariant = def.id.endsWith("-none");
        const previewText = isNoneVariant ? "—" : name.slice(0, 4);
        this.add
          .text(x, y, previewText, {
            color: isAvailable ? "#f4f1de" : "#888888",
            fontFamily: "Arial",
            fontSize: "14px",
            align: "center",
          })
          .setOrigin(0.5);
      }

      // Lock indicator
      if (!isAvailable) {
        const source = def.source;
        const lockText =
          source.kind === "free" && source.unlockLevel !== undefined
            ? `L${source.unlockLevel}`
            : source.kind === "2p-free"
              ? "2P"
              : "🔒";
        this.add
          .text(x + cellSize / 2 - 8, y - cellSize / 2 + 8, lockText, {
            color: "#f4d35e",
            fontFamily: "Arial",
            fontSize: "10px",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      } else {
        // Clickable — equip on click
        cell.setInteractive(
          new Phaser.Geom.Rectangle(-cellSize / 2, -cellSize / 2, cellSize, cellSize),
          Phaser.Geom.Rectangle.Contains,
        );
        cell.on("pointerup", () => {
          audio.playMenuClick();
          this.equipCosmetic(def.id, storage);
        });
      }

      // Cell name below
      this.add
        .text(x, y + cellSize / 2 + 12, i18n.t(def.nameKey as never), {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "10px",
          align: "center",
        })
        .setOrigin(0.5);
    });
  }

  private equipCosmetic(cosmeticId: string, storage: Storage | null): void {
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
      // Persist P1's loadout
      if (storage) saveProfile(storage, this.profile);
    } else {
      this.profile = {
        ...this.profile,
        cosmetics: {
          ...this.profile.cosmetics,
          p2Equipped: next,
        },
      };
      // P2's loadout is also persisted (so it survives scene transitions
      // within a session). resetProfileStats wipes it on a full reset.
      if (storage) saveProfile(storage, this.profile);
    }
    // Re-render the grid to reflect the new equipped state.
    this.scene.restart({ mode: this.is2P ? "2p-local" : "1p-vs-bot" });
  }
}
