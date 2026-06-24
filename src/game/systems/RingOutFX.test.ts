import { describe, expect, it, vi } from "vitest";
import { playRingOutFX } from "./RingOutFX";

type FakeGameObject = {
  x: number;
  y: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
};

type FakeFlash = {
  setDepth: (d: number) => FakeFlash;
  destroy: () => void;
};

type FakeScene = {
  cameras: { main: { shake: ReturnType<typeof vi.fn> } };
  tweens: { add: ReturnType<typeof vi.fn> };
  add: {
    circle: ReturnType<typeof vi.fn>;
  };
  time: {
    delayedCall: ReturnType<typeof vi.fn>;
  };
};

function makeScene(): FakeScene {
  return {
    cameras: { main: { shake: vi.fn() } },
    tweens: { add: vi.fn() },
    add: { circle: vi.fn(() => ({
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })) },
    time: { delayedCall: vi.fn() },
  };
}

function makeAnimatedSprite() {
  const go: FakeGameObject = { x: 100, y: 200, alpha: 1, scaleX: 1, scaleY: 1 };
  return {
    gameObject: go,
    setState: vi.fn(),
    setEffectTint: vi.fn(),
    setPosition: vi.fn(),
    getPosition: vi.fn(() => ({ x: go.x, y: go.y })),
    getState: vi.fn(() => "idle"),
    destroy: vi.fn(),
  };
}

describe("RingOutFX", () => {
  it("calls cameras.main.shake", () => {
    const scene = makeScene();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 100,
      y: 200,
      animatedSprite: makeAnimatedSprite() as unknown as never,
      onComplete: () => {},
    });
    expect(scene.cameras.main.shake).toHaveBeenCalledWith(200, 0.005);
  });

  it("sets the animated sprite to 'fall' state", () => {
    const scene = makeScene();
    const sprite = makeAnimatedSprite();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 100,
      y: 200,
      animatedSprite: sprite as unknown as never,
      onComplete: () => {},
    });
    expect(sprite.setState).toHaveBeenCalledWith("fall");
  });

  it("calls scene.tweens.add for the fall tween", () => {
    const scene = makeScene();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 100,
      y: 200,
      animatedSprite: makeAnimatedSprite() as unknown as never,
      onComplete: () => {},
    });
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it("creates a flash circle at the ring-out position", () => {
    const scene = makeScene();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 150,
      y: 250,
      animatedSprite: makeAnimatedSprite() as unknown as never,
      onComplete: () => {},
    });
    expect(scene.add.circle).toHaveBeenCalledWith(150, 250, 10, 0xffffff, 1);
  });

  it("calls scene.time.delayedCall with 500ms and onComplete", () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 100,
      y: 200,
      animatedSprite: makeAnimatedSprite() as unknown as never,
      onComplete,
    });
    expect(scene.time.delayedCall).toHaveBeenCalledWith(500, onComplete);
  });

  it("the fall tween targets the animated sprite's gameObject", () => {
    const scene = makeScene();
    const sprite = makeAnimatedSprite();
    playRingOutFX({
      scene: scene as unknown as never,
      x: 100,
      y: 200,
      animatedSprite: sprite as unknown as never,
      onComplete: () => {},
    });
    const tweenConfig = scene.tweens.add.mock.calls[0][0] as { targets: unknown };
    expect(tweenConfig.targets).toBe(sprite.gameObject);
  });
});
