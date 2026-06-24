import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { SpriteManager } from "./SpriteManager";

/**
 * The SpriteManager only uses a tiny subset of Phaser.Scene:
 *   - scene.textures.exists(key) -> boolean
 *   - scene.add.image(x, y, key) -> { setDisplaySize(w, h) }
 *   - scene.add.circle(x, y, radius, color) -> object
 *   - scene.add.rectangle(x, y, w, h, color) -> object
 *   - scene.physics.add.existing(obj) -> void
 *
 * We build a stub scene that records every call so we can assert which
 * primitive the manager picked. Because SpriteManager.ts uses
 * `import type Phaser from "phaser"` (type-only), Phaser is never loaded
 * at runtime in this test — no vi.mock needed.
 */

type ImageCall = {
  key: string;
  x: number;
  y: number;
  displaySize?: { w: number; h: number };
};
type CircleCall = { x: number; y: number; radius: number; color: number };
type RectangleCall = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
};
type PhysicsCall = { obj: unknown };

type StubScene = {
  textures: { exists: ReturnType<typeof vi.fn> };
  add: {
    image: ReturnType<typeof vi.fn>;
    circle: ReturnType<typeof vi.fn>;
    rectangle: ReturnType<typeof vi.fn>;
  };
  physics: { add: { existing: ReturnType<typeof vi.fn> } };
  // Recorded calls:
  imageCalls: ImageCall[];
  circleCalls: CircleCall[];
  rectangleCalls: RectangleCall[];
  physicsCalls: PhysicsCall[];
};

function makeStubScene(loadedKeys: ReadonlySet<string> = new Set()): StubScene {
  const imageCalls: ImageCall[] = [];
  const circleCalls: CircleCall[] = [];
  const rectangleCalls: RectangleCall[] = [];
  const physicsCalls: PhysicsCall[] = [];

  const image = vi.fn((x: number, y: number, key: string) => {
    const call: ImageCall = { key, x, y };
    imageCalls.push(call);
    return {
      setDisplaySize(w: number, h: number) {
        call.displaySize = { w, h };
        return this;
      },
    };
  });

  const circle = vi.fn(
    (x: number, y: number, radius: number, color: number) => {
      circleCalls.push({ x, y, radius, color });
      return {};
    },
  );

  const rectangle = vi.fn(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
    ) => {
      rectangleCalls.push({ x, y, width, height, color });
      return {};
    },
  );

  const existing = vi.fn((obj: unknown) => {
    physicsCalls.push({ obj });
  });

  return {
    textures: { exists: vi.fn((k: string) => loadedKeys.has(k)) },
    add: { image, circle, rectangle },
    physics: { add: { existing } },
    imageCalls,
    circleCalls,
    rectangleCalls,
    physicsCalls,
  };
}

function asScene(stub: StubScene): Phaser.Scene {
  return stub as unknown as Phaser.Scene;
}

