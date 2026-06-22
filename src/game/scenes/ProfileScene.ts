import Phaser from "phaser";
import {
  loadProfile,
  saveProfile,
  resetProfileStats,
  type Profile,
} from "../config/profile";
import { ProfileService } from "../services/ProfileService";
import { getAudioService } from "../audio/getAudioService";
import { createStyledButton } from "../ui/StyledButton";
import { createBackground } from "../ui/Background";
import { createTopRightMuteButton } from "../ui/TopRightMuteButton";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
  type GameMode,
} from "../config/gameSettings";
import { validateNickname } from "../config/nicknames";
import { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";

/**
 * Translation keys for the 2 game-mode values.
 */
const MODE_KEYS: Record<GameMode, TranslationKey> = {
  "1p-vs-bot": "mode.1p-vs-bot",
  "2p-local": "mode.2p-local",
};

/**
 * M3: map raw power-up effect keys (as stored in `profile.powerUpStats`)
 * to the translation keys that produce their localized display labels.
 * `service.getFavoritePowerUp()` returns the raw key — without this map
 * the profile row would show "speed" / "knockback" / etc. instead of
 * "Boost" / "Heavy Hand" / etc.
 *
 * The "speed" fallback below is defensive: if a future power-up key
 * somehow isn't in the map we'd rather show the "Boost" label than
 * crash on `i18n.t(undefined)`.
 */
const POWERUP_LABEL_KEYS: Record<string, TranslationKey> = {
  "speed": "powerup.speed",
  "knockback": "powerup.knockback",
  "shield": "powerup.shield",
  "mega-knockback": "powerup.mega-knockback",
  "freeze": "powerup.freeze",
  "double-slap": "powerup.double-slap",
};

/**
 * Profile scene — displays the player's statistics (nickname, win rate,
 * total games, wins/losses/draws, ring-outs, power-ups, favorite power-up,
 * favorite mode) and lets the player change their nickname or reset all
 * stats. Reuses the shared menu theme + top-right mute button pattern
 * from MainMenuScene / AudioSettingsScene.
 *
 * Navigation:
 *   - "Change Nickname" -> browser prompt (validated to 1..20 chars)
 *   - "Reset Stats"     -> browser confirm, then resetProfileStats()
 *   - "Back"            -> MainMenuScene
 *   - ESC / ENTER       -> MainMenuScene
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super("ProfileScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let profile: Profile = loadProfile(storage);
    let settings: GameSettings = loadSettings(storage);

    const audio = getAudioService(this, settings);
    audio.playMenuTheme();

    // --- i18n (RU/EN) ---
    const i18n = I18nService.load(storage);

    // --- Top-right mute button (toggles both SFX + Music) ---
    createTopRightMuteButton(
      this as unknown as Parameters<typeof createTopRightMuteButton>[0],
      {
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
      },
      (next) => {
        settings = {
          ...settings,
          sfxMuted: next.sfxMuted,
          musicMuted: next.musicMuted,
        };
        audio.updateSettings({
          sfxMuted: settings.sfxMuted,
          musicMuted: settings.musicMuted,
          sfxVolume: settings.sfxVolume,
          musicVolume: settings.musicVolume,
        });
        if (storage) saveSettings(storage, settings);
        if (next.sfxMuted && next.musicMuted) { audio.stopAll(); } else if (!next.musicMuted) { audio.hardStopMusic(); audio.playMenuTheme(); }
      },
      {
        soundLabel: i18n.t("mute.sound"),
        mutedLabel: i18n.t("mute.muted"),
      },
    );

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.1, i18n.t("profile.title"), {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
        stroke: "#000000",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 5, fill: true },
      })
      .setOrigin(0.5);

    // --- Profile content ---
    const service = new ProfileService(profile);
    const labelX = width * 0.3;
    const valueX = width * 0.7;
    const rowStartY = height * 0.22;
    const rowStep = 38;

    const addRow = (label: string, value: string, index: number): void => {
      this.add
        .text(labelX, rowStartY + index * rowStep, label, {
          color: "#81b29a",
          fontFamily: "Arial",
          fontSize: "20px",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(valueX, rowStartY + index * rowStep, value, {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "20px",
        })
        .setOrigin(1, 0.5);
    };

    addRow(i18n.t("profile.nickname"), profile.nickname, 0);
    addRow(i18n.t("profile.totalGames"), String(service.getTotalGames()), 1);
    addRow(i18n.t("profile.wins"), String(profile.wins), 2);
    addRow(i18n.t("profile.losses"), String(profile.losses), 3);
    addRow(i18n.t("profile.draws"), String(profile.draws), 4);
    addRow(i18n.t("profile.winRate"), `${Math.round(service.getWinRate() * 100)}%`, 5);
    addRow(i18n.t("profile.ringOutsInflicted"), String(profile.ringOutsInflicted), 6);
    addRow(i18n.t("profile.ringOutsSuffered"), String(profile.ringOutsSuffered), 7);
    addRow(i18n.t("profile.powerUpsCollected"), String(profile.powerUpsCollected), 8);
    // M3: translate the raw favorite power-up key (e.g. "speed") into the
    // localized display label (e.g. "Boost" / "Ускорение"). When no
    // power-ups have been collected yet, show an em dash.
    const favPu = service.getFavoritePowerUp();
    const favPuLabel = favPu
      ? i18n.t(POWERUP_LABEL_KEYS[favPu] ?? "powerup.speed")
      : "\u2014";
    addRow(i18n.t("profile.favoritePowerUp"), favPuLabel, 9);
    addRow(
      i18n.t("profile.favoriteMode"),
      i18n.t(MODE_KEYS[service.getFavoriteMode()]),
      10,
    );

    // --- Buttons ---
    const buttonY = height * 0.85;
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.3,
        y: buttonY,
        text: i18n.t("profile.changeNickname"),
        variant: "secondary",
        width: 220,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          this.openNicknameEditor(profile, service, storage, i18n);
        },
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.55,
        y: buttonY,
        text: i18n.t("profile.resetStats"),
        variant: "danger",
        width: 180,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          const confirmReset =
            typeof window !== "undefined"
              ? window.confirm(i18n.t("profile.resetConfirm"))
              : false;
          if (confirmReset) {
            profile = resetProfileStats(profile);
            if (storage) saveProfile(storage, profile);
            this.scene.restart();
          }
        },
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.78,
        y: buttonY,
        text: i18n.t("profile.back"),
        variant: "primary",
        width: 160,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          this.scene.start("MainMenuScene");
        },
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      audio.playMenuClick();
      this.scene.start("MainMenuScene");
    });
  }

  /**
   * Open an inline nickname editor using an HTML5 <input> element overlaid
   * on the Phaser canvas. The user types a new nickname and clicks Save
   * (or presses Enter) to confirm, or Cancel (or presses Escape) to abort.
   *
   * This replaces the previous window.prompt() approach which was silently
   * blocked by some browsers / iframe contexts.
   */
  private openNicknameEditor(
    profile: Profile,
    service: ProfileService,
    storage: Storage | null,
    i18n: I18nService,
  ): void {
    if (typeof document === "undefined") return;

    // Create a semi-transparent overlay div
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1000";
    overlay.style.fontFamily = "Arial, sans-serif";

    // Container box
    const box = document.createElement("div");
    box.style.backgroundColor = "#1a1a2e";
    box.style.padding = "30px";
    box.style.borderRadius = "12px";
    box.style.border = "2px solid #9b5de5";
    box.style.boxShadow = "0 0 20px rgba(155, 93, 229, 0.5)";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "16px";
    box.style.minWidth = "320px";

    // Label
    const label = document.createElement("label");
    label.textContent = i18n.t("profile.changeNicknamePrompt");
    label.style.color = "#f4f1de";
    label.style.fontSize = "18px";
    box.appendChild(label);

    // Input field
    const input = document.createElement("input");
    input.type = "text";
    input.value = profile.nickname;
    input.maxLength = 20;
    input.style.padding = "10px";
    input.style.fontSize = "18px";
    input.style.borderRadius = "6px";
    input.style.border = "2px solid #3d405b";
    input.style.backgroundColor = "#101820";
    input.style.color = "#f4f1de";
    input.style.outline = "none";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    box.appendChild(input);

    // Button row
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "12px";
    buttonRow.style.justifyContent = "center";

    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.style.padding = "10px 24px";
    saveButton.style.fontSize = "16px";
    saveButton.style.borderRadius = "6px";
    saveButton.style.border = "none";
    saveButton.style.backgroundColor = "#81b29a";
    saveButton.style.color = "#101820";
    saveButton.style.cursor = "pointer";
    saveButton.style.fontWeight = "bold";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.padding = "10px 24px";
    cancelButton.style.fontSize = "16px";
    cancelButton.style.borderRadius = "6px";
    cancelButton.style.border = "none";
    cancelButton.style.backgroundColor = "#3d405b";
    cancelButton.style.color = "#f4f1de";
    cancelButton.style.cursor = "pointer";

    buttonRow.appendChild(saveButton);
    buttonRow.appendChild(cancelButton);
    box.appendChild(buttonRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus the input + select all
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    const close = () => {
      document.body.removeChild(overlay);
    };

    const save = () => {
      const newName = input.value.trim();
      if (newName.length === 0 || newName.length > 20) {
        return;
      }
      if (!validateNickname(newName)) {
        input.style.borderColor = "#e07a5f";
        input.style.boxShadow = "0 0 8px rgba(224, 122, 95, 0.5)";
        return;
      }
      const updated = { ...profile, nickname: newName };
      service.setNickname(newName);
      if (storage) saveProfile(storage, updated);
      close();
      this.scene.restart();
    };

    saveButton.addEventListener("click", save);
    cancelButton.addEventListener("click", close);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    // Close on overlay click (outside the box)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
}
