import { describe, expect, it, vi } from "vitest";
import {
  createStyledButton,
  getButtonBounds,
  getVariantColors,
  type ButtonGraphics,
  type ButtonSceneLike,
  type ButtonText,
} from "./StyledButton";
import { NEON_COLORS, NEON_PANEL, getNeonButtonVariant } from "./neonTheme";

// --- Stub scene ----------------------------------------------------------
// Models the Phaser scene surface that StyledButton actually touches:
// `add.graphics()` and `add.text(...)`. The stubs record method calls and
// mutations onto a plain data object so tests can assert against them,
// mirroring the VolumeSlider.test.ts / TopRightMuteButton.test.ts pattern.

type FakeGraphics = {
  kind: "graphics";
  position: { x: number; y: number };
  scale: { x: number; y: number };
  visible: boolean;
  alpha: number;
  depth: number;
  interactive: boolean;
  interactiveConfig:
    | { useHandCursor?: boolean }
    | {
        hitArea: unknown;
        hitAreaCallback: (hitArea: unknown, x: number, y: number) => boolean;
        useHandCursor?: boolean;
      }
    | undefined;
  handlers: Map<string, (pointer?: unknown) => void>;
  fillRoundedCalls: number;
  strokeCalls: number;
  lineStyleCalls: number;
  lineStyles: Array<{ width: number; color: number; alpha: number | undefined }>;
  cleared: boolean;
  destroyed: boolean;
  listenersRemoved: boolean;
};

type FakeText = {
  kind: "text";
  x: number;
  y: number;
  text: string;
  style: unknown;
  origin: { x: number; y: number };
  scale: { x: number; y: number };
  visible: boolean;
  alpha: number;
  depth: number;
  destroyed: boolean;
};

type FakeScene = ButtonSceneLike & {
  graphicsList: FakeGraphics[];
  texts: FakeText[];
  /** Emit a pointer event on the graphics at the given index. */
  emit(graphicsIndex: number, event: string, pointer?: unknown): void;
};

function makeScene(): FakeScene {
  const graphicsList: FakeGraphics[] = [];
  const texts: FakeText[] = [];

  const scene: FakeScene = {
    graphicsList,
    texts,
    add: {
      graphics(_config?: unknown) {
        const g: FakeGraphics = {
          kind: "graphics",
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          visible: true,
          alpha: 1,
          depth: 0,
          interactive: false,
          interactiveConfig: undefined,
          handlers: new Map(),
          fillRoundedCalls: 0,
          strokeCalls: 0,
          lineStyleCalls: 0,
          lineStyles: [],
          cleared: false,
          destroyed: false,
          listenersRemoved: false,
        };
        graphicsList.push(g);
        // Proxy: each method mutates `g` and returns `this` for chaining.
        const proxy = {
          clear() {
            g.cleared = true;
            return proxy;
          },
          fillStyle(_color: number, _alpha?: number) {
            return proxy;
          },
          fillRoundedRect() {
            g.fillRoundedCalls += 1;
            return proxy;
          },
          lineStyle(_w: number, _c: number, _a?: number) {
            g.lineStyleCalls += 1;
            g.lineStyles.push({ width: _w, color: _c, alpha: _a });
            return proxy;
          },
          strokeRoundedRect() {
            g.strokeCalls += 1;
            return proxy;
          },
          setPosition(x: number, y: number) {
            g.position = { x, y };
            return proxy;
          },
          setScale(x: number, y?: number) {
            g.scale = { x, y: y ?? x };
            return proxy;
          },
          setVisible(v: boolean) {
            g.visible = v;
            return proxy;
          },
          setAlpha(a: number) {
            g.alpha = a;
            return proxy;
          },
          setDepth(d: number) {
            g.depth = d;
            return proxy;
          },
          setInteractive(config?: { useHandCursor?: boolean }) {
            g.interactive = true;
            g.interactiveConfig = config;
            return proxy;
          },
          on(event: string, handler: (pointer?: unknown) => void) {
            g.handlers.set(event, handler);
            return proxy;
          },
          removeAllListeners() {
            g.handlers.clear();
            g.listenersRemoved = true;
            return proxy;
          },
          destroy() {
            g.destroyed = true;
          },
        };
        return proxy as unknown as ButtonGraphics;
      },
      text(x: number, y: number, value: string, style?: unknown) {
        const t: FakeText = {
          kind: "text",
          x,
          y,
          text: value,
          style,
          origin: { x: 0.5, y: 0.5 },
          scale: { x: 1, y: 1 },
          visible: true,
          alpha: 1,
          depth: 0,
          destroyed: false,
        };
        texts.push(t);
        const proxy = {
          setOrigin(o?: number, p?: number) {
            t.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return proxy;
          },
          setText(v: string) {
            t.text = v;
            return proxy;
          },
          setScale(x: number, y?: number) {
            t.scale = { x, y: y ?? x };
            return proxy;
          },
          setVisible(v: boolean) {
            t.visible = v;
            return proxy;
          },
          setAlpha(a: number) {
            t.alpha = a;
            return proxy;
          },
          setDepth(d: number) {
            t.depth = d;
            return proxy;
          },
          destroy() {
            t.destroyed = true;
          },
        };
        return proxy as unknown as ButtonText;
      },
    },
    emit(graphicsIndex: number, event: string, pointer?: unknown) {
      const g = graphicsList[graphicsIndex];
      const h = g?.handlers.get(event);
      if (h) h(pointer);
    },
  };

  return scene;
}

