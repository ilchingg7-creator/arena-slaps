import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks for StyledButton + VolumeSlider ------------------------------
// PauseMenu composes both components. We mock them so the tests can drive
// button clicks directly and don't need to stand up the full Phaser add.*
// surface that the real components touch. Each created button stub records
// its config (so tests can find it by label) and exposes a `click()` helper
// that fires the captured onClick handler.

const { buttonStubs, sliderStubs } = vi.hoisted(() => ({
  buttonStubs: [] as Array<{
    config: {
      text: string;
      variant?: string;
      onClick: () => void;
    };
    visible: boolean;
    destroyed: boolean;
    setVisible: (v: boolean) => void;
    destroy: () => void;
    click: () => void;
  }>,
  sliderStubs: [] as Array<{
    destroyed: boolean;
    initialValue: number;
    onChange: (nextVolume: number) => void;
    setValue: ReturnType<typeof vi.fn>;
    getValue: ReturnType<typeof vi.fn>;
    handlePointerMove: ReturnType<typeof vi.fn>;
    endDrag: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("./StyledButton", () => ({
  createStyledButton: vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_scene: unknown, config: any) => {
      const stub = {
        config: {
          text: config.text as string,
          variant: config.variant as string | undefined,
          onClick: config.onClick as () => void,
        },
        visible: false,
        destroyed: false,
        depth: 0,
        setVisible(v: boolean) {
          stub.visible = v;
        },
        setDepth(d: number) {
          stub.depth = d;
        },
        destroy() {
          stub.destroyed = true;
        },
        click() {
          stub.config.onClick();
        },
      };
      buttonStubs.push(stub);
      return stub;
    },
  ),
}));

vi.mock("./VolumeSlider", () => ({
  createVolumeSlider: vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_scene: unknown, _x: number, _y: number, _w: number, initialValue: number, onChange: any) => {
      const stub = {
        destroyed: false,
        initialValue,
        onChange: onChange as (nextVolume: number) => void,
        setValue: vi.fn(),
        getValue: vi.fn(() => initialValue),
        handlePointerMove: vi.fn(),
        endDrag: vi.fn(),
        destroy: vi.fn(() => {
          stub.destroyed = true;
        }),
      };
      sliderStubs.push(stub);
      return stub;
    },
  ),
}));

import { createPauseMenu, type PauseMenu } from "./PauseMenu";

// --- Stub scene ---------------------------------------------------------
// Models the slice of Phaser's scene surface that PauseMenu touches
// directly: `add.rectangle` (overlay) and `add.text` (titles + labels).
// The mocked StyledButton + VolumeSlider don't call scene.add at all, so
// the stub doesn't need graphics/zone support.

type FakeRect = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha: number;
  depth: number;
  visible: boolean;
  origin: { x: number; y: number };
  destroyed: boolean;
};

type FakeText = {
  kind: "text";
  x: number;
  y: number;
  text: string;
  style: unknown;
  depth: number;
  visible: boolean;
  origin: { x: number; y: number };
  destroyed: boolean;
};

type FakeGraphics = {
  kind: "graphics";
  depth: number;
  visible: boolean;
  destroyed: boolean;
};

type FakeScene = {
  rects: FakeRect[];
  texts: FakeText[];
  graphicsObjects: FakeGraphics[];
  add: {
    rectangle: (
      x: number,
      y: number,
      w: number,
      h: number,
      color: number,
    ) => {
      setOrigin: (x?: number, y?: number) => unknown;
      setAlpha: (a: number) => unknown;
      setDepth: (d: number) => unknown;
      setVisible: (v: boolean) => unknown;
      destroy: () => void;
    };
    text: (
      x: number,
      y: number,
      value: string,
      style?: unknown,
    ) => {
      setOrigin: (x?: number, y?: number) => unknown;
      setDepth: (d: number) => unknown;
      setVisible: (v: boolean) => unknown;
      destroy: () => void;
    };
    graphics: () => {
      setDepth: (d: number) => unknown;
      setVisible: (v: boolean) => unknown;
      fillStyle: (color: number, alpha?: number) => unknown;
      fillRoundedRect: (
        x: number,
        y: number,
        w: number,
        h: number,
        radius?: number,
      ) => unknown;
      lineStyle: (width: number, color: number, alpha?: number) => unknown;
      strokeRoundedRect: (
        x: number,
        y: number,
        w: number,
        h: number,
        radius?: number,
      ) => unknown;
      destroy: () => void;
    };
  };
  scale: { width: number; height: number };
};

