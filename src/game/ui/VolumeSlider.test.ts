import { describe, expect, it } from "vitest";
import {
  VOLUME_SLIDER_OWNED_KEY,
  createVolumeSlider,
  type SliderSceneLike,
} from "./VolumeSlider";

type Rect = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  origin: { x: number; y: number };
  depth: number;
  visible: boolean;
};

type Text = {
  kind: "text";
  x: number;
  y: number;
  text: string;
  origin: { x: number; y: number };
};

type Zone = {
  kind: "zone";
  x: number;
  y: number;
  width: number;
  height: number;
  interactive: boolean;
  handlers: Map<string, (pointer: unknown) => void>;
};

type Graphics = {
  kind: "graphics";
  visible: boolean;
  depth: number;
  destroyed: boolean;
};

type FakeScene = SliderSceneLike & {
  rects: Rect[];
  texts: Text[];
  zones: Zone[];
  graphics: Graphics[];
  emit(event: string, pointer: unknown): void;
};

function makeScene(): FakeScene {
  const rects: Rect[] = [];
  const texts: Text[] = [];
  const zones: Zone[] = [];
  const graphics: Graphics[] = [];

  const scene: FakeScene = {
    rects,
    texts,
    zones,
    graphics,
    add: {
      graphics() {
        const g = {
          kind: "graphics",
          visible: true,
          depth: 0,
          destroyed: false,
          [VOLUME_SLIDER_OWNED_KEY]: false,
          clear() {
            return g;
          },
          fillStyle() {
            return g;
          },
          fillRoundedRect() {
            return g;
          },
          lineStyle() {
            return g;
          },
          strokeRoundedRect() {
            return g;
          },
          setDepth(d: number) {
            g.depth = d;
            return g;
          },
          setVisible(v: boolean) {
            g.visible = v;
            return g;
          },
          destroy() {
            g.destroyed = true;
            return g;
          },
        } as Graphics & { [VOLUME_SLIDER_OWNED_KEY]: boolean } & Record<string, unknown>;
        graphics.push(g);
        return g as never;
      },
      rectangle(x, y, width, height, color) {
        const r: Rect = {
          kind: "rect",
          x,
          y,
          width,
          height,
          color,
          origin: { x: 0.5, y: 0.5 },
          depth: 0,
          visible: true,
        };
        rects.push(r);
        // Return a proxy object whose methods record mutations back onto r.
        return {
          setOrigin(o?: number, p?: number) {
            r.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return this;
          },
          setDepth(d: number) {
            r.depth = d;
            return this;
          },
          setVisible(v: boolean) {
            r.visible = v;
            return this;
          },
          get width() {
            return r.width;
          },
          set width(v: number) {
            r.width = v;
          },
          get height() {
            return r.height;
          },
          set height(v: number) {
            r.height = v;
          },
          get x() {
            return r.x;
          },
          set x(v: number) {
            r.x = v;
          },
          get y() {
            return r.y;
          },
          set y(v: number) {
            r.y = v;
          },
        } as unknown as ReturnType<SliderSceneLike["add"]["rectangle"]>;
      },
      text(x, y, value, _style) {
        const t: Text = { kind: "text", x, y, text: value, origin: { x: 0.5, y: 0.5 } };
        texts.push(t);
        return {
          setOrigin(o?: number, p?: number) {
            t.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return this;
          },
          setText(v: string) {
            t.text = v;
            return this;
          },
        } as unknown as ReturnType<SliderSceneLike["add"]["text"]>;
      },
      zone(x, y, width, height) {
        const z: Zone = {
          kind: "zone",
          x,
          y,
          width,
          height,
          interactive: false,
          handlers: new Map(),
        };
        zones.push(z);
        return {
          setInteractive() {
            z.interactive = true;
            return this;
          },
          on(event: string, handler: (pointer: unknown) => void) {
            z.handlers.set(event, handler);
            return this;
          },
          removeAllListeners() {
            z.handlers.clear();
            return this;
          },
        } as unknown as ReturnType<SliderSceneLike["add"]["zone"]>;
      },
    },
    emit(event, pointer) {
      const z = zones[0];
      const h = z.handlers.get(event);
      if (h) h(pointer);
    },
  };
  return scene;
}

