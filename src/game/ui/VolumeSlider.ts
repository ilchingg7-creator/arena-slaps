/**
 * A self-contained horizontal volume slider for Phaser scenes.
 *
 * Renders a track rectangle, a fill rectangle that grows from the left edge
 * to the current value, a draggable handle, and a numeric percentage label.
 * The slider snaps to 5% increments so the displayed percentage is always a
 * multiple of 5 (cleaner UX than continuous values like 41%).
 *
 * Interaction:
 *   - pointerdown on the track -> jump handle to pointer x and start dragging
 *   - pointermove while dragging -> update handle and value
 *   - pointerup anywhere -> stop dragging
 *
 * The slider does NOT depend on Phaser types directly (uses a minimal duck
 * type) so it can be exercised in unit tests with a stub scene.
 */

import { NEON_COLORS, NEON_PANEL, getHudTextStyle } from "./neonTheme";

export type SliderSceneLike = {
  add: {
    graphics?: () => SliderGraphics;
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
    ) => SliderRectangle;
    text: (
      x: number,
      y: number,
      value: string,
      style?: {
        color?: string;
        fontFamily?: string;
        fontSize?: string;
      },
    ) => SliderText;
    zone: (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => SliderZone;
  };
};

type SliderRectangle = {
  setOrigin: (x?: number, y?: number) => SliderRectangle;
  setDepth: (depth: number) => SliderRectangle;
  setVisible: (visible: boolean) => SliderRectangle;
  width: number;
  height: number;
  x: number;
  y: number;
};

type SliderText = {
  setOrigin: (x?: number, y?: number) => SliderText;
  setText: (value: string) => SliderText;
};

type SliderZone = {
  setInteractive: (config?: {
    useHandCursor?: boolean;
  }) => SliderZone;
  on: (event: string, handler: (pointer: SliderPointer) => void) => SliderZone;
  removeAllListeners?: () => SliderZone;
};

type SliderGraphics = {
  clear: () => SliderGraphics;
  fillStyle: (color: number, alpha?: number) => SliderGraphics;
  fillRoundedRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    radius?: number,
  ) => SliderGraphics;
  lineStyle: (width: number, color: number, alpha?: number) => SliderGraphics;
  strokeRoundedRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    radius?: number,
  ) => SliderGraphics;
  setDepth: (depth: number) => SliderGraphics;
  setVisible: (visible: boolean) => SliderGraphics;
  destroy?: () => void;
};

type SliderPointer = {
  x: number;
  y: number;
  isDown: boolean;
};

export type VolumeSlider = {
  setValue: (next: number) => void;
  getValue: () => number;
  /** Forward a global pointermove event so the slider keeps updating when the pointer leaves its hit zone (B8). */
  handlePointerMove: (pointer: SliderPointer) => void;
  /** End the current drag (called from a global pointerup listener). */
  endDrag: () => void;
  destroy: () => void;
};

const TRACK_COLOR = NEON_COLORS.bgPanelAlt;
const FILL_COLOR = NEON_COLORS.lime;
const HANDLE_COLOR = NEON_COLORS.text;
const labelStyle = getHudTextStyle("score");
const SNAP_STEP = 0.05; // 5% increments
const TRACK_HEIGHT = 12;
const HANDLE_SIZE = 22;
const TRACK_RADIUS = NEON_PANEL.radius - 2;

function clamp01(v: number): number {
  if (Number.isNaN(v)) {
    return 0;
  }
  return Math.min(1, Math.max(0, v));
}

function snapToStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function createVolumeSlider(
  scene: SliderSceneLike,
  centerX: number,
  centerY: number,
  trackWidth: number,
  initialValue: number,
  onChange: (nextVolume: number) => void,
): VolumeSlider {
  let value = clamp01(initialValue);
  let dragging = false;

  // Track (background)
  const track = scene.add
    .rectangle(centerX, centerY, trackWidth, TRACK_HEIGHT, TRACK_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(1);

  // Fill (left-anchored) — removed entirely. The green fill was visually
  // distracting during drag; the handle position + percentage label are
  // sufficient indicators. We create a zero-width invisible rectangle
  // so the applyValue() code still works (it sets fill.width / fill.x),
  // but the rectangle is never rendered.
  const trackLeft = centerX - trackWidth / 2;
  const fill = scene.add
    .rectangle(centerX, centerY, 0, 0, FILL_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(2)
    .setVisible(false);

  // Handle (draggable square)
  const handle = scene.add
    .rectangle(centerX, centerY, HANDLE_SIZE, HANDLE_SIZE, HANDLE_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(3);

  // Percentage label
  const label = scene.add
    .text(centerX, centerY - 30, formatPercent(value), {
      ...labelStyle,
      fontSize: "16px",
    })
    .setOrigin(0.5, 0.5);

  // Interactive zone covering the track + a bit of vertical slack so the
  // user doesn't have to hit the 12px-tall track exactly.
  const hitZone = scene.add
    .zone(centerX, centerY, trackWidth + HANDLE_SIZE, HANDLE_SIZE + 20)
    .setInteractive({ useHandCursor: true });

  const trackChrome = scene.add.graphics?.()?.setDepth(1);
  const fillChrome = scene.add.graphics?.()?.setDepth(2);
  const handleChrome = scene.add.graphics?.()?.setDepth(3);

  function renderChrome(): void {
    trackChrome?.clear();
    trackChrome?.fillStyle(NEON_COLORS.bgPanelAlt, 1);
    trackChrome?.fillRoundedRect(
      trackLeft,
      centerY - TRACK_HEIGHT / 2,
      trackWidth,
      TRACK_HEIGHT,
      TRACK_RADIUS,
    );
    trackChrome?.lineStyle(NEON_PANEL.borderWidth, NEON_COLORS.cyan, 0.9);
    trackChrome?.strokeRoundedRect(
      trackLeft,
      centerY - TRACK_HEIGHT / 2,
      trackWidth,
      TRACK_HEIGHT,
      TRACK_RADIUS,
    );

    fillChrome?.clear();
    fillChrome?.fillStyle(NEON_COLORS.lime, 1);
    fillChrome?.fillRoundedRect(
      trackLeft,
      centerY - TRACK_HEIGHT / 2,
      fill.width,
      TRACK_HEIGHT,
      TRACK_RADIUS,
    );

    handleChrome?.clear();
    handleChrome?.fillStyle(NEON_COLORS.text, 1);
    handleChrome?.fillRoundedRect(
      handle.x - HANDLE_SIZE / 2,
      centerY - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
      TRACK_RADIUS,
    );
    handleChrome?.lineStyle(NEON_PANEL.borderWidth, NEON_COLORS.cyan, 1);
    handleChrome?.strokeRoundedRect(
      handle.x - HANDLE_SIZE / 2,
      centerY - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
      TRACK_RADIUS,
    );
  }

  function applyValue(next: number): void {
    value = clamp01(snapToStep(next, SNAP_STEP));
    // Constrain the handle's centre to the inner range
    // [trackLeft + HANDLE_SIZE/2, trackLeft + trackWidth - HANDLE_SIZE/2]
    // so the 22px square never spills past either edge of the track.
    // The fill ends at the handle's LEFT edge, so the green can never
    // overshoot the handle (and therefore never the track either). At
    // value=0 the fill collapses to zero width — no green sliver under
    // the handle. (Bug 2: previously fill.width = value * trackWidth,
    // which hit the right edge at value=1 and clipped past it during
    // pointer overshoot / anti-aliasing.)
    const handleMinX = trackLeft + HANDLE_SIZE / 2;
    const handleMaxX = trackLeft + trackWidth - HANDLE_SIZE / 2;
    const handleRange = Math.max(0, handleMaxX - handleMinX);
    handle.x = handleMinX + value * handleRange;
    const handleLeftEdge = handle.x - HANDLE_SIZE / 2;
    const fillWidth = Math.max(0, handleLeftEdge - trackLeft);
    fill.width = fillWidth;
    fill.x = trackLeft + fillWidth / 2;
    label.setText(formatPercent(value));
    renderChrome();
  }

  applyValue(value);

  function pointerToValue(pointer: SliderPointer): number {
    return clamp01((pointer.x - trackLeft) / trackWidth);
  }

  hitZone.on("pointerdown", (pointer: SliderPointer) => {
    dragging = true;
    applyValue(pointerToValue(pointer));
    onChange(value);
  });

  // Pointer-move on the whole scene is delegated by the scene's input system;
  // we hook into the zone's own pointermove (only fires when the pointer is
  // over the zone). To support dragging beyond the zone, the scene should
  // also forward global pointermove events. We provide a generic handler
  // that works for both cases.
  hitZone.on("pointermove", (pointer: SliderPointer) => {
    if (!dragging) {
      return;
    }
    applyValue(pointerToValue(pointer));
    onChange(value);
  });

  // pointerup anywhere should end dragging. Phaser's hit zone receives
  // pointerup only if the pointer is over the zone, so we ALSO listen on
  // pointerupoutside (a Phaser custom event emitted when pointer is
  // released off the interactive object). As a fallback, the next
  // pointerdown anywhere will reset dragging.
  hitZone.on("pointerup", () => {
    dragging = false;
  });
  hitZone.on("pointerout", (pointer: SliderPointer) => {
    // If the user keeps the button down while leaving the zone, treat it
    // as continued dragging only if pointer.isDown — we'll keep updating
    // via the global handler below if the scene wires it up.
    if (!pointer.isDown) {
      dragging = false;
    }
  });
  hitZone.on("pointerupoutside", () => {
    dragging = false;
  });

  // The slider exposes `handlePointerMove` and `endDrag` so the owning scene
  // can wire a global `pointermove` / `pointerup` listener that keeps the
  // drag alive even when the pointer leaves the hit zone. The scene is
  // responsible for forwarding these events (see MenuScene.create).

  return {
    setValue(next: number) {
      applyValue(next);
    },
    getValue() {
      return value;
    },
    handlePointerMove(pointer: SliderPointer) {
      if (!dragging || !pointer.isDown) {
        return;
      }
      applyValue(pointerToValue(pointer));
      onChange(value);
    },
    endDrag() {
      dragging = false;
    },
    destroy() {
      hitZone.removeAllListeners?.();
      trackChrome?.destroy?.();
      fillChrome?.destroy?.();
      handleChrome?.destroy?.();
    },
  };
}