function makeScene(): FakeScene {
  const rects: FakeRect[] = [];
  const texts: FakeText[] = [];
  const graphicsObjects: FakeGraphics[] = [];

  const scene: FakeScene = {
    rects,
    texts,
    graphicsObjects,
    scale: { width: 1280, height: 720 },
    add: {
      rectangle(x, y, width, height, color) {
        const r: FakeRect = {
          kind: "rect",
          x,
          y,
          width,
          height,
          color,
          alpha: 1,
          depth: 0,
          visible: true,
          origin: { x: 0.5, y: 0.5 },
          destroyed: false,
        };
        rects.push(r);
        const proxy = {
          setOrigin(ox?: number, oy?: number) {
            r.origin = { x: ox ?? 0.5, y: oy ?? 0.5 };
            return proxy;
          },
          setAlpha(a: number) {
            r.alpha = a;
            return proxy;
          },
          setDepth(d: number) {
            r.depth = d;
            return proxy;
          },
          setVisible(v: boolean) {
            r.visible = v;
            return proxy;
          },
          destroy() {
            r.destroyed = true;
          },
        };
        return proxy;
      },
      text(x, y, value, style?) {
        const t: FakeText = {
          kind: "text",
          x,
          y,
          text: value,
          style,
          depth: 0,
          visible: true,
          origin: { x: 0.5, y: 0.5 },
          destroyed: false,
        };
        texts.push(t);
        const proxy = {
          setOrigin(ox?: number, oy?: number) {
            t.origin = { x: ox ?? 0.5, y: oy ?? 0.5 };
            return proxy;
          },
          setDepth(d: number) {
            t.depth = d;
            return proxy;
          },
          setVisible(v: boolean) {
            t.visible = v;
            return proxy;
          },
          destroy() {
            t.destroyed = true;
          },
        };
        return proxy;
      },
      graphics() {
        const g: FakeGraphics = {
          kind: "graphics",
          depth: 0,
          visible: true,
          destroyed: false,
        };
        graphicsObjects.push(g);
        const proxy = {
          setDepth(d: number) {
            g.depth = d;
            return proxy;
          },
          setVisible(v: boolean) {
            g.visible = v;
            return proxy;
          },
          fillStyle() {
            return proxy;
          },
          fillRoundedRect() {
            return proxy;
          },
          lineStyle() {
            return proxy;
          },
          strokeRoundedRect() {
            return proxy;
          },
          destroy() {
            g.destroyed = true;
          },
        };
        return proxy;
      },
    },
  };

  return scene;
}

function findText(texts: FakeText[], value: string): FakeText | undefined {
  return texts.find((t) => t.text === value);
}

function findButton(text: string) {
  return buttonStubs.find((b) => b.config.text === text);
}

function makeConfig(opts: {
  onResume?: () => void;
  onSettings?: () => void;
  onQuit?: () => void;
}) {
  return {
    battleSceneKey: "BattleScene",
    onResume: opts.onResume ?? (() => void 0),
    onSettings: opts.onSettings ?? (() => void 0),
    onQuit: opts.onQuit ?? (() => void 0),
  };
}

beforeEach(() => {
  buttonStubs.length = 0;
  sliderStubs.length = 0;
});

// --- Helpers for the M1 slider-wiring tests -----------------------------
// The audio + storage stubs model the slice of the real AudioService +
// localStorage surface that PauseMenu touches via its PauseMenuConfig.

function makeAudioStub() {
  return {
    updateSettings: vi.fn(),
  };
}

function makeSettingsStub(opts: {
  sfxVolume?: number;
  musicVolume?: number;
  sfxMuted?: boolean;
  musicMuted?: boolean;
} = {}) {
  return {
    mode: "1p-vs-bot" as const,
    botDifficulty: "medium" as const,
    roundLengthSeconds: 60,
    winningScore: 5,
    mapKey: "arena-default",
    sfxMuted: opts.sfxMuted ?? false,
    musicMuted: opts.musicMuted ?? false,
    sfxVolume: opts.sfxVolume ?? 0.7,
    musicVolume: opts.musicVolume ?? 0.5,
  };
}

function makeStorageStub() {
  return {
    setItem: vi.fn(),
    getItem: vi.fn(() => null),
  };
}

// --- Construction -------------------------------------------------------

