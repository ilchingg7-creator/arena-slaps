import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import {
  createPowerUpSprite,
  POWERUP_SPRITE_KEYS,
  type PowerUpSpriteScene,
} from "./PowerUpSprite";
import type { PowerUpEffect } from "../config/powerUpConfig";

/**
 * The PowerUpSprite only uses a tiny subset of Phaser.Scene + Image:
 *   - scene.add.image(x, y, key) -> Image
 *   - image.x / image.y (read & write)
 *   - image.setVisible(boolean)
 *   - image.setAlpha(number)
 *   - image.setScale(number, number)  (used by playSpawnAnimation)
 *   - image.setPosition(x, y)
 *   - image.destroy()
 *   - scene.tweens.add({ targets, scaleX, scaleY, alpha, duration, ease,
 *                        onComplete })  (used by the 3 animation methods)
 *
 * We build a stub scene + image that record every call so we can assert
 * the wrapper's behaviour. Because PowerUpSprite.ts uses
 * `import type Phaser from "phaser"` (type-only), Phaser is never loaded
 * at runtime in this test — no vi.mock needed.
 */

type StubImage = {
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
  scaleX: number;
  scaleY: number;
  setVisible: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

/**
 * Recorded shape of every `scene.tweens.add({...})` call. The stub's
 * `tweens.add` just pushes the config into `tweenCalls` — tests can then
 * assert the targets / props / duration / ease, and `flushTween(index)`
 * invokes the recorded `onComplete` (if any) to simulate the tween
 * finishing.
 */
type TweenConfig = {
  targets: unknown;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  duration?: number;
  ease?: string;
  onComplete?: () => void;
};

type StubScene = {
  add: {
    image: ReturnType<typeof vi.fn>;
  };
  tweens: {
    add: ReturnType<typeof vi.fn>;
  };
  // Recorded data:
  imageCalls: { x: number; y: number; key: string }[];
  createdImages: StubImage[];
  tweenCalls: TweenConfig[];
};

function makeStubScene(): StubScene {
  const imageCalls: { x: number; y: number; key: string }[] = [];
  const createdImages: StubImage[] = [];
  const tweenCalls: TweenConfig[] = [];

  const image = vi.fn((x: number, y: number, key: string) => {
    imageCalls.push({ x, y, key });
    const img: StubImage = {
      x,
      y,
      alpha: 1,
      visible: true,
      scaleX: 1,
      scaleY: 1,
      setVisible: vi.fn((v: boolean) => {
        img.visible = v;
        return img;
      }),
      setAlpha: vi.fn((a: number) => {
        img.alpha = a;
        return img;
      }),
      setScale: vi.fn((sx: number, sy: number) => {
        img.scaleX = sx;
        img.scaleY = sy;
        return img;
      }),
      setPosition: vi.fn((px: number, py: number) => {
        img.x = px;
        img.y = py;
        return img;
      }),
      destroy: vi.fn(),
    };
    createdImages.push(img);
    return img;
  });

  const tweensAdd = vi.fn((config: TweenConfig) => {
    tweenCalls.push(config);
  });

  return {
    add: { image },
    tweens: { add: tweensAdd },
    imageCalls,
    createdImages,
    tweenCalls,
  };
}

function asScene(stub: StubScene): PowerUpSpriteScene {
  // The stub satisfies PowerUpSpriteScene directly (it has add.image and
  // tweens.add with compatible signatures). We cast through unknown to
  // bypass TypeScript's structural check on the vi.fn() return type
  // (Mock vs. the concrete function signatures in PowerUpSpriteScene).
  return stub as unknown as PowerUpSpriteScene;
}

/**
 * Invoke the recorded `onComplete` of the tween at `index`. Simulates the
 * Phaser tween system firing its completion callback after `duration` ms.
 * No-op (and throws a clear error) if that tween has no `onComplete`.
 */
function flushTween(scene: StubScene, index = 0): void {
  const config = scene.tweenCalls[index];
  if (!config) {
    throw new Error(`flushTween: no tween at index ${index}`);
  }
  if (typeof config.onComplete !== "function") {
    throw new Error(
      `flushTween: tween at index ${index} has no onComplete callback`,
    );
  }
  config.onComplete();
}

const EFFECTS: PowerUpEffect[] = [
  "speed",
  "knockback",
  "shield",
  "mega-knockback",
  "freeze",
  "double-slap",
];

describe("PowerUpSprite", () => {
  describe("createPowerUpSprite", () => {
    it.each(EFFECTS)(
      "calls scene.add.image with the correct key for '%s'",
      (effect) => {
        const scene = makeStubScene();
        createPowerUpSprite(asScene(scene), effect, 100, 200);

        expect(scene.imageCalls).toHaveLength(1);
        expect(scene.imageCalls[0].key).toBe(POWERUP_SPRITE_KEYS[effect]);
        expect(scene.imageCalls[0].key).toBe(`powerup-${effect}`);
        expect(scene.imageCalls[0].x).toBe(100);
        expect(scene.imageCalls[0].y).toBe(200);
      },
    );

    it("creates the underlying image at the requested position", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "shield", 42, 7);

      expect(scene.createdImages).toHaveLength(1);
      expect(sprite.gameObject).toBe(scene.createdImages[0] as unknown);
      expect(scene.createdImages[0].x).toBe(42);
      expect(scene.createdImages[0].y).toBe(7);
    });
  });

  describe("default state", () => {
    it("setState('idle') is the default state", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      expect(sprite.getState()).toBe("idle");
    });

    it("does not change alpha or visibility at construction", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0);

      const img = scene.createdImages[0];
      expect(img.alpha).toBe(1);
      expect(img.visible).toBe(true);
      expect(img.setAlpha).not.toHaveBeenCalled();
      expect(img.setVisible).not.toHaveBeenCalled();
    });
  });

  describe("setState", () => {
    it("setState('collected') sets alpha to 0", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.setState("collected");

      expect(sprite.getState()).toBe("collected");
      expect(scene.createdImages[0].setAlpha).toHaveBeenCalledTimes(1);
      expect(scene.createdImages[0].setAlpha).toHaveBeenCalledWith(0);
      expect(scene.createdImages[0].alpha).toBe(0);
    });

    it("setState('despawning') sets the state but doesn't change visuals", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      const alphaBefore = scene.createdImages[0].alpha;
      const visibleBefore = scene.createdImages[0].visible;

      sprite.setState("despawning");

      expect(sprite.getState()).toBe("despawning");
      // No visual change — blinking is driven externally via setVisible.
      expect(scene.createdImages[0].alpha).toBe(alphaBefore);
      expect(scene.createdImages[0].visible).toBe(visibleBefore);
      expect(scene.createdImages[0].setAlpha).not.toHaveBeenCalled();
      expect(scene.createdImages[0].setVisible).not.toHaveBeenCalled();
    });

    it("setState('idle') sets the state and doesn't change visuals", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      // Flip to collected first to ensure setState('idle') doesn't reset alpha.
      sprite.setState("collected");
      expect(scene.createdImages[0].alpha).toBe(0);

      sprite.setState("idle");
      expect(sprite.getState()).toBe("idle");
      // Alpha is NOT reset back to 1 — "idle" is a no-op visual state.
      expect(scene.createdImages[0].alpha).toBe(0);
    });

    it("setState can be called multiple times (last write wins)", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.setState("despawning");
      sprite.setState("collected");
      sprite.setState("idle");

      expect(sprite.getState()).toBe("idle");
    });
  });

  describe("setVisible", () => {
    it("setVisible(false) calls setVisible(false) on the image", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.setVisible(false);

      expect(scene.createdImages[0].setVisible).toHaveBeenCalledTimes(1);
      expect(scene.createdImages[0].setVisible).toHaveBeenCalledWith(false);
      expect(scene.createdImages[0].visible).toBe(false);
    });

    it("setVisible(true) calls setVisible(true) on the image", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.setVisible(false);
      expect(scene.createdImages[0].visible).toBe(false);

      sprite.setVisible(true);

      expect(scene.createdImages[0].setVisible).toHaveBeenCalledTimes(2);
      expect(scene.createdImages[0].setVisible).toHaveBeenNthCalledWith(
        2,
        true,
      );
      expect(scene.createdImages[0].visible).toBe(true);
    });
  });

  describe("setPosition", () => {
    it("updates the image position", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.setPosition(42, 99);

      expect(scene.createdImages[0].setPosition).toHaveBeenCalledTimes(1);
      expect(scene.createdImages[0].setPosition).toHaveBeenCalledWith(42, 99);
      expect(scene.createdImages[0].x).toBe(42);
      expect(scene.createdImages[0].y).toBe(99);
    });
  });

  describe("getPosition", () => {
    it("returns current position", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 12, 34);

      expect(sprite.getPosition()).toEqual({ x: 12, y: 34 });

      sprite.setPosition(56, 78);
      expect(sprite.getPosition()).toEqual({ x: 56, y: 78 });
    });

    it("returns a fresh object each call (no shared reference)", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 1, 2);

      const a = sprite.getPosition();
      const b = sprite.getPosition();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe("destroy", () => {
    it("calls destroy on the image", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.destroy();

      expect(scene.createdImages[0].destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("playSpawnAnimation", () => {
    it("snaps the sprite's scale to 0 before the tween starts", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.playSpawnAnimation();

      // The spawn animation snaps the sprite invisible (scale 0) before
      // tweening back to (1, 1) — without this snap, the sprite would be
      // briefly visible at full size before the tween begins.
      expect(scene.createdImages[0].setScale).toHaveBeenCalledTimes(1);
      expect(scene.createdImages[0].setScale).toHaveBeenCalledWith(0, 0);
      expect(scene.createdImages[0].scaleX).toBe(0);
      expect(scene.createdImages[0].scaleY).toBe(0);
    });

    it("calls scene.tweens.add with scaleX/scaleY = 1 targeting the image", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.playSpawnAnimation();

      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
      const config = scene.tweenCalls[0];
      expect(config.targets).toBe(sprite.gameObject);
      expect(config.scaleX).toBe(1);
      expect(config.scaleY).toBe(1);
    });

    it("uses the 'Back.out' ease for a satisfying pop-in", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playSpawnAnimation();

      expect(scene.tweenCalls[0].ease).toBe("Back.out");
    });

    it("uses the default 200ms duration when no argument is passed", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playSpawnAnimation();

      expect(scene.tweenCalls[0].duration).toBe(200);
    });

    it("accepts a custom duration argument", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playSpawnAnimation(500);

      expect(scene.tweenCalls[0].duration).toBe(500);
    });

    it("does not register an onComplete callback (spawn has no follow-up)", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playSpawnAnimation();

      expect(scene.tweenCalls[0].onComplete).toBeUndefined();
    });
  });

  describe("playCollectedAnimation", () => {
    it("calls scene.tweens.add with scaleX/scaleY = 1.5 and alpha = 0", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.playCollectedAnimation(() => void 0);

      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
      const config = scene.tweenCalls[0];
      expect(config.targets).toBe(sprite.gameObject);
      expect(config.scaleX).toBe(1.5);
      expect(config.scaleY).toBe(1.5);
      expect(config.alpha).toBe(0);
    });

    it("registers the onComplete callback on the tween config", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);
      const onComplete = vi.fn();

      sprite.playCollectedAnimation(onComplete);

      expect(scene.tweenCalls[0].onComplete).toBe(onComplete);
    });

    it("invokes the onComplete callback when the tween is flushed", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);
      const onComplete = vi.fn();

      sprite.playCollectedAnimation(onComplete);
      // Simulate the Phaser tween system firing onComplete after 250ms.
      flushTween(scene, 0);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("uses the default 250ms duration when no argument is passed", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playCollectedAnimation(
        () => void 0,
      );

      expect(scene.tweenCalls[0].duration).toBe(250);
    });

    it("accepts a custom duration argument", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playCollectedAnimation(
        () => void 0,
        600,
      );

      expect(scene.tweenCalls[0].duration).toBe(600);
    });
  });

  describe("playDespawnAnimation", () => {
    it("calls scene.tweens.add with alpha = 0 (no scale change)", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);

      sprite.playDespawnAnimation(() => void 0);

      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
      const config = scene.tweenCalls[0];
      expect(config.targets).toBe(sprite.gameObject);
      expect(config.alpha).toBe(0);
      // The despawn animation is a pure fade — it must NOT rescale the
      // sprite (otherwise the sprite would shrink/grow during the fade,
      // which reads as a "collected" flash, not a graceful despawn).
      expect(config.scaleX).toBeUndefined();
      expect(config.scaleY).toBeUndefined();
    });

    it("registers the onComplete callback on the tween config", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);
      const onComplete = vi.fn();

      sprite.playDespawnAnimation(onComplete);

      expect(scene.tweenCalls[0].onComplete).toBe(onComplete);
    });

    it("invokes the onComplete callback when the tween is flushed", () => {
      const scene = makeStubScene();
      const sprite = createPowerUpSprite(asScene(scene), "speed", 0, 0);
      const onComplete = vi.fn();

      sprite.playDespawnAnimation(onComplete);
      // Simulate the Phaser tween system firing onComplete after 300ms.
      flushTween(scene, 0);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("uses the default 300ms duration when no argument is passed", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playDespawnAnimation(
        () => void 0,
      );

      expect(scene.tweenCalls[0].duration).toBe(300);
    });

    it("accepts a custom duration argument", () => {
      const scene = makeStubScene();
      createPowerUpSprite(asScene(scene), "speed", 0, 0).playDespawnAnimation(
        () => void 0,
        700,
      );

      expect(scene.tweenCalls[0].duration).toBe(700);
    });
  });

  describe("POWERUP_SPRITE_KEYS", () => {
    it("maps all 6 effects to 'powerup-<effect>'", () => {
      for (const effect of EFFECTS) {
        expect(POWERUP_SPRITE_KEYS[effect]).toBe(`powerup-${effect}`);
      }
    });

    it("has exactly 6 keys (one per effect)", () => {
      expect(Object.keys(POWERUP_SPRITE_KEYS)).toHaveLength(6);
    });

    it("every key matches the documented naming convention 'powerup-<effect>'", () => {
      const entries = Object.entries(POWERUP_SPRITE_KEYS);
      for (const [effect, key] of entries) {
        expect(key).toBe(`powerup-${effect}`);
      }
    });

    it("every key is registered in the sprite manifest", async () => {
      const { SPRITE_DEFINITIONS } = await import(
        "../assets/spriteManifest"
      );
      const manifestKeys = new Set(SPRITE_DEFINITIONS.map((d) => d.key));
      for (const effect of EFFECTS) {
        expect(manifestKeys.has(POWERUP_SPRITE_KEYS[effect])).toBe(true);
      }
    });
  });
});