// --- getVariantColors ----------------------------------------------------

describe("StyledButton - getVariantColors", () => {
  it("preserves the legacy top/bottom/border/text contract", () => {
    expect(getVariantColors("primary")).toEqual({
      top: 0x151b2b,
      bottom: 0x101522,
      border: 0x20f6ff,
      text: 0xf6fbff,
    });
  });

  it("maps secondary to the legacy compatibility shape", () => {
    expect(getVariantColors("secondary")).toEqual({
      top: 0x151b2b,
      bottom: 0x101522,
      border: 0x6f7a94,
      text: 0xf6fbff,
    });
  });

  it("falls back to the secondary compatibility shape for unknown variants", () => {
    expect(getVariantColors("invalid" as never)).toEqual({
      top: 0x151b2b,
      bottom: 0x101522,
      border: 0x6f7a94,
      text: 0xf6fbff,
    });
  });
});

// --- getButtonBounds -----------------------------------------------------

describe("StyledButton - getButtonBounds", () => {
  it("uses default width=240 and height=56 when not specified", () => {
    const b = getButtonBounds({
      x: 100,
      y: 200,
      text: "OK",
      onClick: () => {},
    });
    expect(b).toEqual({ x: 100, y: 200, width: 240, height: 56 });
  });

  it("uses provided width and height", () => {
    const b = getButtonBounds({
      x: 50,
      y: 60,
      text: "Hi",
      width: 180,
      height: 40,
      onClick: () => {},
    });
    expect(b).toEqual({ x: 50, y: 60, width: 180, height: 40 });
  });

  it("echoes x and y verbatim", () => {
    const b = getButtonBounds({
      x: -10,
      y: 9999,
      text: "Edge",
      width: 1,
      height: 1,
      onClick: () => {},
    });
    expect(b.x).toBe(-10);
    expect(b.y).toBe(9999);
  });
});

// --- createStyledButton --------------------------------------------------