describe("VolumeSlider", () => {
  it("creates track, fill, handle, label, and hit zone", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    expect(scene.graphics).toHaveLength(3);
    expect(
      scene.graphics.every(
        (g) =>
          (g as unknown as Record<string, unknown>)[VOLUME_SLIDER_OWNED_KEY] ===
          true,
      ),
    ).toBe(true);
    expect(scene.rects).toHaveLength(3); // track + fill + handle
    expect(scene.texts).toHaveLength(1); // label
    expect(scene.zones).toHaveLength(1);
    expect(scene.zones[0].interactive).toBe(true);
  });

  it("initial label shows percentage of the initial value", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.7, () => void 0);
    expect(scene.texts[0].text).toBe("70%");
  });

  it("snaps to 5% increments on drag", () => {
    const scene = makeScene();
    // Slider at centerX=100, width=200, so trackLeft = 0.
    // A pointer at x=137 corresponds to value 137/200 = 0.685, which should
    // snap to 0.70.
    const changes: number[] = [];
    createVolumeSlider(scene, 100, 50, 200, 0.5, (v) => changes.push(v));
    scene.emit("pointerdown", { x: 137, y: 50, isDown: true });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBeCloseTo(0.7, 5);
    expect(scene.texts[0].text).toBe("70%");
  });

  it("clamps pointer x to [0, trackWidth]", () => {
    const scene = makeScene();
    const changes: number[] = [];
    createVolumeSlider(scene, 100, 50, 200, 0.5, (v) => changes.push(v));

    scene.emit("pointerdown", { x: -500, y: 50, isDown: true });
    expect(changes[changes.length - 1]).toBeCloseTo(0, 5);
    expect(scene.texts[0].text).toBe("0%");

    scene.emit("pointerdown", { x: 999, y: 50, isDown: true });
    expect(changes[changes.length - 1]).toBeCloseTo(1, 5);
    expect(scene.texts[0].text).toBe("100%");
  });

  it("setValue updates the label", () => {
    const scene = makeScene();
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    slider.setValue(0.42);
    expect(slider.getValue()).toBeCloseTo(0.4, 5); // snapped to 5%
    expect(scene.texts[0].text).toBe("40%");
  });

  it("getValue returns the current snapped value", () => {
    const scene = makeScene();
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    expect(slider.getValue()).toBeCloseTo(0.5, 5);
    slider.setValue(0.83);
    expect(slider.getValue()).toBeCloseTo(0.85, 5);
  });

  it("destroy removes all hit-zone listeners", () => {
    const scene = makeScene();
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    const zone = scene.zones[0];
    expect(zone.handlers.size).toBeGreaterThan(0);
    slider.destroy();
    expect(zone.handlers.size).toBe(0);
  });

  it("destroy tears down the task-added chrome graphics objects", () => {
    const scene = makeScene();
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    expect(scene.graphics).toHaveLength(3);

    slider.destroy();

    expect(scene.graphics.every((g) => g.destroyed)).toBe(true);
  });

  it("does not fire onChange on pointermove when not dragging", () => {
    const scene = makeScene();
    const changes: number[] = [];
    createVolumeSlider(scene, 100, 50, 200, 0.5, (v) => changes.push(v));
    scene.emit("pointermove", { x: 100, y: 50, isDown: false });
    expect(changes).toHaveLength(0);
  });

  it("fires onChange on pointermove while dragging", () => {
    const scene = makeScene();
    const changes: number[] = [];
    createVolumeSlider(scene, 100, 50, 200, 0.5, (v) => changes.push(v));
    scene.emit("pointerdown", { x: 50, y: 50, isDown: true });
    scene.emit("pointermove", { x: 150, y: 50, isDown: true });
    expect(changes.length).toBe(2);
    expect(changes[1]).toBeCloseTo(0.75, 5);
  });

  it("handlePointerMove updates value while dragging even when pointer is outside zone", () => {
    const scene = makeScene();
    const changes: number[] = [];
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, (v) =>
      changes.push(v),
    );
    // Start drag at x=50 (value 0.25)
    scene.emit("pointerdown", { x: 50, y: 50, isDown: true });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBeCloseTo(0.25, 5);
    // Pointer way outside the zone — without handlePointerMove the slider
    // would stop updating because pointermove only fires over the hit zone.
    slider.handlePointerMove({ x: 300, y: 200, isDown: true });
    expect(changes).toHaveLength(2);
    expect(changes[1]).toBeCloseTo(1, 5);
    expect(slider.getValue()).toBeCloseTo(1, 5);
    expect(scene.texts[0].text).toBe("100%");
  });

  it("handlePointerMove does nothing when not dragging", () => {
    const scene = makeScene();
    const changes: number[] = [];
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, (v) =>
      changes.push(v),
    );
    // No prior pointerdown — slider is not dragging.
    slider.handlePointerMove({ x: 100, y: 50, isDown: true });
    expect(changes).toHaveLength(0);
    expect(slider.getValue()).toBeCloseTo(0.5, 5);
  });

  it("endDrag stops further handlePointerMove from updating", () => {
    const scene = makeScene();
    const changes: number[] = [];
    const slider = createVolumeSlider(scene, 100, 50, 200, 0.5, (v) =>
      changes.push(v),
    );
    scene.emit("pointerdown", { x: 50, y: 50, isDown: true });
    slider.endDrag();
    slider.handlePointerMove({ x: 200, y: 50, isDown: true });
    expect(changes).toHaveLength(1);
  });

  // --- Bug 2: handle + green fill overflow the track edges ---
  // The handle is a 22px square (HANDLE_SIZE). At value=1 the handle used to
  // be positioned at `trackLeft + trackWidth` (the exact right edge), so its
  // centre was on the edge and its right half spilled 11px past the track.
  // The green fill was `value * trackWidth` wide, which at value=1 hit the
  // track's right edge exactly and could visually clip past it during
  // anti-aliasing / pointer overshoot.
  //
  // Fix: keep the handle fully inside the track (its centre ranges over
  // [trackLeft + HANDLE_SIZE/2, trackLeft + trackWidth - HANDLE_SIZE/2]) and
  // make the fill end at the handle's LEFT edge so it can never reach past
  // the handle (and therefore never past the track).

  it("at value=1, handle.x stays inside the track (no right-edge overflow)", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    // Slider centerX=100, trackWidth=200, so trackLeft = 0, trackRight = 200.
    // handle.x must be <= trackRight - HANDLE_SIZE/2 = 200 - 11 = 189.
    scene.emit("pointerdown", { x: 999, y: 50, isDown: true });
    const handle = scene.rects[2];
    expect(handle.x).toBeLessThanOrEqual(200 - 22 / 2);
    expect(handle.x).toBeGreaterThanOrEqual(0);
  });

  it("at value=0, handle.x stays inside the track (no left-edge overflow)", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    // handle.x must be >= trackLeft + HANDLE_SIZE/2 = 0 + 11 = 11.
    scene.emit("pointerdown", { x: -500, y: 50, isDown: true });
    const handle = scene.rects[2];
    expect(handle.x).toBeGreaterThanOrEqual(0 + 22 / 2);
    expect(handle.x).toBeLessThanOrEqual(200);
  });

  it("at value=1, fill.width never exceeds trackWidth - HANDLE_SIZE (no green overflow)", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    scene.emit("pointerdown", { x: 999, y: 50, isDown: true });
    const fill = scene.rects[1];
    // Fill must end at the handle's LEFT edge, so its width is at most
    // trackWidth - HANDLE_SIZE = 200 - 22 = 178.
    expect(fill.width).toBeLessThanOrEqual(200 - 22);
    expect(fill.width).toBeGreaterThanOrEqual(0);
  });

  it("at value=0, fill.width is 0 (no green sliver under the handle at minimum)", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    scene.emit("pointerdown", { x: -500, y: 50, isDown: true });
    const fill = scene.rects[1];
    expect(fill.width).toBe(0);
  });

  it("at value=1, fill's right edge never passes the handle's left edge", () => {
    const scene = makeScene();
    createVolumeSlider(scene, 100, 50, 200, 0.5, () => void 0);
    scene.emit("pointerdown", { x: 999, y: 50, isDown: true });
    const fill = scene.rects[1];
    const handle = scene.rects[2];
    // Fill's right edge = fill.x + fill.width/2 (origin 0.5).
    // Handle's left edge = handle.x - HANDLE_SIZE/2.
    const fillRight = fill.x + fill.width / 2;
    const handleLeft = handle.x - 22 / 2;
    expect(fillRight).toBeLessThanOrEqual(handleLeft + 1e-9);
  });
});
