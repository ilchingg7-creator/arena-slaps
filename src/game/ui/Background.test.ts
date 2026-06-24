import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createBackground } from "./Background";

/**
 * The Background component only uses a tiny subset of Phaser.Scene:
 *   - scene.scale.width / scene.scale.height (numbers)
 *   - scene.textures.exists(key) -> boolean
 *   - scene.add.image(x, y, key) -> { setDisplaySize(w,h), setDepth(d), destroy() }
 *   - scene.add.rectangle(x, y, w, h, color) -> { setDepth(d), destroy() }
 *
 * We build a stub scene that records every call AND tracks `destroyed`
 * flags on the returned game objects so we can assert that setKey /
 * destroy tear down the previous object. Because Background.ts uses
 * `import type Phaser from "phaser"` (type-only), Phaser is never loaded
 * at runtime in this test — no vi.mock needed.
 */

type ImageObj = {
  kind: "image";
  key: string;
  x: number;
  y: number;
  displaySize?: { w: number; h: number };
  depth: number;
  destroyed: boolean;
  setDisplaySize(w: number, h: number): ImageObj;
  setDepth(d: number): ImageObj;
  destroy(): void;
};

type RectObj = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  depth: number;
  destroyed: boolean;
  setDepth(d: number): RectObj;
  destroy(): void;
};

type StubScene = {
  scale: { width: number; height: number };
  textures: { exists: ReturnType<typeof vi.fn> };
  add: {
    image: ReturnType<typeof vi.fn>;
    rectangle: ReturnType<typeof vi.fn>;
  };
  images: ImageObj[];
  rects: RectObj[];
};

function makeImage(x: number, y: number, key: string): ImageObj {
  const obj: ImageObj = {
    kind: "image",
    key,
    x,
    y,
    depth: 0,
    destroyed: false,
    setDisplaySize(w, h) {
      this.displaySize = { w, h };
      return this;
    },
    setDepth(d) {
      this.depth = d;
      return this;
    },
    destroy() {
      this.destroyed = true;
    },
  };
  return obj;
}

function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): RectObj {
  const obj: RectObj = {
    kind: "rect",
    x,
    y,
    width,
    height,
    color,
    depth: 0,
    destroyed: false,
    setDepth(d) {
      this.depth = d;
      return this;
    },
    destroy() {
      this.destroyed = true;
    },
  };
  return obj;
}

function makeStubScene(
  opts: {
    loadedKeys?: ReadonlySet<string>;
    width?: number;
    height?: number;
  } = {},
): StubScene {
  const loadedKeys = opts.loadedKeys ?? new Set<string>();
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const images: ImageObj[] = [];
  const rects: RectObj[] = [];

  const image = vi.fn((x: number, y: number, key: string) => {
    const o = makeImage(x, y, key);
    images.push(o);
    return o;
  });

  const rectangle = vi.fn(
    (
      x: number,
      y: number,
      w: number,
      h: number,
      color: number,
    ) => {
      const o = makeRect(x, y, w, h, color);
      rects.push(o);
      return o;
    },
  );

  return {
    scale: { width, height },
    textures: { exists: vi.fn((k: string) => loadedKeys.has(k)) },
    add: { image, rectangle },
    images,
    rects,
  };
}

function asScene(stub: StubScene): Phaser.Scene {
  return stub as unknown as Phaser.Scene;
}

describe("Background", () => {
  it("uses scene.add.image at center coords, sets displaySize to full screen, and depth -100 when the texture is loaded", () => {
    const scene = makeStubScene({ loadedKeys: new Set(["menu-bg"]) });
    const bg = createBackground(asScene(scene), { key: "menu-bg" });
    expect(scene.images).toHaveLength(1);
    expect(scene.rects).toHaveLength(0);
    const img = scene.images[0];
    expect(img.key).toBe("menu-bg");
    expect(img.x).toBe(640); // width/2 = 1280/2
    expect(img.y).toBe(360); // height/2 = 720/2
    expect(img.displaySize).toEqual({ w: 1280, h: 720 });
    expect(img.depth).toBe(-100);
    expect(bg.gameObject).toBe(img);
  });

  it("falls back to a full-screen rectangle with manifest fallbackColor and depth -100 when the texture is missing", () => {
    const scene = makeStubScene(); // no loaded keys
    const bg = createBackground(asScene(scene), { key: "arena-bg" });
    expect(scene.rects).toHaveLength(1);
    expect(scene.images).toHaveLength(0);
    const rect = scene.rects[0];
    expect(rect.x).toBe(640);
    expect(rect.y).toBe(360);
    expect(rect.width).toBe(1280);
    expect(rect.height).toBe(720);
    expect(rect.color).toBe(0x1a1a2e); // arena-bg fallbackColor from manifest
    expect(rect.depth).toBe(-100);
    expect(bg.gameObject).toBe(rect);
  });

  it("uses def.fallbackColor from the manifest when config.fallbackColor is not provided", () => {
    const scene = makeStubScene();
    createBackground(asScene(scene), { key: "menu-bg" });
    expect(scene.rects[0].color).toBe(0x101820); // menu-bg manifest fallbackColor
  });

  it("uses config.fallbackColor when provided (overrides the manifest)", () => {
    const scene = makeStubScene();
    createBackground(asScene(scene), {
      key: "menu-bg",
      fallbackColor: 0xff00ff,
    });
    expect(scene.rects[0].color).toBe(0xff00ff);
  });

  it("throws for an unknown sprite key (delegates to getSpriteDefinition)", () => {
    const scene = makeStubScene();
    expect(() =>
      createBackground(asScene(scene), { key: "totally-fake-key" }),
    ).toThrowError(/No sprite definition/);
  });

  it("setKey destroys the old game object and creates a new one", () => {
    const scene = makeStubScene({
      loadedKeys: new Set(["menu-bg", "arena-bg"]),
    });
    const bg = createBackground(asScene(scene), { key: "menu-bg" });
    expect(scene.images).toHaveLength(1);
    const oldObj = scene.images[0];
    expect(oldObj.destroyed).toBe(false);

    bg.setKey("arena-bg");

    expect(oldObj.destroyed).toBe(true);
    expect(scene.images).toHaveLength(2);
    const newObj = scene.images[1];
    expect(newObj.key).toBe("arena-bg");
    expect(newObj.depth).toBe(-100);
    expect(newObj.displaySize).toEqual({ w: 1280, h: 720 });
    expect(bg.gameObject).toBe(newObj);
  });

  it("setKey also works when switching from a missing-texture rectangle to a loaded image", () => {
    // First key has no texture loaded -> rectangle fallback.
    // Second key has texture loaded -> image.
    const scene = makeStubScene({
      loadedKeys: new Set(["arena-bg"]),
    });
    const bg = createBackground(asScene(scene), { key: "menu-bg" });
    expect(scene.rects).toHaveLength(1);
    expect(scene.images).toHaveLength(0);
    const oldRect = scene.rects[0];

    bg.setKey("arena-bg");

    expect(oldRect.destroyed).toBe(true);
    expect(scene.images).toHaveLength(1);
    expect(scene.images[0].key).toBe("arena-bg");
    expect(bg.gameObject).toBe(scene.images[0]);
  });

  it("destroy destroys the current game object", () => {
    const scene = makeStubScene({ loadedKeys: new Set(["menu-bg"]) });
    const bg = createBackground(asScene(scene), { key: "menu-bg" });
    const obj = scene.images[0];
    expect(obj.destroyed).toBe(false);
    bg.destroy();
    expect(obj.destroyed).toBe(true);
  });
});
