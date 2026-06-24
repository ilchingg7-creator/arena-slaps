import { describe, expect, it } from "vitest";

import {
  TRANSLATIONS,
  getTranslationKeys,
  translate,
  type Language,
} from "./translations";

describe("translations", () => {
  it("exposes at least 40 keys (main menu + achievements scene + 18×2 achievement keys)", () => {
    const keys = getTranslationKeys();
    // 36 achievement name/desc keys + mainmenu + achievements scene UI.
    expect(keys.length).toBeGreaterThanOrEqual(40);
  });

  it("every translation entry has both ru and en strings", () => {
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      expect(typeof entry.ru).toBe("string");
      expect(entry.ru.length).toBeGreaterThan(0);
      expect(typeof entry.en).toBe("string");
      expect(entry.en.length).toBeGreaterThan(0);
      void key;
    }
  });

  it("all 18 achievement name + desc keys are present", () => {
    const ids = [
      "first_blood",
      "first_loss",
      "streak_5",
      "comeback_king",
      "flawless",
      "speed_demon",
      "power_collector",
      "all_powerups",
      "combo_5",
      "dodge_master",
      "ringout_master",
      "first_flight",
      "survivor",
      "level_5",
      "level_10",
      "all_maps",
      "social",
      "veteran",
    ];
    for (const id of ids) {
      expect(TRANSLATIONS[`achievement.${id}.name`]).toBeDefined();
      expect(TRANSLATIONS[`achievement.${id}.desc`]).toBeDefined();
    }
  });

  it("translate returns the localized string for each language", () => {
    expect(translate("achievement.first_blood.name", "en")).toBe("First Blood");
    expect(translate("achievement.first_blood.name", "ru")).toBe("Первая кровь");
  });

  it("translate falls back to English when the language is missing the key", () => {
    // All keys have both ru and en in this map; this test exists to lock the
    // documented fallback behaviour in case a future key omits `ru`.
    // We simulate by passing an unknown language — translate defaults to en.
    expect(translate("achievement.first_blood.name", "fr" as Language)).toBe(
      "First Blood",
    );
  });

  it("translate returns the key itself if the key is entirely missing", () => {
    expect(translate("totally.missing.key", "en")).toBe("totally.missing.key");
  });

  it("exposes the achievements-scene UI keys", () => {
    expect(TRANSLATIONS["achievements.title"].ru).toBe("Достижения");
    expect(TRANSLATIONS["achievements.title"].en).toBe("Achievements");
    expect(TRANSLATIONS["achievements.back"].ru).toBe("Назад");
    expect(TRANSLATIONS["achievements.back"].en).toBe("Back");
    expect(TRANSLATIONS["achievements.unlocked"].en).toBe("Unlocked");
    expect(TRANSLATIONS["achievements.locked"].en).toBe("Locked");
  });

  it("exposes mainmenu.achievements key for the menu button", () => {
    expect(TRANSLATIONS["mainmenu.achievements"].ru).toBe("Достижения");
    expect(TRANSLATIONS["mainmenu.achievements"].en).toBe("Achievements");
  });
});
