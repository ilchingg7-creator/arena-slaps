import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AchievementsScene tests.
 *
 * The scene is a Phaser.Scene so we stub Phaser with the minimum surface
 * the scene actually uses during create():
 *   - add.rectangle / add.graphics / add.text
 *   - scale.width / scale.height
 *   - scene.start
 *   - input.keyboard.on
 *   - textures.exists (always false → forces fallback paths if any)
 *
 * The stubs record calls so we can assert that the neon redesign is in
 * place: at least one graphics() per card (drawNeonPanel) plus the
 * title/footer panels, and that achievement names render at ≥14px with
 * center alignment.
 */

// --- Recording helpers ----------------------------------------------------

type TextRec = {
  text: string;
  style: Record<string, unknown>;
};

function makeSceneStub() {
  const texts: TextRec[] = [];
  const graphicsCount = { value: 0 };
  const rectangleCount = { value: 0 };

  const textApi = () => {
    const chain = {
      setOrigin: vi.fn(() => chain),
      setInteractive: vi.fn(() => chain),
      setText: vi.fn(() => chain),
      on: vi.fn(() => chain),
      setAlpha: vi.fn(() => chain),
      setDepth: vi.fn(() => chain),
      setStyle: vi.fn(() => chain),
    };
    return chain;
  };

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
  }

  // StubbedButton (createStyledButton calls add.text + add.rectangle).
  const btnApi = {
    setOrigin: vi.fn(() => btnApi),
    setInteractive: vi.fn(() => btnApi),
    on: vi.fn(() => btnApi),
    setStyle: vi.fn(() => btnApi),
    setAlpha: vi.fn(() => btnApi),
    setDepth: vi.fn(() => btnApi),
  };

  const scene = {
    add: {
      text: vi.fn((x: number, y: number, text: string, style: unknown) => {
        texts.push({ text, style: (style ?? {}) as Record<string, unknown> });
        return textApi();
      }),
      graphics: vi.fn(() => {
        graphicsCount.value += 1;
        return new GraphicsStub();
      }),
      rectangle: vi.fn(() => {
        rectangleCount.value += 1;
        return {
          setDepth: vi.fn(() => ({})),
          setOrigin: vi.fn(() => ({})),
        };
      }),
      image: vi.fn(() => btnApi),
    },
    scale: { width: 1280, height: 720 },
    scene: { start: vi.fn() },
    input: { keyboard: { on: vi.fn() } },
    textures: { exists: () => false },
    events: { on: vi.fn(), emit: vi.fn() },
    registry: new Map<string, unknown>(),
    time: { now: 0 },
  };
  return {
    scene,
    texts,
    graphicsCount,
    rectangleCount,
  };
}

// Mock I18nService so translations are predictable.
vi.mock("../i18n/I18nService", () => ({
  I18nService: {
    load: () => ({
      t: (key: string) => {
        // Return the key verbatim — tests assert on text existence,
        // not on the localized string.
        return key;
      },
    }),
  },
}));

// Mock loadProfile so we don't depend on localStorage.
vi.mock("../config/profile", () => ({
  loadProfile: () => ({
    achievements: ["first_blood", "streak_5"],
    level: 5,
  }),
  DEFAULT_PROFILE: {},
}));

// Mock StyledButton — we don't want to exercise its internals here.
vi.mock("../ui/StyledButton", () => ({
  createStyledButton: vi.fn(() => ({})),
}));

// Mock drawNeonPanel — we want to count its invocations without
// exercising Phaser graphics.
let drawNeonPanelCalls = 0;
vi.mock("../ui/neonPrimitives", () => ({
  drawNeonPanel: vi.fn((scene: unknown) => {
    drawNeonPanelCalls += 1;
    // Return a minimal stub with setAlpha/setDepth — the scene chains these.
    return {
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
    };
  }),
}));

// Phaser stub — minimal surface used by the scene.
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

import { AchievementsScene, ACHIEVEMENT_CARD_LAYOUT } from "./AchievementsScene";