describe("StyledButton - createStyledButton", () => {
  it("adds a graphics object + text to the scene", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 100,
      y: 200,
      text: "Click me",
      onClick: () => {},
    });
    expect(scene.graphicsList).toHaveLength(1);
    expect(scene.texts).toHaveLength(1);
    expect(scene.texts[0].text).toBe("Click me");
  });

  it("makes the graphics interactive with hand cursor", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 100,
      y: 200,
      text: "Hi",
      onClick: () => {},
    });
    expect(scene.graphicsList[0].interactive).toBe(true);
    // The hit area is a rectangle covering the button bounds (in local
    // coordinates, centered on 0,0). Default button is 240x56, so hitArea
    // spans from (-120, -28) to (120, 28).
    expect(scene.graphicsList[0].interactiveConfig).toMatchObject({
      useHandCursor: true,
      hitArea: { x: -120, y: -28, width: 240, height: 56 },
    });
    expect(typeof (scene.graphicsList[0].interactiveConfig as { hitAreaCallback?: unknown })?.hitAreaCallback).toBe("function");
  });

  it("positions the graphics at the button center", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 300,
      y: 400,
      text: "OK",
      onClick: () => {},
    });
    expect(scene.graphicsList[0].position).toEqual({ x: 300, y: 400 });
  });

  it("draws neon panel chrome with glow stroke plus inner border", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      variant: "primary",
      onClick: () => {},
    });
    expect(scene.graphicsList[0].fillRoundedCalls).toBe(1);
    expect(scene.graphicsList[0].strokeCalls).toBe(2);
    expect(scene.graphicsList[0].lineStyleCalls).toBe(2);
    expect(scene.graphicsList[0].lineStyles).toEqual([
      {
        width: 6,
        color: getNeonButtonVariant("primary").glow,
        alpha: NEON_PANEL.glowAlpha,
      },
      {
        width: NEON_PANEL.borderWidth,
        color: getNeonButtonVariant("primary").edge,
        alpha: 1,
      },
    ]);
  });

  it("centers the text label on the button position", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 250,
      y: 350,
      text: "OK",
      onClick: () => {},
    });
    expect(scene.texts[0].x).toBe(250);
    expect(scene.texts[0].y).toBe(350);
    expect(scene.texts[0].origin).toEqual({ x: 0.5, y: 0.5 });
  });

  it("uses the shared neon label styling", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    expect(scene.texts[0].style).toMatchObject({
      color: "#f6fbff",
      fontFamily: "Arial",
      fontStyle: "bold",
      stroke: "#05070d",
      strokeThickness: 4,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: "#20f6ff",
        blur: 10,
        fill: false,
      },
    });
  });

  it("wires pointerover / pointerout / pointerdown / pointerup handlers", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    const handlers = scene.graphicsList[0].handlers;
    expect(handlers.has("pointerover")).toBe(true);
    expect(handlers.has("pointerout")).toBe(true);
    expect(handlers.has("pointerdown")).toBe(true);
    expect(handlers.has("pointerup")).toBe(true);
  });

  it("calls onClick when pointerup fires on the hit area", () => {
    const scene = makeScene();
    const onClick = vi.fn();
    createStyledButton(scene, { x: 0, y: 0, text: "OK", onClick });
    scene.emit(0, "pointerup");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("scales up to 1.05 on pointerover (graphics + text)", () => {
    const scene = makeScene();
    createStyledButton(scene, { x: 0, y: 0, text: "OK", onClick: () => {} });
    scene.emit(0, "pointerover");
    expect(scene.graphicsList[0].scale).toEqual({ x: 1.05, y: 1.05 });
    expect(scene.texts[0].scale).toEqual({ x: 1.05, y: 1.05 });
  });

  it("scales down to 0.95 on pointerdown", () => {
    const scene = makeScene();
    createStyledButton(scene, { x: 0, y: 0, text: "OK", onClick: () => {} });
    scene.emit(0, "pointerdown");
    expect(scene.graphicsList[0].scale).toEqual({ x: 0.95, y: 0.95 });
  });

  it("resets scale to 1.0 on pointerout", () => {
    const scene = makeScene();
    createStyledButton(scene, { x: 0, y: 0, text: "OK", onClick: () => {} });
    scene.emit(0, "pointerover");
    scene.emit(0, "pointerout");
    expect(scene.graphicsList[0].scale).toEqual({ x: 1, y: 1 });
    expect(scene.texts[0].scale).toEqual({ x: 1, y: 1 });
  });

  it("pointerup scales back to 1.05 (still hovering) before firing onClick", () => {
    const scene = makeScene();
    const calls: Array<{ scale: { x: number; y: number } }> = [];
    createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {
        calls.push({ scale: { ...scene.graphicsList[0].scale } });
      },
    });
    scene.emit(0, "pointerdown");
    scene.emit(0, "pointerup");
    // onClick fires after scale is reset to HOVER_SCALE.
    expect(calls[0].scale).toEqual({ x: 1.05, y: 1.05 });
  });

  it("defaults to primary variant when none is specified", () => {
    const scene = makeScene();
    createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    expect(scene.graphicsList[0].lineStyles[1]?.color).toBe(NEON_COLORS.cyan);
  });
});

// --- setText -------------------------------------------------------------

