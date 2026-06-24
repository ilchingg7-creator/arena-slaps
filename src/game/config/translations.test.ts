import { describe, expect, it } from "vitest";
import { MAPS } from "./mapManifest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  TRANSLATIONS,
  type TranslationKey,
} from "./translations";

describe("translations config", () => {
  it("LANGUAGES has exactly ['ru', 'en']", () => {
    expect(LANGUAGES).toEqual(["ru", "en"]);
    expect(LANGUAGES).toHaveLength(2);
  });

  it("DEFAULT_LANGUAGE is 'ru'", () => {
    expect(DEFAULT_LANGUAGE).toBe("ru");
  });

  it("TRANSLATIONS is not empty", () => {
    expect(Object.keys(TRANSLATIONS).length).toBeGreaterThan(0);
  });

  it("every key in TRANSLATIONS has both 'ru' and 'en' values", () => {
    const keys = Object.keys(TRANSLATIONS) as TranslationKey[];
    for (const key of keys) {
      const entry = TRANSLATIONS[key];
      expect(entry).toBeDefined();
      expect(typeof entry.ru).toBe("string");
      expect(typeof entry.en).toBe("string");
    }
  });

  it("no translation value is an empty string", () => {
    const keys = Object.keys(TRANSLATIONS) as TranslationKey[];
    for (const key of keys) {
      const entry = TRANSLATIONS[key];
      expect(entry.ru.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
    }
  });

  it("every TranslationKey maps to a { ru, en } object", () => {
    const keys = Object.keys(TRANSLATIONS) as TranslationKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const entry = TRANSLATIONS[key];
      expect(Object.keys(entry).sort()).toEqual(["en", "ru"]);
    }
  });

  it("TranslationKey is assignable for known keys (type-level sanity)", () => {
    // Smoke test that the type narrowing works for a sample of keys.
    const sampleKeys: TranslationKey[] = [
      "mainmenu.title",
      "audio.title",
      "battle.draw",
      "results.back",
      "pause.resume",
      "preload.loading",
      "mute.sound",
    ];
    for (const key of sampleKeys) {
      expect(TRANSLATIONS[key].ru).toBeDefined();
      expect(TRANSLATIONS[key].en).toBeDefined();
    }
  });

  it("provides a translated label for every power-up effect key (M3)", () => {
    // ProfileScene maps raw power-up keys ("speed", "knockback", ...) to
    // "powerup.<key>" translation keys. Every effect must have an entry
    // so the favorite power-up row never falls back to the raw key.
    const powerupKeys: TranslationKey[] = [
      "powerup.speed",
      "powerup.knockback",
      "powerup.shield",
      "powerup.mega-knockback",
      "powerup.freeze",
      "powerup.double-slap",
    ];
    for (const key of powerupKeys) {
      const entry = TRANSLATIONS[key];
      expect(entry).toBeDefined();
      expect(entry.ru.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
    }
  });

  it("provides a banned-nickname rejection message (MINOR-4)", () => {
    const entry = TRANSLATIONS["profile.nicknameBanned"];
    expect(entry).toBeDefined();
    expect(entry.ru.length).toBeGreaterThan(0);
    expect(entry.en.length).toBeGreaterThan(0);
  });

  it("all map keys have ru + en translations", () => {
    // Iterate over every map in MAPS and assert that both its nameKey and
    // descriptionKey resolve to a TRANSLATIONS entry with non-empty ru + en.
    for (const map of MAPS) {
      const nameEntry = TRANSLATIONS[map.nameKey];
      expect(nameEntry).toBeDefined();
      expect(typeof nameEntry.ru).toBe("string");
      expect(nameEntry.ru.length).toBeGreaterThan(0);
      expect(typeof nameEntry.en).toBe("string");
      expect(nameEntry.en.length).toBeGreaterThan(0);

      const descEntry = TRANSLATIONS[map.descriptionKey];
      expect(descEntry).toBeDefined();
      expect(typeof descEntry.ru).toBe("string");
      expect(descEntry.ru.length).toBeGreaterThan(0);
      expect(typeof descEntry.en).toBe("string");
      expect(descEntry.en.length).toBeGreaterThan(0);
    }
  });
});
