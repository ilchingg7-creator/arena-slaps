import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { I18nService } from "./I18nService";
import { DEFAULT_LANGUAGE, type Language } from "../config/translations";

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

function makeStorage(initial: Record<string, string> = {}): {
  storage: StorageLike;
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  const storage: StorageLike = {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
  return { storage, data };
}

describe("I18nService - construction", () => {
  it("defaults to DEFAULT_LANGUAGE when no arg is provided", () => {
    const svc = new I18nService();
    expect(svc.getLanguage()).toBe(DEFAULT_LANGUAGE);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("uses the provided initial language", () => {
    const svc = new I18nService("en");
    expect(svc.getLanguage()).toBe("en");
  });
});

describe("I18nService.load", () => {
  // Mock navigator.language to "ru" so detectLanguage() returns the
  // default language in tests that don't specifically test auto-detection.
  const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;
  beforeEach(() => {
    vi.stubGlobal("navigator", { language: "ru-RU" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns auto-detected language when storage is null", () => {
    const svc = I18nService.load(null);
    expect(svc.getLanguage()).toBe("ru"); // navigator.language mocked to "ru-RU"
  });

  it("returns auto-detected language when storage is undefined", () => {
    const svc = I18nService.load(undefined);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("returns auto-detected language when storage has no entry", () => {
    const { storage } = makeStorage({});
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("returns 'ru' when 'ru' is stored", () => {
    const { storage } = makeStorage({ "arena-slaps:language": "ru" });
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("ignores a stored language when browser language is Russian", () => {
    const { storage } = makeStorage({ "arena-slaps:language": "en" });
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("ignores invalid stored values and auto-detects", () => {
    const { storage } = makeStorage({ "arena-slaps:language": "fr" });
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru"); // auto-detected from navigator
  });

  it("ignores non-string junk stored under the key and auto-detects", () => {
    const { storage } = makeStorage({ "arena-slaps:language": "[object Object]" });
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru"); // auto-detected
  });

  it("auto-detects 'en' when browser language is English", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    const { storage } = makeStorage({});
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("en");
  });

  it("auto-detects 'ru' when browser language is Russian", () => {
    vi.stubGlobal("navigator", { language: "ru" });
    const { storage } = makeStorage({});
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("ru");
  });

  it("browser language overrides saved preference", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    const { storage } = makeStorage({ "arena-slaps:language": "ru" });
    const svc = I18nService.load(storage);
    expect(svc.getLanguage()).toBe("en");
  });

  it("uses ?lang=en before Russian browser language", () => {
    vi.stubGlobal("window", { location: { search: "?debug-mode=16&lang=en" } });
    vi.stubGlobal("navigator", { language: "ru-RU" });

    expect(I18nService.load(null).getLanguage()).toBe("en");
  });

  it("uses ?lang=ru before English browser language", () => {
    vi.stubGlobal("window", { location: { search: "?lang=ru" } });
    vi.stubGlobal("navigator", { language: "en-US" });

    expect(I18nService.load(null).getLanguage()).toBe("ru");
  });

  it("keeps a manual page choice above the URL language", () => {
    vi.stubGlobal("window", {
      location: { search: "?lang=en" },
      __arenaSlapsSessionLanguage: "ru",
    });
    vi.stubGlobal("navigator", { language: "en-US" });

    expect(I18nService.load(null).getLanguage()).toBe("ru");
  });

  it("keeps a manual language choice across scene reloads in the same page", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: "ru-RU" });
    const { storage } = makeStorage({});
    const service = I18nService.load(storage);

    service.toggle();
    service.save(storage);

    expect(I18nService.load(storage).getLanguage()).toBe("en");
  });

  it("returns to browser language after the page-scoped choice is cleared", () => {
    const page = {} as { __arenaSlapsSessionLanguage?: string };
    vi.stubGlobal("window", page);
    vi.stubGlobal("navigator", { language: "ru-RU" });
    const { storage } = makeStorage({ "arena-slaps:language": "en" });
    const service = new I18nService("en");
    service.save(storage);
    delete page.__arenaSlapsSessionLanguage;

    expect(I18nService.load(storage).getLanguage()).toBe("ru");
  });
});

describe("I18nService.save", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the current language only for the current page", () => {
    const page = {} as { __arenaSlapsSessionLanguage?: string };
    vi.stubGlobal("window", page);
    const { storage, data } = makeStorage({});
    const svc = new I18nService("en");
    svc.save(storage);
    expect(page.__arenaSlapsSessionLanguage).toBe("en");
    expect(data["arena-slaps:language"]).toBeUndefined();
  });

  it("stores the toggled language only for the current page", () => {
    const page = {} as { __arenaSlapsSessionLanguage?: string };
    vi.stubGlobal("window", page);
    const { storage, data } = makeStorage({});
    const svc = new I18nService();
    svc.toggle();
    svc.save(storage);
    expect(page.__arenaSlapsSessionLanguage).toBe("en");
    expect(data["arena-slaps:language"]).toBeUndefined();
  });
});

describe("I18nService.getLanguage", () => {
  it("returns the current language", () => {
    const svc = new I18nService("en");
    expect(svc.getLanguage()).toBe("en");
  });
});

describe("I18nService.toggle", () => {
  it("switches ru -> en", () => {
    const svc = new I18nService("ru");
    svc.toggle();
    expect(svc.getLanguage()).toBe("en");
  });

  it("switches en -> ru", () => {
    const svc = new I18nService("en");
    svc.toggle();
    expect(svc.getLanguage()).toBe("ru");
  });

  it("toggles back to the original language after two calls", () => {
    const svc = new I18nService("ru");
    svc.toggle();
    svc.toggle();
    expect(svc.getLanguage()).toBe("ru");
  });

  it("returns the new language", () => {
    const svc = new I18nService("ru");
    const next: Language = svc.toggle();
    expect(next).toBe("en");
  });
});

describe("I18nService.setLanguage", () => {
  it("changes the language to the specified value", () => {
    const svc = new I18nService("ru");
    svc.setLanguage("en");
    expect(svc.getLanguage()).toBe("en");
  });

  it("can be set back to the previous language", () => {
    const svc = new I18nService("en");
    svc.setLanguage("ru");
    expect(svc.getLanguage()).toBe("ru");
    svc.setLanguage("en");
    expect(svc.getLanguage()).toBe("en");
  });
});

describe("I18nService.t", () => {
  it("returns the correct RU translation when language is ru", () => {
    const svc = new I18nService("ru");
    expect(svc.t("mainmenu.start")).toBe("Начать");
  });

  it("returns the correct EN translation when language is en", () => {
    const svc = new I18nService("en");
    expect(svc.t("mainmenu.start")).toBe("Start");
  });

  it("returns the key itself for unknown keys", () => {
    const svc = new I18nService("ru");
    // Cast to any to bypass the typed-key constraint for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(svc.t("this.key.does.not.exist" as any)).toBe("this.key.does.not.exist");
  });

  it("returns the correct translation for several known keys", () => {
    const ru = new I18nService("ru");
    expect(ru.t("audio.title")).toBe("Настройки звука");
    expect(ru.t("battle.draw")).toBe("Ничья");
    expect(ru.t("pause.resume")).toBe("Продолжить");

    const en = new I18nService("en");
    expect(en.t("audio.title")).toBe("Audio Settings");
    expect(en.t("battle.draw")).toBe("Draw");
    expect(en.t("pause.resume")).toBe("Resume");
  });
});

describe("I18nService.tIn", () => {
  it("returns the translation in the specified language without changing current", () => {
    const svc = new I18nService("ru");
    expect(svc.tIn("mainmenu.start", "en")).toBe("Start");
    // current language unchanged
    expect(svc.getLanguage()).toBe("ru");
    expect(svc.t("mainmenu.start")).toBe("Начать");
  });

  it("returns the RU translation when lang=ru", () => {
    const svc = new I18nService("en");
    expect(svc.tIn("mainmenu.start", "ru")).toBe("Начать");
  });

  it("returns the key itself for unknown keys", () => {
    const svc = new I18nService("ru");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(svc.tIn("does.not.exist" as any, "en")).toBe("does.not.exist");
  });
});