describe("PauseMenu - construction", () => {
  it("creates a rectangle overlay + title text + 3 main buttons", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );

    // 1 full-screen overlay rectangle (dark, alpha 0.7).
    expect(scene.rects).toHaveLength(1);
    expect(scene.rects[0].color).toBe(0x000000);
    expect(scene.rects[0].alpha).toBeCloseTo(0.7, 5);

    // Title "Paused" text exists.
    const paused = findText(scene.texts, "Paused");
    expect(paused).toBeDefined();
    expect(scene.graphicsObjects.length).toBeGreaterThan(0);

    // 3 main buttons + 1 Back button (Back lives in the settings panel).
    expect(buttonStubs).toHaveLength(4);
    const labels = buttonStubs.map((b) => b.config.text);
    expect(labels).toContain("Продолжить");
    expect(labels).toContain("Настройки");
    expect(labels).toContain("Главное меню");
    expect(labels).toContain("Back");
  });

  it("overlay is rendered at depth 100 and content at depth 101", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(scene.rects[0].depth).toBe(100);
    const paused = findText(scene.texts, "Paused")!;
    expect(paused.depth).toBe(101);
  });

  it("uses the right button variants", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(findButton("Продолжить")!.config.variant).toBe("success");
    expect(findButton("Настройки")!.config.variant).toBe("secondary");
    expect(findButton("Главное меню")!.config.variant).toBe("danger");
  });

  it("creates 2 VolumeSliders for the inline settings panel", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(sliderStubs).toHaveLength(2);
  });
});

// --- Initial visibility -------------------------------------------------

describe("PauseMenu - initial visibility", () => {
  it("all elements are initially invisible", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );

    expect(scene.rects[0].visible).toBe(false);
    expect(findText(scene.texts, "Paused")!.visible).toBe(false);
    for (const label of ["Продолжить", "Настройки", "Главное меню", "Back"]) {
      expect(findButton(label)!.visible).toBe(false);
    }
    // Settings panel labels are hidden too.
    for (const label of ["Settings", "SFX Volume", "Music Volume"]) {
      const t = findText(scene.texts, label);
      if (t) expect(t.visible).toBe(false);
    }
  });

  it("isVisible() returns false initially", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(menu.isVisible()).toBe(false);
  });

  it("isSettingsVisible() returns false initially", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(menu.isSettingsVisible()).toBe(false);
  });
});

// --- show / hide --------------------------------------------------------

describe("PauseMenu - show / hide", () => {
  it("show() makes all main elements visible", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();

    expect(scene.rects[0].visible).toBe(true);
    expect(findText(scene.texts, "Paused")!.visible).toBe(true);
    for (const label of ["Продолжить", "Настройки", "Главное меню"]) {
      expect(findButton(label)!.visible).toBe(true);
    }
    // Settings panel stays hidden after show().
    expect(findButton("Back")!.visible).toBe(false);
  });

  it("hide() makes all main elements invisible", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.hide();

    expect(scene.rects[0].visible).toBe(false);
    expect(findText(scene.texts, "Paused")!.visible).toBe(false);
    for (const label of ["Продолжить", "Настройки", "Главное меню"]) {
      expect(findButton(label)!.visible).toBe(false);
    }
  });

  it("isVisible() returns true after show() and false after hide()", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(menu.isVisible()).toBe(false);
    menu.show();
    expect(menu.isVisible()).toBe(true);
    menu.hide();
    expect(menu.isVisible()).toBe(false);
  });

  it("show() resets settings panel state (settings hidden even if previously open)", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    expect(menu.isSettingsVisible()).toBe(true);
    menu.hide();
    menu.show();
    expect(menu.isSettingsVisible()).toBe(false);
    // Main buttons visible again.
    for (const label of ["Продолжить", "Настройки", "Главное меню"]) {
      expect(findButton(label)!.visible).toBe(true);
    }
  });

  it("hide() also hides the settings panel", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    menu.hide();
    expect(menu.isSettingsVisible()).toBe(false);
    expect(findButton("Back")!.visible).toBe(false);
  });
});

// --- Button clicks ------------------------------------------------------

describe("PauseMenu - button clicks", () => {
  it("clicking 'Продолжить' calls onResume + hide()", () => {
    const scene = makeScene();
    const onResume = vi.fn();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({ onResume }),
    );
    menu.show();
    findButton("Продолжить")!.click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(menu.isVisible()).toBe(false);
  });

  it("clicking 'Настройки' calls onSettings and keeps menu visible", () => {
    const scene = makeScene();
    const onSettings = vi.fn();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({ onSettings }),
    );
    menu.show();
    findButton("Настройки")!.click();
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(menu.isVisible()).toBe(true);
  });

  it("clicking 'Главное меню' calls onQuit", () => {
    const scene = makeScene();
    const onQuit = vi.fn();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({ onQuit }),
    );
    menu.show();
    findButton("Главное меню")!.click();
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it("clicking 'Главное меню' also hides the menu", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    findButton("Главное меню")!.click();
    expect(menu.isVisible()).toBe(false);
  });
});

// --- toggleSettings -----------------------------------------------------

