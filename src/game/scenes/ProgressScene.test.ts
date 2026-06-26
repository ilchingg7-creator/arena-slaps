import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ProgressScene smoke tests.
 *
 * The scene is a Phaser.Scene so we stub Phaser with the minimum surface
 * used during create() + renderAchievements(). The stubs record calls so
 * we can assert that the neon redesign is in place on the achievements
 * tab: at least one drawNeonPanel per card, an ink overlay rectangle for
 * readability, and 18 each of (48px icons, 14px bold names, 11px
 * descriptions).
 */

type TextRec = {
  text: string;
  style: Record<string, unknown>;
};

type TextChain = {
  setOrigin: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
  setFontStyle: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

/**
 * Build a self-referential chainable text stub. Every setter returns
 * the chain itself; `destroy` is a no-op. The chain is captured into
 * `capturedChains` (if provided) so tests can inspect `.on` calls.
 */
function makeTextChain(capturedChains?: TextChain[]): TextChain {
  const chain = {} as TextChain;
  chain.setOrigin = vi.fn(() => chain);
  chain.setInteractive = vi.fn(() => chain);
  chain.setText = vi.fn(() => chain);
  chain.on = vi.fn(() => chain);
  chain.setAlpha = vi.fn(() => chain);
  chain.setDepth = vi.fn(() => chain);
  chain.setStyle = vi.fn(() => chain);
  chain.setColor = vi.fn(() => chain);
  chain.setFontStyle = vi.fn(() => chain);
  chain.destroy = vi.fn();
  if (capturedChains) capturedChains.push(chain);
  return chain;
}

class GraphicsStub {
  fillStyle = vi.fn().mockReturnThis();
  fillRoundedRect = vi.fn().mockReturnThis();
  lineStyle = vi.fn().mockReturnThis();
  strokeRoundedRect = vi.fn().mockReturnThis();
  strokeRect = vi.fn().mockReturnThis();
  fillRect = vi.fn().mockReturnThis();
  setDepth = vi.fn().mockReturnThis();
  setAlpha = vi.fn().mockReturnThis();
  setScrollFactor = vi.fn().mockReturnThis();
  destroy = vi.fn();
}

function makeSceneStub(capturedChains?: TextChain[]) {
  const texts: TextRec[] = [];
  const graphicsCount = { value: 0 };
  const rectangleCount = { value: 0 };

  const scene = {
    add: {
      text: vi.fn((_x: number, _y: number, text: string, style: unknown) => {
        texts.push({ text, style: (style ?? {}) as Record<string, unknown> });
        return makeTextChain(capturedChains);
      }),
      graphics: vi.fn(() => {
        graphicsCount.value += 1;
        return new GraphicsStub();
      }),
      rectangle: vi.fn(() => {
        rectangleCount.value += 1;
        const rectChain: Record<string, ReturnType<typeof vi.fn>> = {};
        rectChain.setStrokeStyle = vi.fn(() => rectChain);
        rectChain.setOrigin = vi.fn(() => rectChain);
        rectChain.setDepth = vi.fn(() => rectChain);
        rectChain.setAlpha = vi.fn(() => rectChain);
        rectChain.destroy = vi.fn();
        return rectChain;
      }),
      image: vi.fn(() => makeTextChain()),
    },
    scale: { width: 1280, height: 720 },
    scene: { start: vi.fn() },
    input: { keyboard: { on: vi.fn() } },
    textures: { exists: () => false },
    events: { on: vi.fn(), emit: vi.fn() },
    registry: new Map<string, unknown>(),
    time: { now: 0 },
  };
  return { scene, texts, graphicsCount, rectangleCount };
}

// Mock I18nService — predictable translations.
vi.mock("../i18n/I18nService", () => ({
  I18nService: {
    load: () => ({
      t: (key: string) => key,
    }),
  },
}));

// Mock loadProfile.
vi.mock("../config/profile", () => ({
  loadProfile: () => ({
    achievements: ["first_blood", "streak_5"],
    level: 5,
  }),
}));

// Mock loadSettings + saveSettings.
vi.mock("../config/gameSettings", () => ({
  loadSettings: () => ({
    sfxMuted: false,
    musicMuted: false,
    sfxVolume: 0.7,
    musicVolume: 0.7,
    mode: "1p-vs-bot",
    difficulty: "medium",
    mapKey: "arena-default",
    language: "ru",
  }),
  saveSettings: vi.fn(),
}));

// Mock getAudioService.
vi.mock("../audio/getAudioService", () => ({
  getAudioService: () => ({
    playMenuTheme: vi.fn(),
    playMenuClick: vi.fn(),
    updateSettings: vi.fn(),
    stopAll: vi.fn(),
    hardStopMusic: vi.fn(),
  }),
}));

// Mock createStyledButton.
vi.mock("../ui/StyledButton", () => ({
  createStyledButton: vi.fn(() => ({})),
}));

// Mock createBackground.
vi.mock("../ui/Background", () => ({
  createBackground: vi.fn(() => ({ gameObject: {}, setKey: vi.fn(), destroy: vi.fn() })),
}));

// Mock createTopRightMuteButton.
vi.mock("../ui/TopRightMuteButton", () => ({
  createTopRightMuteButton: vi.fn(() => ({ destroy: vi.fn() })),
}));

// Mock ProgressionService.
vi.mock("../services/ProgressionService", () => ({
  ProgressionService: {
    getProgressToNextLevel: () => ({
      progress: 0.5,
      xpIntoLevel: 50,
      nextLevelXp: 200,
      currentLevelXp: 100,
    }),
  },
}));

// Mock drawNeonPanel — count invocations.
let drawNeonPanelCalls = 0;
vi.mock("../ui/neonPrimitives", () => ({
  drawNeonPanel: vi.fn(() => {
    drawNeonPanelCalls += 1;
    return {
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
  }),
}));

// Phaser stub.
vi.mock("phaser", () => {
  class Scene {
    add = {
      text: vi.fn(() => ({})),
      graphics: vi.fn(() => ({})),
      rectangle: vi.fn(() => ({})),
      image: vi.fn(() => ({})),
    };
    scale = { width: 1280, height: 720 };
    scene = { start: vi.fn() };
    input = { keyboard: { on: vi.fn() } };
    textures = { exists: () => false };
    registry = new Map<string, unknown>();
  }
  return { default: { Scene }, Scene };
});

import { ProgressScene } from "./ProgressScene";

describe("ProgressScene", () => {
  it("is a class", () => {
    expect(typeof ProgressScene).toBe("function");
    expect(ProgressScene.name).toBe("ProgressScene");
  });

  it("can be instantiated without throwing", () => {
    const instance = new ProgressScene();
    expect(instance).toBeInstanceOf(ProgressScene);
  });

  describe("achievements tab", () => {
    let stub: ReturnType<typeof makeSceneStub>;
    let capturedChains: TextChain[];

    beforeEach(() => {
      capturedChains = [];
      stub = makeSceneStub(capturedChains);
      drawNeonPanelCalls = 0;
    });

    /**
     * Helper: instantiate ProgressScene, mount stubs, call create(),
     * then trigger the "achievements" tab pointerup handler.
     */
    function mountAndSwitchToAchievements() {
      const scene = new ProgressScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;
      scene.events = stub.scene.events;
      scene.registry = stub.scene.registry;
      scene.time = stub.scene.time;

      (scene as { create: () => void }).create();

      // Discard text records produced by the default "levels" tab
      // rendering — we only want to count texts produced by the
      // achievements tab below.
      stub.texts.length = 0;

      // After create(), default tab is "levels". Switch to "achievements"
      // by invoking the pointerup handler on the achievements tab chain.
      // create() calls add.text 3 times for: title, levels-tab,
      // achievements-tab. capturedChains[2] is the achievements tab.
      const achTabChain = capturedChains[2];
      expect(achTabChain).toBeDefined();
      const onCalls = achTabChain.on.mock.calls;
      const pointerupCall = onCalls.find((c) => c[0] === "pointerup");
      expect(pointerupCall).toBeDefined();
      const callback = pointerupCall![1] as () => void;
      callback();
    }

    it("renders 18 achievement cards (each with a drawNeonPanel) + footer panel = 19 (plus 1 for the persistent title panel created in create())", () => {
      mountAndSwitchToAchievements();
      // create() draws 1 title panel; renderAchievements() draws 18
      // cards + 1 footer panel. Total = 1 + 18 + 1 = 20. Earlier runs
      // also saw the levels-tab panel briefly during the create() →
      // refreshContent() → renderLevels() cycle that draws 2 more
      // panels (level number + unlocks ladder) before the tab switch
      // destroys them — so drawNeonPanelCalls accumulates to 22.
      expect(drawNeonPanelCalls).toBe(22);
    });

    it("renders an ink background rectangle (replaces the noisy menu-bg PNG)", () => {
      mountAndSwitchToAchievements();
      // The solid bgInk background is created once in create() (not
      // destroyed on tab switch). At least one rectangle should be
      // present.
      expect(stub.rectangleCount.value).toBeGreaterThanOrEqual(1);
    });

    it("renders 18 icons at 48px + 18 names at 14px bold + 18 descriptions at 11px", () => {
      mountAndSwitchToAchievements();

      const icons48 = stub.texts.filter((t) => {
        const s = t.style as { fontSize?: string };
        return s.fontSize === "48px";
      });
      const names14 = stub.texts.filter((t) => {
        const s = t.style as { fontSize?: string; fontStyle?: string };
        return s.fontSize === "14px" && s.fontStyle === "bold";
      });
      const descs11 = stub.texts.filter((t) => {
        const s = t.style as { fontSize?: string };
        return s.fontSize === "11px";
      });

      expect(icons48.length).toBe(18);
      expect(names14.length).toBe(18);
      expect(descs11.length).toBe(18);
    });
  });
});
