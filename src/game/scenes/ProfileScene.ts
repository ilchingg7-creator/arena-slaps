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
} from "../config/gameSettings";

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
        if (!next.musicMuted) audio.playMenuTheme();
      },
    );

    // --- Background ---
    createBackground(this as unknown as Phaser.Scene, { key: "menu-bg" });

    // --- Title ---
    this.add
      .text(width / 2, height * 0.1, "Profile", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "42px",
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

    addRow("Nickname", profile.nickname, 0);
    addRow("Total Games", String(service.getTotalGames()), 1);
    addRow("Wins", String(profile.wins), 2);
    addRow("Losses", String(profile.losses), 3);
    addRow("Draws", String(profile.draws), 4);
    addRow("Win Rate", `${Math.round(service.getWinRate() * 100)}%`, 5);
    addRow("Ring Outs (Inflicted)", String(profile.ringOutsInflicted), 6);
    addRow("Ring Outs (Suffered)", String(profile.ringOutsSuffered), 7);
    addRow("Power-ups Collected", String(profile.powerUpsCollected), 8);
    const favPu = service.getFavoritePowerUp();
    addRow("Favorite Power-up", favPu ?? "—", 9);
    addRow(
      "Favorite Mode",
      service.getFavoriteMode() === "1p-vs-bot" ? "1P vs Bot" : "2P Local",
      10,
    );

    // --- Buttons ---
    const buttonY = height * 0.85;
    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.3,
        y: buttonY,
        text: "Change Nickname",
        variant: "secondary",
        width: 220,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          // Prompt for new nickname (simple browser prompt for now).
          const newName =
            typeof window !== "undefined"
              ? window.prompt("Enter new nickname:", profile.nickname)
              : null;
          if (
            newName &&
            newName.trim().length > 0 &&
            newName.trim().length <= 20
          ) {
            profile = { ...profile, nickname: newName.trim() };
            service.setNickname(newName.trim());
            if (storage) saveProfile(storage, profile);
            // Restart scene to refresh display.
            this.scene.restart();
          }
        },
      },
    );

    createStyledButton(
      this as unknown as Parameters<typeof createStyledButton>[0],
      {
        x: width * 0.55,
        y: buttonY,
        text: "Reset Stats",
        variant: "danger",
        width: 180,
        height: 44,
        fontSize: 18,
        onClick: () => {
          audio.playMenuClick();
          const confirmReset =
            typeof window !== "undefined"
              ? window.confirm(
                  "Reset all statistics? This cannot be undone.",
                )
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
        text: "Back",
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
}