describe("PauseMenu - toggleSettings", () => {
  it("toggleSettings() flips isSettingsVisible()", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    expect(menu.isSettingsVisible()).toBe(false);
    menu.toggleSettings();
    expect(menu.isSettingsVisible()).toBe(true);
    menu.toggleSettings();
    expect(menu.isSettingsVisible()).toBe(false);
  });

  it("showing settings panel hides the 3 main buttons + title", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    for (const label of ["Продолжить", "Настройки", "Главное меню"]) {
      expect(findButton(label)!.visible).toBe(false);
    }
    expect(findText(scene.texts, "Paused")!.visible).toBe(false);
  });

  it("showing settings panel reveals the Back button + settings labels", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    expect(findButton("Back")!.visible).toBe(true);
    const settingsTitle = findText(scene.texts, "Settings");
    if (settingsTitle) expect(settingsTitle.visible).toBe(true);
  });

  it("still toggles pause settings visibility while rendering a framed overlay", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    expect(scene.rects.length).toBeGreaterThan(0);
    expect(scene.graphicsObjects.length).toBeGreaterThan(0);
    menu.toggleSettings();
    expect(menu.isSettingsVisible()).toBe(true);
  });

  it("toggling back restores the main buttons + title", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    menu.toggleSettings();
    for (const label of ["Продолжить", "Настройки", "Главное меню"]) {
      expect(findButton(label)!.visible).toBe(true);
    }
    expect(findText(scene.texts, "Paused")!.visible).toBe(true);
    expect(findButton("Back")!.visible).toBe(false);
  });

  it("Back button click toggles settings panel off", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    expect(menu.isSettingsVisible()).toBe(true);
    findButton("Back")!.click();
    expect(menu.isSettingsVisible()).toBe(false);
  });

  it("overlay stays visible while settings panel is shown", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.show();
    menu.toggleSettings();
    expect(scene.rects[0].visible).toBe(true);
    expect(menu.isVisible()).toBe(true);
  });
});

// --- destroy ------------------------------------------------------------

describe("PauseMenu - destroy", () => {
  it("destroy() removes the overlay + title", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.destroy();
    expect(scene.rects[0].destroyed).toBe(true);
    expect(findText(scene.texts, "Paused")!.destroyed).toBe(true);
  });

  it("destroy() removes all 4 buttons (3 main + Back)", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.destroy();
    for (const label of ["Продолжить", "Настройки", "Главное меню", "Back"]) {
      expect(findButton(label)!.destroyed).toBe(true);
    }
  });

  it("destroy() removes the settings panel text labels", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.destroy();
    const settingsTitle = findText(scene.texts, "Settings");
    if (settingsTitle) expect(settingsTitle.destroyed).toBe(true);
  });

  it("destroy() destroys both VolumeSliders", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.destroy();
    expect(sliderStubs).toHaveLength(2);
    for (const s of sliderStubs) {
      expect(s.destroyed).toBe(true);
    }
  });
});

// --- PauseMenu type                                                  ---

describe("PauseMenu - type contract", () => {
  it("returns an object with the full PauseMenu API", () => {
    const scene = makeScene();
    const menu: PauseMenu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(typeof menu.show).toBe("function");
    expect(typeof menu.hide).toBe("function");
    expect(typeof menu.isVisible).toBe("function");
    expect(typeof menu.destroy).toBe("function");
    expect(typeof menu.toggleSettings).toBe("function");
    expect(typeof menu.isSettingsVisible).toBe("function");
    // M1: pointer-forwarding methods exposed so the owning scene can
    // wire global pointermove/up events through to the sliders.
    expect(typeof menu.handlePointerMove).toBe("function");
    expect(typeof menu.endDrag).toBe("function");
  });
});

// --- M1: slider onChange wiring -----------------------------------------
// The inline SFX/Music sliders previously had `onChange: () => void 0` —
// dragging them did nothing. The fix routes the slider's value through
// `audio.updateSettings(...)` so the player hears the change immediately,
// and persists it to `storage` so it survives a page reload.