describe("SpriteManager", () => {
  it("isLoaded returns false when the texture is not in the cache", () => {
    const scene = makeStubScene(new Set());
    const mgr = new SpriteManager(asScene(scene));
    expect(mgr.isLoaded("player-idle")).toBe(false);
  });

  it("isLoaded returns true when the texture is in the cache", () => {
    const scene = makeStubScene(new Set(["player-idle"]));
    const mgr = new SpriteManager(asScene(scene));
    expect(mgr.isLoaded("player-idle")).toBe(true);
  });

  it("createSprite with forceFallback returns a rectangle for player-idle", () => {
    const scene = makeStubScene(new Set(["player-idle"])); // texture IS loaded
    const mgr = new SpriteManager(asScene(scene), { forceFallback: true });
    mgr.createSprite("player-idle", 10, 20);
    expect(scene.rectangleCalls).toHaveLength(1);
    expect(scene.rectangleCalls[0]).toEqual({
      x: 10,
      y: 20,
      width: 36, // default size when def.width/height are undefined
      height: 36,
      color: 0x3d405b, // fallbackColor from manifest
    });
    expect(scene.imageCalls).toHaveLength(0);
    expect(scene.circleCalls).toHaveLength(0);
  });

  it("createSprite with forceFallback returns a circle for powerup-speed", () => {
    const scene = makeStubScene(new Set(["powerup-speed"]));
    const mgr = new SpriteManager(asScene(scene), { forceFallback: true });
    mgr.createSprite("powerup-speed", 5, 7);
    expect(scene.circleCalls).toHaveLength(1);
    expect(scene.circleCalls[0]).toEqual({
      x: 5,
      y: 7,
      radius: 18, // (def.width ?? 36) / 2
      color: 0x81b29a, // fallbackColor from manifest
    });
    expect(scene.imageCalls).toHaveLength(0);
    expect(scene.rectangleCalls).toHaveLength(0);
  });

  it("createSprite falls back to a rectangle when texture is missing (no forceFallback)", () => {
    const scene = makeStubScene(new Set()); // nothing loaded
    const mgr = new SpriteManager(asScene(scene));
    mgr.createSprite("player-idle", 0, 0);
    expect(scene.rectangleCalls).toHaveLength(1);
    expect(scene.imageCalls).toHaveLength(0);
  });

  it("createSprite falls back to a circle when texture is missing (no forceFallback)", () => {
    const scene = makeStubScene(new Set());
    const mgr = new SpriteManager(asScene(scene));
    mgr.createSprite("powerup-speed", 0, 0);
    expect(scene.circleCalls).toHaveLength(1);
    expect(scene.imageCalls).toHaveLength(0);
  });

  it("createSprite uses Image when the texture IS loaded", () => {
    const scene = makeStubScene(new Set(["player-idle"]));
    const mgr = new SpriteManager(asScene(scene));
    mgr.createSprite("player-idle", 12, 34);
    expect(scene.imageCalls).toHaveLength(1);
    expect(scene.imageCalls[0]).toEqual({ key: "player-idle", x: 12, y: 34 });
    // No displaySize call because player-idle has no width/height in the manifest.
    expect(scene.imageCalls[0].displaySize).toBeUndefined();
    expect(scene.rectangleCalls).toHaveLength(0);
    expect(scene.circleCalls).toHaveLength(0);
  });

  it("createSprite throws for an unknown key", () => {
    const scene = makeStubScene();
    const mgr = new SpriteManager(asScene(scene));
    expect(() => mgr.createSprite("totally-fake-key", 0, 0)).toThrowError(
      /No sprite definition/,
    );
  });

  it("createPhysicsSprite delegates to createSprite then calls physics.add.existing", () => {
    const scene = makeStubScene(new Set()); // force fallback path
    const mgr = new SpriteManager(asScene(scene));
    mgr.createPhysicsSprite("player-idle", 100, 200);
    expect(scene.rectangleCalls).toHaveLength(1);
    expect(scene.physicsCalls).toHaveLength(1);
    expect(scene.physicsCalls[0].obj).toBeDefined();
  });

  it("createPhysicsSprite also works for the circle fallback", () => {
    const scene = makeStubScene(new Set());
    const mgr = new SpriteManager(asScene(scene));
    mgr.createPhysicsSprite("powerup-speed", 1, 2);
    expect(scene.circleCalls).toHaveLength(1);
    expect(scene.physicsCalls).toHaveLength(1);
  });

  it("createPhysicsSprite does not double-add physics when texture IS loaded (image path)", () => {
    const scene = makeStubScene(new Set(["player-idle"]));
    const mgr = new SpriteManager(asScene(scene));
    mgr.createPhysicsSprite("player-idle", 0, 0);
    expect(scene.imageCalls).toHaveLength(1);
    expect(scene.physicsCalls).toHaveLength(1);
  });

  it("forceFallback defaults to false (image is used when texture is loaded)", () => {
    const scene = makeStubScene(new Set(["player-idle"]));
    const mgr = new SpriteManager(asScene(scene));
    mgr.createSprite("player-idle", 0, 0);
    expect(scene.imageCalls).toHaveLength(1);
    expect(scene.rectangleCalls).toHaveLength(0);
  });
});
