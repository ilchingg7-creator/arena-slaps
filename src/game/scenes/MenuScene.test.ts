import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock Phaser so that even if a transitive import (via BattleScene/ResultsScene)
// tries to load it, we don't crash in the node test environment. Without this,
// the second dynamic `import("./BattleScene")` inside MenuScene.create() can
// reject (Phaser touches `window`/`document` at load time), which would mask
// the B6 bug we're trying to assert against.
vi.mock("phaser", () => {
  class Scene {}
  return {
    default: {
      Scene,
      Geom: { Rectangle: class {} },
      Input: { Keyboard: { JustDown: () => false, KeyCodes: {} } },
      Math: { Vector2: class {}, Distance: { Between: () => 0 } },
    },
    Scene,
  };
});

// Mock the dynamically-imported scenes so MenuScene.create() can resolve its
// Promise.all([import("./BattleScene"), import("./ResultsScene")]) without
// pulling in the real Phaser-dependent scene modules.
vi.mock("./BattleScene", () => ({ BattleScene: { name: "BattleScene" } }));
vi.mock("./ResultsScene", () => ({ ResultsScene: { name: "ResultsScene" } }));

import { MenuScene } from "./MenuScene";

type TextHandlers = Record<string, (...args: unknown[]) => void>;

interface StubText {
  on: (event: string, handler: () => void) => StubText;
  setInteractive: () => StubText;
  setOrigin: () => StubText;
  setText: (value: string) => StubText;
  handlers: TextHandlers;
}

interface StubRectangle {
  setOrigin: () => StubRectangle;
  setDepth: () => StubRectangle;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface StubZone {
  setInteractive: () => StubZone;
  on: () => StubZone;
  removeAllListeners?: () => StubZone;
}

function makeStubText(): StubText {
  const handlers: TextHandlers = {};
  const self: StubText = {
    on(event, handler) {
      handlers[event] = handler as () => void;
      return self;
    },
    setInteractive() {
      return self;
    },
    setOrigin() {
      return self;
    },
    setText() {
      return self;
    },
    handlers,
  };
  return self;
}

function makeStubRectangle(): StubRectangle {
  const self: StubRectangle = {
    setOrigin() {
      return self;
    },
    setDepth() {
      return self;
    },
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  };
  return self;
}

function makeStubZone(): StubZone {
  const self: StubZone = {
    setInteractive() {
      return self;
    },
    on() {
      return self;
    },
    removeAllListeners() {
      return self;
    },
  };
  return self;
}

interface StubContext {
  add: {
    text: () => StubText;
    rectangle: () => StubRectangle;
    zone: () => StubZone;
  };
  input: {
    keyboard: { on: (event: string, handler: () => void) => void };
  };
  scene: {
    add: (key: string, scene: unknown, autoStart?: boolean) => void;
    get: (key: string) => unknown;
    start: (key: string, data?: unknown) => void;
  };
  scale: { width: number; height: number };
  sound: { play: (key: string, config?: { volume?: number }) => unknown };
}

interface StubBundle {
  context: StubContext;
  texts: StubText[];
  addedScenes: Array<{ key: string; autoStart?: boolean }>;
  addedSceneKeys: Set<string>;
  playCalls: Array<{ key: string; volume?: number }>;
}

function makeStubContext(): StubBundle {
  const texts: StubText[] = [];
  const addedScenes: Array<{ key: string; autoStart?: boolean }> = [];
  const addedSceneKeys = new Set<string>();
  const playCalls: Array<{ key: string; volume?: number }> = [];

  const context: StubContext = {
    add: {
      text: () => {
        const t = makeStubText();
        texts.push(t);
        return t;
      },
      rectangle: () => makeStubRectangle(),
      zone: () => makeStubZone(),
    },
    input: {
      keyboard: { on: () => void 0 },
    },
    scene: {
      add: (key, _scene, autoStart) => {
        addedScenes.push({ key, autoStart });
        addedSceneKeys.add(key);
      },
      get: (key) => (addedSceneKeys.has(key) ? {} : null),
      start: () => void 0,
    },
    scale: { width: 1280, height: 720 },
    sound: {
      play: (key, config) => {
        playCalls.push({ key, volume: config?.volume });
        return undefined;
      },
    },
  };

  return { context, texts, addedScenes, addedSceneKeys, playCalls };
}

// Flush the microtask queue + the dynamic-import Promise.all chain that
// MenuScene.create() schedules. Vitest's mock for dynamic imports resolves
// the import promise asynchronously (not on the microtask queue), and two
// consecutive Promise.all([...]).then(...) chains need a few macrotask
// ticks to fully drain. We wait a fixed 150ms which is plenty for the
// mock-resolved imports to flush their .then callbacks while keeping the
// test fast.
async function flushDynamicImports(): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));
}

describe("MenuScene", () => {
  beforeEach(() => {
    // createAudioService checks `typeof window === "undefined"`; if true it
    // falls back to NoopAudioBackend. Stub a minimal window so the real
    // PhaserAudioBackend path is exercised, which delegates to scene.sound.play.
    vi.stubGlobal("window", { localStorage: undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("B1: cycling a setting plays menu-click via scene.sound.play", async () => {
    const { context, texts, playCalls } = makeStubContext();
    MenuScene.create.call(context);
    await flushDynamicImports();

    // modeValue is the 3rd text object created (index 2):
    //   0: startButton
    //   1: modeRow
    //   2: modeValue
    const modeValue = texts[2];
    expect(modeValue.handlers.pointerup).toBeDefined();
    modeValue.handlers.pointerup();

    const menuClickCalls = playCalls.filter((c) => c.key === "menu-click");
    expect(menuClickCalls.length).toBeGreaterThan(0);
  });

  it("B6: calling create() twice adds BattleScene and ResultsScene at most once each", async () => {
    const { context, addedScenes } = makeStubContext();
    MenuScene.create.call(context);
    MenuScene.create.call(context);
    await flushDynamicImports();

    const battleAdds = addedScenes.filter(
      (s) => s.key === "BattleScene",
    ).length;
    const resultsAdds = addedScenes.filter(
      (s) => s.key === "ResultsScene",
    ).length;
    expect(battleAdds).toBe(1);
    expect(resultsAdds).toBe(1);
  });
});
