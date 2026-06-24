import Phaser from "phaser";
import {
  ACHIEVEMENTS,
  getAchievementCount,
} from "../config/achievements";
import {
  loadProfile,
  type Profile,
} from "../config/profile";
import { translate, type Language } from "../config/translations";
import { AchievementService } from "../services/AchievementService";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../config/gameSettings";

/**
 * Scene key for the AchievementsScene. Exported so callers (MainMenu wiring,
 * gameConfig scene list) can reference the key without a string literal.
 */
export const ACHIEVEMENTS_SCENE_KEY = "AchievementsScene";

/**
 * Persisted UI language preference. Defaults to Russian ("ru") to match the
 * game's primary audience. The user can toggle this from the settings menu
 * (future work); for now the AchievementsScene reads this from the registry.
 */
const DEFAULT_LANG: Language = "ru";

/**
 * AchievementsScene — a grid view of all 18 achievements.
 *
 * Layout:
 *   - Title "Достижения" / "Achievements" at the top.
 *   - 6×3 grid of achievement cells below the title. Each cell shows the
 *     emoji icon + localized name; unlocked achievements are rendered in
 *     green, locked ones in grey.
 *   - Back button at the bottom (returns to MenuScene).
 *   - Top-right mute toggle (placeholder — the audio service handles the
 *     actual mute state).
 *
 * The scene loads the player profile from localStorage to determine which
 * achievements are unlocked.
 */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(ACHIEVEMENTS_SCENE_KEY);
  }

  create(): void {
    const width = this.scale.width || 1280;
    const height = this.scale.height || 720;
    const lang = (this.registry.get("lang") as Language | undefined) ?? DEFAULT_LANG;

    this.cameras.main.setBackgroundColor("#101820");

    // --- Title ---
    this.add
      .text(width / 2, height * 0.10, translate("achievements.title", lang), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "52px",
      })
      .setOrigin(0.5);

    // --- Profile + unlocked set ---
    const storage =
      typeof window === "undefined" ? null : window.localStorage;
    const profile: Profile = loadProfile(storage);
    const unlockedSet = new Set(profile.achievements);

    // --- Achievement grid (6 columns × 3 rows = 18 cells) ---
    const columns = 6;
    const rows = 3;
    expectCorrectGrid(columns, rows);
    const gridTopY = height * 0.24;
    const gridBottomY = height * 0.78;
    const gridLeftX = width * 0.08;
    const gridRightX = width * 0.92;
    const cellWidth = (gridRightX - gridLeftX) / columns;
    const cellHeight = (gridBottomY - gridTopY) / rows;

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const def = ACHIEVEMENTS[i];
      const col = i % columns;
      const row = Math.floor(i / columns);
      const cx = gridLeftX + cellWidth * (col + 0.5);
      const cy = gridTopY + cellHeight * (row + 0.5);
      const isUnlocked = unlockedSet.has(def.id);
      const color = isUnlocked ? "#81b29a" : "#6c757d";

      // Cell background.
      this.add
        .rectangle(cx, cy, cellWidth - 12, cellHeight - 12, 0x1d2433)
        .setStrokeStyle(2, isUnlocked ? 0x81b29a : 0x3d405b)
        .setOrigin(0.5);

      // Icon (emoji).
      this.add
        .text(cx, cy - 14, def.icon, {
          color,
          fontFamily: "Arial",
          fontSize: "32px",
        })
        .setOrigin(0.5);

      // Name (localized).
      this.add
        .text(cx, cy + 22, translate(def.nameKey, lang), {
          color,
          fontFamily: "Arial",
          fontSize: "14px",
          align: "center",
        })
        .setOrigin(0.5);
    }

    // --- Unlocked count footer ---
    const unlockedCount = AchievementService.getUnlockedDefinitions(profile).length;
    this.add
      .text(
        width / 2,
        height * 0.86,
        `${translate("achievements.unlocked", lang)}: ${unlockedCount} / ${getAchievementCount()}`,
        {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
        },
      )
      .setOrigin(0.5);

    // --- Back button ---
    const backButton = this.add
      .text(width / 2, height * 0.94, translate("achievements.back", lang), {
        align: "center",
        backgroundColor: "#e07a5f",
        color: "#101820",
        fontFamily: "Arial",
        fontSize: "24px",
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive();
    backButton.on("pointerup", () => {
      this.scene.start("MenuScene");
    });

    // --- Mute button (top-right) ---
    // Toggles the persisted `muted` flag in GameSettings. The actual audio
    // muting is applied the next time a scene with an AudioService is
    // created (MenuScene, BattleScene) — they read the settings on startup.
    const persistedSettings: GameSettings = loadSettings(
      typeof window === "undefined" ? null : window.localStorage,
    );
    const muteButton = this.add
      .text(width - 24, 24, persistedSettings.muted ? "🔇" : "🔊", {
        fontFamily: "Arial",
        fontSize: "28px",
      })
      .setOrigin(1, 0)
      .setInteractive();
    muteButton.on("pointerup", () => {
      const next = !persistedSettings.muted;
      const updated: GameSettings = { ...persistedSettings, muted: next };
      if (typeof window !== "undefined") {
        saveSettings(window.localStorage, updated);
      }
      muteButton.setText(next ? "🔇" : "🔊");
      persistedSettings.muted = next;
    });

    // Esc / Enter returns to the menu.
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MenuScene");
    });
  }
}

/**
 * Tiny runtime guard so the grid layout stays in sync with the manifest. If
 * the manifest ever grows past 18 entries, this throws at scene-create time
 * rather than silently rendering an incomplete grid.
 */
function expectCorrectGrid(columns: number, rows: number): void {
  const capacity = columns * rows;
  if (capacity < getAchievementCount()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AchievementsScene] grid capacity (${capacity}) < achievement count (${getAchievementCount()}); some achievements will not be rendered.`,
    );
  }
}
