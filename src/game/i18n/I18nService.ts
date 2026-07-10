import {
  DEFAULT_LANGUAGE,
  TRANSLATIONS,
  type Language,
  type TranslationKey,
} from "../config/translations";

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

type LanguageWindow = Window & {
  __arenaSlapsSessionLanguage?: Language;
};

/**
 * Localization service. Owns the current language, loads/saves the
 * language preference to localStorage, and exposes a `t(key)` translator
 * for use in scenes.
 *
 * Construction:
 *   - `new I18nService()` — defaults to {@link DEFAULT_LANGUAGE}.
 *   - `new I18nService("en")` — explicit initial language.
 *   - `I18nService.load(storage)` — read the saved language from
 *     localStorage; falls back to the default when nothing is stored.
 *
   * Session choice:
   *   - `save(storage)` keeps the current language in page memory so scene
   *     restarts preserve it without overriding browser language on reload.
 *
 * Translation:
 *   - `t(key)` returns the string for the current language.
 *   - `tIn(key, lang)` returns the string for a specific language
 *     without changing the current language.
 *   - Unknown keys fall back to the key itself (so a typo in a key is
 *     visible at runtime but doesn't crash the scene).
 */
export class I18nService {
  private language: Language;

  constructor(initialLanguage?: Language) {
    this.language = initialLanguage ?? DEFAULT_LANGUAGE;
  }

  /**
   * Load the saved language from localStorage, or auto-detect from
   * the browser/SDK when no preference is saved.
   *
   * Detection priority:
   *   1. Saved preference in localStorage (explicit user choice)
   *   2. Yandex SDK environment language (ysdk.environment.i18n.lang)
   *   3. Browser language (navigator.language)
   *   4. DEFAULT_LANGUAGE ("ru")
   */
  static load(storage: StorageLike | null | undefined): I18nService {
    if (typeof window !== "undefined") {
      const sessionLanguage = (window as LanguageWindow).__arenaSlapsSessionLanguage;
      if (sessionLanguage === "ru" || sessionLanguage === "en") {
        return new I18nService(sessionLanguage);
      }
    }
    if (!storage) return new I18nService(I18nService.detectLanguage());
    const raw = null;
    if (raw === "ru" || raw === "en") {
      return new I18nService(raw);
    }
    // No saved preference — auto-detect
    return new I18nService(I18nService.detectLanguage());
  }

  /**
   * Auto-detect the user's language from the Yandex SDK or browser.
   * Falls back to DEFAULT_LANGUAGE if detection fails.
   */
  private static detectLanguage(): Language {
    // Try Yandex SDK first (if available)
    if (typeof window !== "undefined") {
      const yaSdk = (window as unknown as { __yaSdkLang?: string }).__yaSdkLang;
      if (yaSdk === "ru" || yaSdk === "en") {
        return yaSdk;
      }
    }
    // Try browser language
    if (typeof navigator !== "undefined" && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      // Russian and other Cyrillic-language speakers → RU
      if (browserLang.startsWith("ru") ||
          browserLang.startsWith("be") ||
          browserLang.startsWith("uk") ||
          browserLang.startsWith("kk") ||
          browserLang.startsWith("uz")) {
        return "ru";
      }
      // Everything else → EN
      return "en";
    }
    return DEFAULT_LANGUAGE;
  }

  /** Keep the current language until the page is fully reloaded. */
  save(storage: StorageLike): void {
    void storage;
    if (typeof window !== "undefined") {
      (window as LanguageWindow).__arenaSlapsSessionLanguage = this.language;
    }
  }

  /** Get the current language. */
  getLanguage(): Language {
    return this.language;
  }

  /** Switch to the other language (ru <-> en). Returns the new language. */
  toggle(): Language {
    this.language = this.language === "ru" ? "en" : "ru";
    return this.language;
  }

  /** Set the language explicitly. */
  setLanguage(lang: Language): void {
    this.language = lang;
  }

  /** Translate a key to the current language. Returns the key itself if not found. */
  t(key: TranslationKey): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[this.language];
  }

  /** Translate a key to a specific language (without changing the current language). */
  tIn(key: TranslationKey, lang: Language): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[lang];
  }
}