describe("PauseMenu - M1 slider wiring", () => {
  it("creates the SFX slider with the current settings.sfxVolume as the initial value", () => {
    const scene = makeScene();
    const settings = makeSettingsStub({ sfxVolume: 0.3 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        settings,
      },
    );
    // sliderStubs[0] is the SFX slider (created first in the panel build).
    expect(sliderStubs[0].initialValue).toBeCloseTo(0.3, 5);
  });

  it("creates the Music slider with the current settings.musicVolume as the initial value", () => {
    const scene = makeScene();
    const settings = makeSettingsStub({ musicVolume: 0.8 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        settings,
      },
    );
    // sliderStubs[1] is the Music slider.
    expect(sliderStubs[1].initialValue).toBeCloseTo(0.8, 5);
  });

  it("SFX slider onChange pushes the new volume through audio.updateSettings", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const settings = makeSettingsStub({ sfxVolume: 0.7 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
      },
    );
    sliderStubs[0].onChange(0.42);
    expect(audio.updateSettings).toHaveBeenCalledTimes(1);
    expect(audio.updateSettings).toHaveBeenCalledWith({
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.42,
      musicVolume: 0.5,
    });
  });

  it("Music slider onChange pushes the new volume through audio.updateSettings", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const settings = makeSettingsStub({ musicVolume: 0.5 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
      },
    );
    sliderStubs[1].onChange(0.9);
    expect(audio.updateSettings).toHaveBeenCalledTimes(1);
    expect(audio.updateSettings).toHaveBeenCalledWith({
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.9,
    });
  });

  it("SFX slider onChange mutates the shared settings object", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const settings = makeSettingsStub({ sfxVolume: 0.7 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
      },
    );
    sliderStubs[0].onChange(0.25);
    expect(settings.sfxVolume).toBeCloseTo(0.25, 5);
    // Music volume is untouched.
    expect(settings.musicVolume).toBeCloseTo(0.5, 5);
  });

  it("Music slider onChange mutates the shared settings object", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const settings = makeSettingsStub({ musicVolume: 0.5 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
      },
    );
    sliderStubs[1].onChange(0.65);
    expect(settings.musicVolume).toBeCloseTo(0.65, 5);
    expect(settings.sfxVolume).toBeCloseTo(0.7, 5);
  });

  it("persists the new volume to storage when provided (SFX)", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const storage = makeStorageStub();
    const settings = makeSettingsStub({ sfxVolume: 0.7 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
        storage,
      },
    );
    sliderStubs[0].onChange(0.42);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    // The payload is a JSON blob containing the new sfxVolume.
    const payload = storage.setItem.mock.calls[0][1] as string;
    const parsed = JSON.parse(payload) as { sfxVolume: number };
    expect(parsed.sfxVolume).toBeCloseTo(0.42, 5);
  });

  it("persists the new volume to storage when provided (Music)", () => {
    const scene = makeScene();
    const audio = makeAudioStub();
    const storage = makeStorageStub();
    const settings = makeSettingsStub({ musicVolume: 0.5 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        audio,
        settings,
        storage,
      },
    );
    sliderStubs[1].onChange(0.85);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const payload = storage.setItem.mock.calls[0][1] as string;
    const parsed = JSON.parse(payload) as { musicVolume: number };
    expect(parsed.musicVolume).toBeCloseTo(0.85, 5);
  });

  it("does NOT call audio.updateSettings when audio is not provided (legacy)", () => {
    // Without audio in the config, slider drags should silently no-op.
    // This preserves backward-compat with the original unit tests that
    // don't construct an AudioService.
    const scene = makeScene();
    const settings = makeSettingsStub({ sfxVolume: 0.7 });
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      {
        ...makeConfig({}),
        settings,
      },
    );
    expect(() => sliderStubs[0].onChange(0.42)).not.toThrow();
    // Settings should still be mutated (the slider's contract is
    // "write into settings if provided").
    expect(settings.sfxVolume).toBeCloseTo(0.42, 5);
  });

  it("does NOT throw when neither audio nor settings is provided (legacy)", () => {
    const scene = makeScene();
    createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    expect(() => sliderStubs[0].onChange(0.42)).not.toThrow();
    expect(() => sliderStubs[1].onChange(0.42)).not.toThrow();
  });

  it("handlePointerMove forwards to both sliders", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    const pointer = { x: 100, y: 200, isDown: true };
    menu.handlePointerMove(pointer);
    expect(sliderStubs[0].handlePointerMove).toHaveBeenCalledTimes(1);
    expect(sliderStubs[0].handlePointerMove).toHaveBeenCalledWith(pointer);
    expect(sliderStubs[1].handlePointerMove).toHaveBeenCalledTimes(1);
    expect(sliderStubs[1].handlePointerMove).toHaveBeenCalledWith(pointer);
  });

  it("endDrag forwards to both sliders", () => {
    const scene = makeScene();
    const menu = createPauseMenu(
      scene as unknown as Parameters<typeof createPauseMenu>[0],
      makeConfig({}),
    );
    menu.endDrag();
    expect(sliderStubs[0].endDrag).toHaveBeenCalledTimes(1);
    expect(sliderStubs[1].endDrag).toHaveBeenCalledTimes(1);
  });
});