describe("AchievementsScene", () => {
  it("is a class", () => {
    expect(typeof AchievementsScene).toBe("function");
    expect(AchievementsScene.name).toBe("AchievementsScene");
  });

  it("can be instantiated without throwing", () => {
    const instance = new AchievementsScene();
    expect(instance).toBeInstanceOf(AchievementsScene);
  });

  it("exposes the card-grid layout constants for tests/inspection", () => {
    expect(ACHIEVEMENT_CARD_LAYOUT.cols).toBe(6);
    expect(ACHIEVEMENT_CARD_LAYOUT.rows).toBe(3);
    expect(ACHIEVEMENT_CARD_LAYOUT.cardW).toBeGreaterThanOrEqual(140);
    expect(ACHIEVEMENT_CARD_LAYOUT.cardH).toBeGreaterThanOrEqual(140);
  });

  describe("create()", () => {
    let stub: ReturnType<typeof makeSceneStub>;

    beforeEach(() => {
      stub = makeSceneStub();
      drawNeonPanelCalls = 0;
    });

    it("invokes drawNeonPanel once for the title, once for the footer, plus once per achievement card", () => {
      // We need to attach our stub's add methods onto a real scene
      // instance. The Phaser mock above returns its own stubs, but
      // AchievementsScene.create() uses `this.add` etc. — so we cast
      // the stub onto the scene instance directly.
      const scene = new AchievementsScene() as unknown as {
        add: unknown;
        scale: unknown;
        scene: unknown;
        input: unknown;
        textures: unknown;
        create: () => void;
      };
      // Replace the scene's Phaser-stubbed surface with our recording stub.
      (scene as Record<string, unknown>).add = stub.scene.add;
      (scene as Record<string, unknown>).scale = stub.scene.scale;
      (scene as Record<string, unknown>).scene = stub.scene.scene;
      (scene as Record<string, unknown>).input = stub.scene.input;
      (scene as Record<string, unknown>).textures = stub.scene.textures;

      scene.create();

      // 18 cards + 1 title panel + 1 footer panel = 20.
      expect(drawNeonPanelCalls).toBe(18 + 2);
    });

    it("renders a solid ink background rectangle (replaces the old menu-bg PNG)", () => {
      const scene = new AchievementsScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;

      (scene as { create: () => void }).create();

      expect(stub.rectangleCount.value).toBeGreaterThanOrEqual(1);
    });

    it("renders at least 18 achievement name texts at fontSize ≥ 14px with center alignment", () => {
      const scene = new AchievementsScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;

      (scene as { create: () => void }).create();

      // 18 achievement names + 18 icons + 18 descriptions + title +
      // footer = at least 18 of each "kind". Filter texts by style.
      const nameStyleTexts = stub.texts.filter((t) => {
        const style = t.style as { fontSize?: string; fontStyle?: string };
        return (
          style.fontSize === "14px" && style.fontStyle === "bold"
        );
      });
      expect(nameStyleTexts.length).toBe(18);
      for (const t of nameStyleTexts) {
        const style = t.style as { align?: string };
        expect(style.align).toBe("center");
      }
    });

    it("renders all 18 achievement descriptions (new — was not shown before)", () => {
      const scene = new AchievementsScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;

      (scene as { create: () => void }).create();

      const descStyleTexts = stub.texts.filter((t) => {
        const style = t.style as { fontSize?: string };
        return style.fontSize === "11px";
      });
      expect(descStyleTexts.length).toBe(18);
    });

    it("renders icons at 48px (was 32px — readability fix)", () => {
      const scene = new AchievementsScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;

      (scene as { create: () => void }).create();

      const iconTexts = stub.texts.filter((t) => {
        const style = t.style as { fontSize?: string };
        return style.fontSize === "48px";
      });
      expect(iconTexts.length).toBe(18);
    });

    it("transitions to MainMenuScene on ESC / ENTER", () => {
      const scene = new AchievementsScene() as unknown as Record<string, unknown>;
      scene.add = stub.scene.add;
      scene.scale = stub.scene.scale;
      scene.scene = stub.scene.scene;
      scene.input = stub.scene.input;
      scene.textures = stub.scene.textures;

      (scene as { create: () => void }).create();

      const keyboard = stub.scene.input.keyboard;
      expect(keyboard.on).toHaveBeenCalledWith("keydown-ESC", expect.any(Function));
      expect(keyboard.on).toHaveBeenCalledWith("keydown-ENTER", expect.any(Function));
    });
  });
});
