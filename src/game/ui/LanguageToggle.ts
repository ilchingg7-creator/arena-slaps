/**
 * Language toggle button for the main menu.
 *
 * Renders a small text button (a flag emoji by default) in the top-left
 * corner of the screen. Clicking it toggles the language between RU and EN
 * via the {@link I18nService.toggle} method and invokes the `onChange`
 * callback with the new language so the caller can persist the choice and
 * re-render the scene.
 *
 * The mute button lives top-right; this one lives top-left so they don't
 * overlap.
 */

import type { I18nService } from "../i18n/I18nService";
import type { Language } from "../config/translations";

export type LanguageToggleSceneLike = {
  add: {
    text: (
      x: number,
      y: number,
      value: string,
      style?: {
        align?: string;
        backgroundColor?: string;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        padding?: { x?: number; y?: number };
      },
    ) => LanguageToggleText;
  };
  scale?: { width?: number; height?: number };
};

type LanguageToggleText = {
  setOrigin: (x?: number, y?: number) => LanguageToggleText;
  setInteractive: (config?: { useHandCursor?: boolean }) => LanguageToggleText;
  on: (event: string, handler: () => void) => LanguageToggleText;
  setText: (value: string) => LanguageToggleText;
};

export type LanguageToggle = {
  /** Update the flag display after a language change. */
  refresh: () => void;
  /** Get the current language. */
  getLanguage: () => Language;
};

const FLAG_RU = "🇷🇺";
const FLAG_EN = "🇬🇧";

function flagFor(lang: Language): string {
  return lang === "ru" ? FLAG_RU : FLAG_EN;
}

/**
 * Create a language toggle button at the top-left corner of the screen.
 *
 * @param scene    Any object with a Phaser-like `add.text` factory.
 * @param i18n     The I18nService whose language will be toggled.
 * @param onChange Called with the new language after each toggle. The
 *                 caller is responsible for persisting the choice and
 *                 re-rendering the scene (e.g. `scene.restart()`).
 */
export function createLanguageToggle(
  scene: LanguageToggleSceneLike,
  i18n: I18nService,
  onChange: (newLanguage: Language) => void,
): LanguageToggle {
  const width = scene.scale?.width ?? 1280;
  // Position: top-left corner (the mute button is top-right).
  const margin = 20;
  void width; // width is reserved for future layout adjustments; current
              // layout uses only `margin` from the left/top.

  const button = scene.add
    .text(margin, margin, flagFor(i18n.getLanguage()), {
      align: "center",
      backgroundColor: "#3d405b",
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "28px",
      padding: { x: 12, y: 8 },
    })
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  button.on("pointerup", () => {
    const newLang = i18n.toggle();
    button.setText(flagFor(newLang));
    onChange(newLang);
  });

  return {
    refresh() {
      button.setText(flagFor(i18n.getLanguage()));
    },
    getLanguage() {
      return i18n.getLanguage();
    },
  };
}
