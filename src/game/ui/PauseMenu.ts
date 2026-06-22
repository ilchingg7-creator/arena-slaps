/**
 * Pause menu overlay for the BattleScene.
 *
 * Renders:
 *   - A semi-transparent dark rectangle covering the whole screen (alpha 0.7,
 *     depth 100) — the "dim" overlay that visually separates the paused
 *     battle from the menu.
 *   - A centered "Paused" title (depth 101).
 *   - 3 StyledButtons (depth 101, managed by StyledButton internally):
 *       "Продолжить"  (success)  -> onResume() + hide()
 *       "Настройки"   (secondary) -> onSettings() (menu stays visible — the
 *                                    caller is responsible for calling
 *                                    toggleSettings() to reveal the inline
 *                                    settings panel).
 *       "Главное меню" (danger)   -> onQuit() + hide()
 *   - An inline settings panel (initially hidden) with 2 VolumeSliders
 *     (SFX + Music) and a "Back" button that returns to the main pause
 *     menu. The panel is toggled via {@link PauseMenu.toggleSettings}.
 *
 * The menu does NOT pause the scene itself — the caller is responsible
 * for calling `scene.pause(battleSceneKey)` when showing and
 * `scene.resume()` when hiding. This keeps the pause menu reusable
 * (a future "spectator mode" overlay, for example, could reuse the same
 * component without the pause side-effect).
 *
 * VolumeSlider doesn't expose its underlying game objects, so to toggle
 * their visibility collectively we intercept `scene.add.rectangle` /
 * `scene.add.text` / `scene.add.zone` / `scene.add.graphics` during the
 * settings panel build phase and record every object created. The Back
 * button is created AFTER restoring `scene.add` so its underlying
 * StyledButton graphics/text aren't double-tracked (StyledButton.destroy
 * already destroys them).
 */

import type Phaser from "phaser";
import {
  createStyledButton,
  type ButtonSceneLike,
  type StyledButton,
} from "./StyledButton";
import {
  createVolumeSlider,
  type SliderSceneLike,
  type VolumeSlider,
} from "./VolumeSlider";
import type { I18nService } from "../i18n/I18nService";
import type { TranslationKey } from "../config/translations";
import type { AudioSettings } from "../audio/AudioService";
import type { GameSettings } from "../config/gameSettings";
import { saveSettings } from "../config/gameSettings";

/**
 * Minimal storage surface PauseMenu needs to persist volume slider changes.
 * Compatible with the global `Storage` and the `StorageLike` type used
 * internally by gameSettings.ts (so callers can pass either).
 */
export type PauseStorageLike = {
  setItem?: (key: string, value: string) => void;
};

/**
 * Duck-typed AudioService surface PauseMenu needs to push live volume
 * changes through. Real {@link AudioService} instances satisfy this shape.
 */
export type PauseAudioLike = {
  updateSettings: (settings: AudioSettings) => void;
};

export type PauseMenuConfig = {
  /** The scene that should be resumed/quit (typically the BattleScene). */
  battleSceneKey: string;
  /** Called when the user clicks "Продолжить". */
  onResume: () => void;
  /** Called when the user clicks "Настройки". */
  onSettings: () => void;
  /** Called when the user clicks "Главное меню". */
  onQuit: () => void;
  /**
   * Optional i18n service. When provided, all menu strings (title, button
   * labels, settings panel labels) are read from the translation table
   * via `i18n.t(key)`. When omitted, the legacy hardcoded strings are
   * used (kept for backward compatibility with the PauseMenu unit tests
   * that don't construct an I18nService).
   */
  i18n?: I18nService;
  /**
   * Shared audio service. When provided alongside `settings`, the inline
   * volume sliders push live changes through `audio.updateSettings(...)`
   * so the player hears SFX/music volume changes immediately (M1 fix).
   * When omitted, slider drags are a no-op (preserves the legacy test
   * behaviour where sliders had `onChange: () => void 0`).
   */
  audio?: PauseAudioLike;
  /**
   * Mutable settings object the sliders write back into. When omitted,
   * slider drags don't persist anywhere.
   */
  settings?: GameSettings;
  /**
   * Optional storage backend. When provided alongside `settings`, slider
   * drags are persisted via `saveSettings(storage, settings)` so the new
   * volumes survive a page reload.
   */
  storage?: PauseStorageLike | null;
};

