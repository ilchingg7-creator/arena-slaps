import { describe, expect, it, vi } from "vitest";

// Local phaser stub — we never load real Phaser in this test file.
// The stub provides a minimal `Scene` with `add.graphics()` returning
// a recording Graphics mock.
class GraphicsStub {
  fillStyle = vi.fn().mockReturnThis();
  fillRoundedRect = vi.fn().mockReturnThis();
  lineStyle = vi.fn().mockReturnThis();
  strokeRoundedRect = vi.fn().mockReturnThis();
  setDepth = vi.fn().mockReturnThis();
  setAlpha = vi.fn().mockReturnThis();
  setScrollFactor = vi.fn().mockReturnThis();
}
class SceneStub {
  add = { graphics: vi.fn(() => new GraphicsStub()) };
}

import { drawNeonPanel } from "./neonPrimitives";

describe("neonPrimitives — drawNeonPanel", () => {
  it("is a function", () => {
    expect(typeof drawNeonPanel).toBe("function");
  });

  it("creates a graphics object via scene.add.graphics", () => {
    const scene = new SceneStub();
    const g = drawNeonPanel(scene as never, 0, 0, 100, 50);
    expect(scene.add.graphics).toHaveBeenCalledTimes(1);
    expect(g).toBeDefined();
  });

  it("draws a filled rounded rect + two stroked rounded rects (body + glow + border)", () => {
    const scene = new SceneStub();
    const g = drawNeonPanel(scene as never, 10, 20, 100, 80) as unknown as GraphicsStub;

    // One fill (panel body).
    expect(g.fillStyle).toHaveBeenCalledTimes(1);
    expect(g.fillRoundedRect).toHaveBeenCalledTimes(1);
    // Two strokes (outer glow + inner border).
    expect(g.lineStyle).toHaveBeenCalledTimes(2);
    expect(g.strokeRoundedRect).toHaveBeenCalledTimes(2);
  });

  it("passes x/y/width/height/radius through to fillRoundedRect", () => {
    const scene = new SceneStub();
    const g = drawNeonPanel(scene as never, 10, 20, 100, 80) as unknown as GraphicsStub;
    expect(g.fillRoundedRect).toHaveBeenCalledWith(10, 20, 100, 80, 12);
  });

  it("returns a Graphics object with setAlpha/setDepth for caller use", () => {
    const scene = new SceneStub();
    const g = drawNeonPanel(scene as never, 0, 0, 50, 50) as unknown as GraphicsStub;
    expect(typeof g.setAlpha).toBe("function");
    expect(typeof g.setDepth).toBe("function");
  });
});
