import { describe, expect, it, vi } from "vitest";
import {
  createLanguageToggle,
  type LanguageToggleSceneLike,
} from "./LanguageToggle";
import { I18nService } from "../i18n/I18nService";

type FakeText = {
  x: number;
  y: number;
  text: string;
  origin: { x: number; y: number };
  interactive: boolean;
  handlers: Map<string, () => void>;
};

type FakeScene = LanguageToggleSceneLike & {
  texts: FakeText[];
  click(): void;
};

function makeScene(width = 1280): FakeScene {
  const texts: FakeText[] = [];
  const scene: FakeScene = {
    texts,
    add: {
      text(x, y, value, _style) {
        const t: FakeText = {
          x,
          y,
          text: value,
          origin: { x: 0.5, y: 0.5 },
          interactive: false,
          handlers: new Map(),
        };
        texts.push(t);
        return {
          setOrigin(o?: number, p?: number) {
            t.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return this;
          },
          setInteractive() {
            t.interactive = true;
            return this;
          },
          on(event: string, handler: () => void) {
            t.handlers.set(event, handler);
            return this;
          },
          setText(v: string) {
            t.text = v;
            return this;
          },
        } as unknown as ReturnType<LanguageToggleSceneLike["add"]["text"]>;
      },
    },
    scale: { width, height: 720 },
    click() {
      const handler = texts[0]?.handlers.get("pointerup");
      if (handler) handler();
    },
  };
  return scene;
}

describe("LanguageToggle - construction", () => {
  it("creates a text at top-left (margin=20, origin 0,0)", () => {
    const scene = makeScene(1280);
    const i18n = new I18nService("ru");
    createLanguageToggle(scene, i18n, () => void 0);
    expect(scene.texts).toHaveLength(1);
    expect(scene.texts[0].x).toBe(20);
    expect(scene.texts[0].y).toBe(20);
    expect(scene.texts[0].origin).toEqual({ x: 0, y: 0 });
    expect(scene.texts[0].interactive).toBe(true);
  });

  it("initial flag is 🇷🇺 when language is ru", () => {
    const scene = makeScene();
    const i18n = new I18nService("ru");
    createLanguageToggle(scene, i18n, () => void 0);
    expect(scene.texts[0].text).toBe("🇷🇺");
  });

  it("initial flag is 🇬🇧 when language is en", () => {
    const scene = makeScene();
    const i18n = new I18nService("en");
    createLanguageToggle(scene, i18n, () => void 0);
    expect(scene.texts[0].text).toBe("🇬🇧");
  });
});

describe("LanguageToggle - click", () => {
  it("clicking the button calls i18n.toggle and updates the flag display", () => {
    const scene = makeScene();
    const i18n = new I18nService("ru");
    createLanguageToggle(scene, i18n, () => void 0);
    expect(scene.texts[0].text).toBe("🇷🇺");
    scene.click();
    expect(i18n.getLanguage()).toBe("en");
    expect(scene.texts[0].text).toBe("🇬🇧");
  });

  it("clicking twice toggles back to the original language", () => {
    const scene = makeScene();
    const i18n = new I18nService("ru");
    createLanguageToggle(scene, i18n, () => void 0);
    scene.click();
    expect(scene.texts[0].text).toBe("🇬🇧");
    scene.click();
    expect(i18n.getLanguage()).toBe("ru");
    expect(scene.texts[0].text).toBe("🇷🇺");
  });

  it("onChange callback is called with the new language", () => {
    const scene = makeScene();
    const i18n = new I18nService("ru");
    const onChange = vi.fn();
    createLanguageToggle(scene, i18n, onChange);
    scene.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("en");
  });

  it("onChange is called with 'ru' after toggling back from en", () => {
    const scene = makeScene();
    const i18n = new I18nService("en");
    const onChange = vi.fn();
    createLanguageToggle(scene, i18n, onChange);
    scene.click();
    expect(onChange).toHaveBeenLastCalledWith("ru");
  });
});

describe("LanguageToggle - refresh / getLanguage", () => {
  it("refresh updates the flag to match i18n.getLanguage()", () => {
    const scene = makeScene();
    const i18n = new I18nService("ru");
    const toggle = createLanguageToggle(scene, i18n, () => void 0);
    expect(scene.texts[0].text).toBe("🇷🇺");
    // Externally change the language and call refresh.
    i18n.setLanguage("en");
    toggle.refresh();
    expect(scene.texts[0].text).toBe("🇬🇧");
  });

  it("getLanguage returns the current language from i18n", () => {
    const scene = makeScene();
    const i18n = new I18nService("en");
    const toggle = createLanguageToggle(scene, i18n, () => void 0);
    expect(toggle.getLanguage()).toBe("en");
    i18n.setLanguage("ru");
    expect(toggle.getLanguage()).toBe("ru");
  });
});