export type PauseMenu = {
  /** Show the pause menu (called when Esc is pressed). */
  show: () => void;
  /** Hide the pause menu (called when Resume is clicked). */
  hide: () => void;
  /** Is the menu currently visible? */
  isVisible: () => boolean;
  /** Destroy all UI elements. */
  destroy: () => void;
  /** Toggle the inline settings panel (SFX + Music volume sliders). */
  toggleSettings: () => void;
  /** Is the settings panel currently shown? */
  isSettingsVisible: () => boolean;
  /**
   * Forward a global pointermove event to every settings slider so the
   * drag stays alive when the pointer leaves the slider's hit zone (M1).
   * The owning scene wires `scene.input.on("pointermove", ...)` to this.
   */
  handlePointerMove: (pointer: { x: number; y: number; isDown: boolean }) => void;
  /**
   * End the current drag on every settings slider. The owning scene wires
   * `scene.input.on("pointerup", ...)` to this (M1).
   */
  endDrag: () => void;
};

// --- Scene duck types --------------------------------------------------
// PauseMenu only touches a thin slice of Phaser.Scene: `add.rectangle`,
// `add.text`, `add.graphics` (via StyledButton), `add.zone` (via
// VolumeSlider), and `scale.width` / `scale.height`. We keep the duck type
// minimal so the unit test can pass a plain stub object.

type VisibleDestroyable = {
  setVisible: (v: boolean) => unknown;
  destroy: () => unknown;
};

type PauseRectangle = VisibleDestroyable & {
  setOrigin: (x?: number, y?: number) => PauseRectangle;
  setAlpha: (a: number) => PauseRectangle;
  setDepth: (d: number) => PauseRectangle;
};

type PauseText = VisibleDestroyable & {
  setOrigin: (x?: number, y?: number) => PauseText;
  setDepth: (d: number) => PauseText;
};

type PauseAdd = {
  rectangle: (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
  ) => PauseRectangle;
  text: (
    x: number,
    y: number,
    value: string,
    style?: unknown,
  ) => PauseText;
  graphics?: (config?: unknown) => VisibleDestroyable;
  zone?: (
    x: number,
    y: number,
    w: number,
    h: number,
  ) => VisibleDestroyable;
};