describe("StyledButton - setText", () => {
  it("updates the text object's text", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "Old",
      onClick: () => {},
    });
    btn.setText("New");
    expect(scene.texts[0].text).toBe("New");
  });

  it("setText is idempotent", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "A",
      onClick: () => {},
    });
    btn.setText("B");
    btn.setText("B");
    expect(scene.texts[0].text).toBe("B");
  });
});

// --- setVariant ----------------------------------------------------------

describe("StyledButton - setVariant", () => {
  it("re-renders the neon chrome for the next variant", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      variant: "primary",
      onClick: () => {},
    });
    expect(scene.graphicsList[0].fillRoundedCalls).toBe(1);
    btn.setVariant("success");
    expect(scene.graphicsList[0].fillRoundedCalls).toBe(2);
    expect(scene.graphicsList[0].strokeCalls).toBe(4);
    expect(scene.graphicsList[0].lineStyleCalls).toBe(4);
    expect(scene.graphicsList[0].lineStyles.at(-1)).toEqual({
      width: NEON_PANEL.borderWidth,
      color: getNeonButtonVariant("success").edge,
      alpha: 1,
    });
    expect(scene.graphicsList[0].cleared).toBe(true);
  });
});

// --- setVisible ----------------------------------------------------------

describe("StyledButton - setVisible", () => {
  it("hides both graphics and text when set to false", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setVisible(false);
    expect(scene.graphicsList[0].visible).toBe(false);
    expect(scene.texts[0].visible).toBe(false);
  });

  it("shows both graphics and text when set back to true", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setVisible(false);
    btn.setVisible(true);
    expect(scene.graphicsList[0].visible).toBe(true);
    expect(scene.texts[0].visible).toBe(true);
  });
});

// --- setEnabled ----------------------------------------------------------

describe("StyledButton - setEnabled", () => {
  it("dims the button to alpha 0.5 when disabled", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setEnabled(false);
    expect(scene.graphicsList[0].alpha).toBe(0.5);
    expect(scene.texts[0].alpha).toBe(0.5);
  });

  it("restores full alpha when re-enabled", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setEnabled(false);
    btn.setEnabled(true);
    expect(scene.graphicsList[0].alpha).toBe(1);
    expect(scene.texts[0].alpha).toBe(1);
  });

  it("stops onClick from firing when disabled", () => {
    const scene = makeScene();
    const onClick = vi.fn();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick,
    });
    btn.setEnabled(false);
    scene.emit(0, "pointerup");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("allows onClick to fire again after re-enabling", () => {
    const scene = makeScene();
    const onClick = vi.fn();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick,
    });
    btn.setEnabled(false);
    scene.emit(0, "pointerup");
    btn.setEnabled(true);
    scene.emit(0, "pointerup");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("pointerover is ignored when disabled (no scale-up)", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setEnabled(false);
    scene.emit(0, "pointerover");
    expect(scene.graphicsList[0].scale).toEqual({ x: 1, y: 1 });
  });

  it("pointerdown is ignored when disabled (no scale-down)", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.setEnabled(false);
    scene.emit(0, "pointerdown");
    expect(scene.graphicsList[0].scale).toEqual({ x: 1, y: 1 });
  });
});

// --- destroy -------------------------------------------------------------

describe("StyledButton - destroy", () => {
  it("removes all listeners from the graphics", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    const g = scene.graphicsList[0];
    expect(g.handlers.size).toBeGreaterThan(0);
    btn.destroy();
    expect(g.listenersRemoved).toBe(true);
    expect(g.handlers.size).toBe(0);
  });

  it("destroys both graphics and text", () => {
    const scene = makeScene();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick: () => {},
    });
    btn.destroy();
    expect(scene.graphicsList[0].destroyed).toBe(true);
    expect(scene.texts[0].destroyed).toBe(true);
  });

  it("onClick no longer fires after destroy (handlers cleared)", () => {
    const scene = makeScene();
    const onClick = vi.fn();
    const btn = createStyledButton(scene, {
      x: 0,
      y: 0,
      text: "OK",
      onClick,
    });
    btn.destroy();
    // emit() looks up handlers in the map; after destroy the map is empty
    // so the pointerup handler is no longer reachable.
    scene.emit(0, "pointerup");
    expect(onClick).not.toHaveBeenCalled();
  });
});
