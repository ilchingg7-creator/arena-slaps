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

export type SliderSceneLike = {
  add: {
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

type SliderPointer = {
  x: number;
  y: number;
  isDown: boolean;
};

export type VolumeSlider = {
  setValue: (next: number) => void;
  getValue: () => number;
  destroy: () => void;
};

const TRACK_COLOR = 0x3d405b;
const FILL_COLOR = 0x81b29a;
const HANDLE_COLOR = 0xf4f1de;
const LABEL_COLOR = "#f4f1de";
const SNAP_STEP = 0.05; // 5% increments
const TRACK_HEIGHT = 12;
const HANDLE_SIZE = 22;

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

  // Fill (left-anchored). Phaser rectangles are centered by default, so we
  // compute the fill's center x as: left edge of track + half the fill width.
  const trackLeft = centerX - trackWidth / 2;
  const fill = scene.add
    .rectangle(centerX, centerY, 0, TRACK_HEIGHT, FILL_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(2);

  // Handle (draggable square)
  const handle = scene.add
    .rectangle(centerX, centerY, HANDLE_SIZE, HANDLE_SIZE, HANDLE_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(3);

  // Percentage label
  const label = scene.add
    .text(centerX, centerY - 30, formatPercent(value), {
      color: LABEL_COLOR,
      fontFamily: "Arial",
      fontSize: "16px",
    })
    .setOrigin(0.5, 0.5);

  // Interactive zone covering the track + a bit of vertical slack so the
  // user doesn't have to hit the 12px-tall track exactly.
  const hitZone = scene.add
    .zone(centerX, centerY, trackWidth + HANDLE_SIZE, HANDLE_SIZE + 20)
    .setInteractive({ useHandCursor: true });

  function applyValue(next: number): void {
    value = clamp01(snapToStep(next, SNAP_STEP));
    const fillWidth = value * trackWidth;
    fill.width = fillWidth;
    // Reposition fill so its left edge stays at trackLeft.
    fill.x = trackLeft + fillWidth / 2;
    handle.x = trackLeft + value * trackWidth;
    label.setText(formatPercent(value));
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

  // The scene may not wire a global pointermove handler. To make the slider
  // usable even when the user drags beyond the hit zone, we attach a global
  // pointermove via the zone itself by listening on pointermove events that
  // bubble through scene.input. Phaser dispatches pointermove to whatever
  // interactive object is under the pointer; if the pointer leaves the zone,
  // we lose the event. As a pragmatic compromise we ALSO expose a public
  // `setValue` so the scene can drive the slider programmatically, and we
  // accept the limitation that drag must stay within the zone.

  return {
    setValue(next: number) {
      applyValue(next);
    },
    getValue() {
      return value;
    },
    destroy() {
      hitZone.removeAllListeners?.();
    },
  };
}