type PauseSceneLike = {
  add: PauseAdd;
  scale?: { width?: number; height?: number };
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const OVERLAY_DEPTH = 100;
const CONTENT_DEPTH = 101;
const OVERLAY_ALPHA = 0.7;
const OVERLAY_COLOR = 0x000000;

const TITLE_STYLE = {
  color: "#f4f1de",
  fontFamily: "Arial",
  fontSize: "48px",
  fontStyle: "bold",
} as const;

const SETTINGS_TITLE_STYLE = {
  color: "#f4f1de",
  fontFamily: "Arial",
  fontSize: "42px",
  fontStyle: "bold",
} as const;

const LABEL_STYLE = {
  color: "#f4f1de",
  fontFamily: "Arial",
  fontSize: "22px",
} as const;

/**
 * Create a pause menu overlay. The menu is initially hidden.
 *
 * The caller is responsible for pausing/resuming the battle scene:
 *   - On Esc press:   `pauseMenu.show(); scene.pause(battleSceneKey);`
 *   - On Resume click: `pauseMenu.hide()` is called internally; the
 *     `onResume` callback should call `scene.resume()`.
 */
export function createPauseMenu(
  scene: Phaser.Scene,
  config: PauseMenuConfig,
): PauseMenu {
  const s = scene as unknown as PauseSceneLike;
  const width = s.scale?.width ?? DEFAULT_WIDTH;
  const height = s.scale?.height ?? DEFAULT_HEIGHT;
  const centerX = width / 2;
  const centerY = height / 2;

  // --- Strings: use i18n when provided, otherwise fall back to the
  // legacy hardcoded values (matching the original PauseMenu tests).
  const tr = (key: TranslationKey, fallback: string): string =>
    config.i18n ? config.i18n.t(key) : fallback;

  const TITLE_TEXT = tr("pause.title", "Paused");
  const RESUME_TEXT = tr("pause.resume", "Продолжить");
  const SETTINGS_TEXT = tr("pause.settings", "Настройки");
  const QUIT_TEXT = tr("pause.mainMenu", "Главное меню");
  const SETTINGS_TITLE_TEXT = tr("pause.settingsTitle", "Settings");
  const SFX_VOLUME_TEXT = tr("audio.sfxVolume", "SFX Volume");
  const MUSIC_VOLUME_TEXT = tr("audio.musicVolume", "Music Volume");
  const BACK_TEXT = tr("pause.back", "Back");

  // --- Main menu elements (overlay + title + 3 buttons) ----------------
  // These are created with the ORIGINAL scene.add — they're managed
  // individually (not via the settings-panel tracking list).
  const overlay = s.add
    .rectangle(centerX, centerY, width, height, OVERLAY_COLOR)
    .setAlpha(OVERLAY_ALPHA)
    .setDepth(OVERLAY_DEPTH);
  overlay.setVisible(false);

  const title = s.add
    .text(centerX, centerY - 180, TITLE_TEXT, TITLE_STYLE)
    .setOrigin(0.5, 0.5)
    .setDepth(CONTENT_DEPTH);
  title.setVisible(false);

  const mainButtons: StyledButton[] = [];

  const resumeButton = createStyledButton(
    s as unknown as ButtonSceneLike,
    {
      x: centerX,
      y: centerY - 60,
      text: RESUME_TEXT,
      variant: "success",
      onClick: () => {
        config.onResume();
        hide();
      },
    },
  );
  resumeButton.setVisible(false);
  mainButtons.push(resumeButton);

  const settingsButton = createStyledButton(
    s as unknown as ButtonSceneLike,
    {
      x: centerX,
      y: centerY + 10,
      text: SETTINGS_TEXT,
      variant: "secondary",
      onClick: () => {
        // The menu stays visible — the caller's onSettings callback is
        // responsible for calling toggleSettings() to reveal the inline
        // settings panel (or doing whatever else it wants).
        config.onSettings();
      },
    },
  );
  settingsButton.setVisible(false);
  mainButtons.push(settingsButton);

  const quitButton = createStyledButton(
    s as unknown as ButtonSceneLike,
    {
      x: centerX,
      y: centerY + 80,
      text: QUIT_TEXT,
      variant: "danger",
      onClick: () => {
        config.onQuit();
        hide();
      },
    },
  );
  quitButton.setVisible(false);
  mainButtons.push(quitButton);

  // --- Inline settings panel -------------------------------------------
  // VolumeSlider doesn't expose its underlying game objects, so to toggle
  // their visibility collectively we intercept scene.add during the
  // settings panel build phase and record every object created. The
  // Back button (StyledButton) is created AFTER restoring scene.add so
  // its underlying graphics/text aren't double-tracked.
  const settingsPrimitives: VisibleDestroyable[] = [];
  const settingsSliders: VolumeSlider[] = [];
  const settingsComposites: VisibleDestroyable[] = [];

  const origAdd = s.add;
  // Object.create(origAdd) inherits all methods (image, container, etc.)
  // from the original add factory, so any method we don't override falls
  // through unchanged. We override only the methods that create objects
  // we want to track.
  const trackingAdd = Object.create(origAdd) as PauseAdd;
  trackingAdd.rectangle = (...args) => {
    const obj = origAdd.rectangle(...args);
    settingsPrimitives.push(obj);
    return obj;
  };
  trackingAdd.text = (...args) => {
    const obj = origAdd.text(...args);
    settingsPrimitives.push(obj);
    return obj;
  };
  if (typeof origAdd.graphics === "function") {
    trackingAdd.graphics = (config?: unknown) => {
      const obj = origAdd.graphics!(config);
      settingsPrimitives.push(obj);
      return obj;
    };
  }
  if (typeof origAdd.zone === "function") {
    trackingAdd.zone = (x: number, y: number, w: number, h: number) => {
      const obj = origAdd.zone!(x, y, w, h);
      settingsPrimitives.push(obj);
      return obj;
    };
  }

  let backButton: StyledButton | null = null;

  // Swap scene.add to the tracking version, build the settings panel
  // text labels + sliders, then restore.
  s.add = trackingAdd;
  try {
    // Settings title
    s.add
      .text(centerX, centerY - 180, SETTINGS_TITLE_TEXT, SETTINGS_TITLE_STYLE)
      .setOrigin(0.5, 0.5)
      .setDepth(CONTENT_DEPTH)
      .setVisible(false);

    // SFX row
    s.add
      .text(centerX - 220, centerY - 80, SFX_VOLUME_TEXT, LABEL_STYLE)
      .setOrigin(0, 0.5)
      .setDepth(CONTENT_DEPTH)
      .setVisible(false);

    const sfxSlider = createVolumeSlider(
      s as unknown as SliderSceneLike,
      centerX + 60,
      centerY - 80,
      240,
      config.settings?.sfxVolume ?? 0.7,
      (nextVolume) => {
        applySfxVolume(nextVolume);
      },
    );
    settingsSliders.push(sfxSlider);

    // Music row
    s.add
      .text(centerX - 220, centerY + 20, MUSIC_VOLUME_TEXT, LABEL_STYLE)
      .setOrigin(0, 0.5)
      .setDepth(CONTENT_DEPTH)
      .setVisible(false);

    const musicSlider = createVolumeSlider(
      s as unknown as SliderSceneLike,
      centerX + 60,
      centerY + 20,
      240,
      config.settings?.musicVolume ?? 0.5,
      (nextVolume) => {
        applyMusicVolume(nextVolume);
      },
    );
    settingsSliders.push(musicSlider);
  } finally {
    s.add = origAdd;
  }

  // Defensive: ensure every tracked primitive is hidden initially. The
  // labels above already call setVisible(false), but VolumeSlider's
  // internal objects (track/fill/handle/label/zone) are created visible
  // by default — hide them now.
  for (const obj of settingsPrimitives) {
    obj.setVisible(false);
  }

  // Create the Back button OUTSIDE the tracking phase so its underlying
  // graphics + text (managed by StyledButton) aren't double-tracked.
  backButton = createStyledButton(s as unknown as ButtonSceneLike, {
    x: centerX,
    y: centerY + 120,
    text: BACK_TEXT,
    variant: "secondary",
    onClick: () => {
      toggleSettings();
    },
  });
  backButton.setVisible(false);
  settingsComposites.push(backButton);

  // --- State + methods -------------------------------------------------
  let visible = false;
  let settingsVisible = false;

  /**
   * Push a new SFX volume through the live AudioService + persist it into
   * the shared settings object (and localStorage when available). No-op
   * when the menu was constructed without `audio` / `settings` (M1 fix).
   */
  function applySfxVolume(nextVolume: number): void {
    const settings = config.settings;
    if (!settings) {
      return;
    }
    settings.sfxVolume = nextVolume;
    if (config.audio) {
      config.audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
    }
    if (config.storage) {
      saveSettings(config.storage, settings);
    }
  }

  /**
   * Push a new Music volume through the live AudioService + persist it into
   * the shared settings object (and localStorage when available). No-op
   * when the menu was constructed without `audio` / `settings` (M1 fix).
   */
  function applyMusicVolume(nextVolume: number): void {
    const settings = config.settings;
    if (!settings) {
      return;
    }
    settings.musicVolume = nextVolume;
    if (config.audio) {
      config.audio.updateSettings({
        sfxMuted: settings.sfxMuted,
        musicMuted: settings.musicMuted,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
    }
    if (config.storage) {
      saveSettings(config.storage, settings);
    }
  }

  function showMainButtons(v: boolean): void {
    for (const btn of mainButtons) {
      btn.setVisible(v);
    }
  }

  function showSettingsPanel(v: boolean): void {
    for (const obj of settingsPrimitives) {
      obj.setVisible(v);
    }
    for (const comp of settingsComposites) {
      comp.setVisible(v);
    }
  }

  function show(): void {
    visible = true;
    settingsVisible = false;
    overlay.setVisible(true);
    title.setVisible(true);
    showMainButtons(true);
    showSettingsPanel(false);
  }

  function hide(): void {
    visible = false;
    settingsVisible = false;
    overlay.setVisible(false);
    title.setVisible(false);
    showMainButtons(false);
    showSettingsPanel(false);
  }

  function toggleSettings(): void {
    settingsVisible = !settingsVisible;
    // The "Paused" title and 3 main buttons are hidden when the settings
    // panel is shown, and vice versa. The overlay stays visible throughout.
    title.setVisible(!settingsVisible);
    showMainButtons(!settingsVisible);
    showSettingsPanel(settingsVisible);
  }

  function isVisible(): boolean {
    return visible;
  }

  function isSettingsVisible(): boolean {
    return settingsVisible;
  }

  function destroy(): void {
    // 1. Remove slider hit-zone listeners WHILE THE ZONES STILL EXIST.
    //    VolumeSlider.destroy() only calls hitZone.removeAllListeners —
    //    if we destroy the zones first, removeAllListeners might error.
    for (const slider of settingsSliders) {
      slider.destroy();
    }
    // 2. Destroy tracked primitives (rectangles + texts + zones created
    //    by VolumeSlider + our own text labels).
    for (const obj of settingsPrimitives) {
      obj.destroy();
    }
    // 3. Destroy composites (Back button — destroys its graphics + text).
    for (const comp of settingsComposites) {
      comp.destroy();
    }
    // 4. Destroy main menu elements.
    overlay.destroy();
    title.destroy();
    for (const btn of mainButtons) {
      btn.destroy();
    }
  }

  function handlePointerMove(pointer: {
    x: number;
    y: number;
    isDown: boolean;
  }): void {
    for (const slider of settingsSliders) {
      slider.handlePointerMove(pointer);
    }
  }

  function endDrag(): void {
    for (const slider of settingsSliders) {
      slider.endDrag();
    }
  }

  return {
    show,
    hide,
    isVisible,
    destroy,
    toggleSettings,
    isSettingsVisible,
    handlePointerMove,
    endDrag,
  };
}
