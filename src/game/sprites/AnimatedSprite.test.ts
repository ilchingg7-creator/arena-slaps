import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createAnimatedSprite } from "./AnimatedSprite";

/**
 * The AnimatedSprite only uses a tiny subset of Phaser.Scene + Image:
 *   - scene.add.image(x, y, key) -> Image
 *   - image.setTexture(key)
 *   - image.setTint(color)
 *   - image.clearTint()
 *   - image.setPosition(x, y)
 *   - image.x / image.y (read)
 *   - image.destroy()
 *
 * We build a stub scene + image that record every call so we can assert
 * the wrapper's behaviour. Because AnimatedSprite.ts uses
 * `import type Phaser from "phaser"` (type-only), Phaser is never loaded
 * at runtime in this test — no vi.mock needed.
 */

type ImageLike = {
  x: number;
  y: number;
  setTexture: ReturnType<typeof vi.fn>;
  setTint: ReturnType<typeof vi.fn>;
  clearTint: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

type StubScene = {
  add: {
    image: ReturnType<typeof vi.fn>;
  };
  // Recorded data:
  imageCalls: { x: number; y: number; key: string }[];
  createdImages: ImageLike[];
};

function makeStubScene(): StubScene {
  const imageCalls: { x: number; y: number; key: string }[] = [];
  const createdImages: ImageLike[] = [];

  const image = vi.fn((x: number, y: number, key: string) => {
    imageCalls.push({ x, y, key });
    const img: ImageLike = {
      x,
      y,
      setTexture: vi.fn((k: string) => {
        // Update internal key for assertions if needed — image itself has
        // no texture state in the stub, but we record the call.
        void k;
      }),
      setTint: vi.fn(),
      clearTint: vi.fn(),
      setPosition: vi.fn((px: number, py: number) => {
        img.x = px;
        img.y = py;
      }),
      destroy: vi.fn(),
    };
    createdImages.push(img);
    return img;
  });

  return {
    add: { image },
    imageCalls,
    createdImages,
  };
}

function asScene(stub: StubScene): Phaser.Scene {
  return stub as unknown as Phaser.Scene;
}

describe("AnimatedSprite", () => {
  it("createAnimatedSprite calls scene.add.image with `${prefix}-idle` key", () => {
    const scene = makeStubScene();
    createAnimatedSprite(asScene(scene), { prefix: "player", x: 10, y: 20 });
    expect(scene.imageCalls).toHaveLength(1);
    expect(scene.imageCalls[0]).toEqual({ x: 10, y: 20, key: "player-idle" });
  });

  it("createAnimatedSprite for bot prefix uses `bot-idle` key", () => {
    const scene = makeStubScene();
    createAnimatedSprite(asScene(scene), { prefix: "bot", x: 5, y: 7 });
    expect(scene.imageCalls[0].key).toBe("bot-idle");
  });

  it("setState('run-n') calls setTexture with `${prefix}-run-n`", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setState("run-n");
    const img = scene.createdImages[0];
    expect(img.setTexture).toHaveBeenCalledWith("player-run-n");
  });

  it("setState('slap') calls setTexture with `${prefix}-slap`", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "bot",
      x: 0,
      y: 0,
    });
    sprite.setState("slap");
    const img = scene.createdImages[0];
    expect(img.setTexture).toHaveBeenCalledWith("bot-slap");
  });

  it("setState('fall') calls setTexture with `${prefix}-fall`", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setState("fall");
    expect(scene.createdImages[0].setTexture).toHaveBeenCalledWith(
      "player-fall",
    );
  });

  it("getState returns 'idle' right after creation", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    expect(sprite.getState()).toBe("idle");
  });

  it("getState returns the current state after setState", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setState("run-e");
    expect(sprite.getState()).toBe("run-e");
    sprite.setState("slap");
    expect(sprite.getState()).toBe("slap");
  });

  it("setState is a no-op (doesn't call setTexture) when state is unchanged", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setState("run-n");
    expect(scene.createdImages[0].setTexture).toHaveBeenCalledTimes(1);
    // Calling again with the same state should NOT trigger another setTexture.
    sprite.setState("run-n");
    expect(scene.createdImages[0].setTexture).toHaveBeenCalledTimes(1);
  });

  it("setEffectTint(0x81b29a) calls setTint with that color", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setEffectTint(0x81b29a);
    expect(scene.createdImages[0].setTint).toHaveBeenCalledWith(0x81b29a);
    expect(scene.createdImages[0].clearTint).not.toHaveBeenCalled();
  });

  it("setEffectTint(null) calls clearTint", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setEffectTint(0x81b29a);
    sprite.setEffectTint(null);
    expect(scene.createdImages[0].clearTint).toHaveBeenCalledTimes(1);
  });

  it("setEffectTint is a no-op when the tint is unchanged", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setEffectTint(0x88ccff);
    expect(scene.createdImages[0].setTint).toHaveBeenCalledTimes(1);
    // Same tint again — no-op.
    sprite.setEffectTint(0x88ccff);
    expect(scene.createdImages[0].setTint).toHaveBeenCalledTimes(1);
    // Different tint — calls setTint again.
    sprite.setEffectTint(0x3d405b);
    expect(scene.createdImages[0].setTint).toHaveBeenCalledTimes(2);
  });

  it("getEffectTint returns null right after creation", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    expect(sprite.getEffectTint()).toBeNull();
  });

  it("getEffectTint returns the last applied tint", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setEffectTint(0xe07a5f);
    expect(sprite.getEffectTint()).toBe(0xe07a5f);
    sprite.setEffectTint(null);
    expect(sprite.getEffectTint()).toBeNull();
  });

  it("setPosition updates the image position", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.setPosition(123, 456);
    expect(scene.createdImages[0].setPosition).toHaveBeenCalledWith(123, 456);
  });

  it("getPosition returns the current position", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 10,
      y: 20,
    });
    // Right after creation, position matches the config.
    expect(sprite.getPosition()).toEqual({ x: 10, y: 20 });
    // After setPosition, getPosition reflects the new position.
    sprite.setPosition(200, 300);
    expect(sprite.getPosition()).toEqual({ x: 200, y: 300 });
  });

  it("destroy calls destroy on the image", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    sprite.destroy();
    expect(scene.createdImages[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("gameObject is exposed read-only and points to the underlying Image", () => {
    const scene = makeStubScene();
    const sprite = createAnimatedSprite(asScene(scene), {
      prefix: "player",
      x: 0,
      y: 0,
    });
    expect(sprite.gameObject).toBe(scene.createdImages[0]);
  });
});
