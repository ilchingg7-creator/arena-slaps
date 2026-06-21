/**
 * A reusable modern "youth-appealing" button for Phaser scenes.
 *
 * Renders:
 *   - A Graphics object positioned at (x, y) with a vertical gradient
 *     (top color lighter, bottom color darker) drawn with
 *     `fillGradientRoundedRect`, plus an outer accent stroke for the
 *     glow/border effect.
 *   - A bold text label centered on the button, with a subtle dark
 *     stroke + drop shadow for readability.
 *   - Interactive hit area covering the button bounds (Phaser computes
 *     the Graphics bounds automatically when `setInteractive` is called
 *     without an explicit hit area).
 *
 * Interaction:
 *   - pointerover  -> scale up to 1.05x
 *   - pointerout   -> reset scale to 1.0x
 *   - pointerdown  -> scale down to 0.95x
 *   - pointerup    -> scale back to 1.05x and fire onClick
 *
 * The component does NOT depend on Phaser types directly (uses a minimal
 * duck type) so it can be exercised in unit tests with a stub scene,
 * mirroring the VolumeSlider / TopRightMuteButton pattern.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning";

export type StyledButtonConfig = {
  x: number;
  y: number;
  text: string;
  variant?: ButtonVariant;
  width?: number; // default 240
  height?: number; // default 56
  fontSize?: number; // default 22
  onClick: () => void;
};

export type StyledButton = {
  /** Update the button's text label. */
  setText: (text: string) => void;
  /** Change the variant (re-renders the gradient). */
  setVariant: (variant: ButtonVariant) => void;
  /** Show/hide the button. */
  setVisible: (visible: boolean) => void;
  /** Enable/disable interaction. When disabled, dims the button. */
  setEnabled: (enabled: boolean) => void;
  /** Clean up listeners. */
  destroy: () => void;
};

export type VariantColors = {
  top: number;
  bottom: number;
  border: number;
  text: number;
};

export type ButtonBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 56;
const DEFAULT_FONT_SIZE = 22;
const DEFAULT_RADIUS = 14;
const BORDER_WIDTH = 3;
const HOVER_SCALE = 1.05;
const PRESS_SCALE = 0.95;
const DISABLED_ALPHA = 0.5;

/**
 * Per-variant color palette. `top` is the lighter gradient stop, `bottom`
 * the darker one, `border` is the accent stroke color, and `text` is the
 * label color (dark for the yellow warning variant for readability).
 */
const VARIANT_COLORS: Record<ButtonVariant, VariantColors> = {
  // purple/magenta gradient with cyan accent
  primary: { top: 0x9b5de5, bottom: 0x5f2eea, border: 0x00f5d4, text: 0xffffff },
  // dark blue gradient with light accent
  secondary: { top: 0x3d405b, bottom: 0x2a2d44, border: 0xb8b8ff, text: 0xffffff },
  // green gradient with white accent
  success: { top: 0x81b29a, bottom: 0x5a8771, border: 0xffffff, text: 0xffffff },
  // orange/red gradient with yellow accent
  danger: { top: 0xe07a5f, bottom: 0xc45a3f, border: 0xffd166, text: 0xffffff },
  // yellow gradient with dark accent + dark text
  warning: { top: 0xf2cc8f, bottom: 0xd4a85f, border: 0x101820, text: 0x101820 },
};

/**
 * Return the color palette for a given variant. Pure function — easy to
 * unit-test. Throws for unknown variants (defensive: TypeScript already
 * prevents this at compile time, but a runtime JS caller could pass junk).
 */
export function getVariantColors(variant: ButtonVariant): VariantColors {
  const colors = VARIANT_COLORS[variant];
  if (!colors) {
    throw new Error(`Unknown button variant: ${String(variant)}`);
  }
  return { ...colors };
}

/**
 * Compute the button's bounding box, applying default width/height when
 * not specified. Pure function — easy to unit-test.
 */
export function getButtonBounds(config: StyledButtonConfig): ButtonBounds {
  return {
    x: config.x,
    y: config.y,
    width: config.width ?? DEFAULT_WIDTH,
    height: config.height ?? DEFAULT_HEIGHT,
  };
}

// --- Scene duck types ----------------------------------------------------

export type ButtonGraphics = {
  clear: () => ButtonGraphics;
  fillStyle: (color: number, alpha?: number) => ButtonGraphics;
  fillGradientRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    alpha?: number,
  ) => ButtonGraphics;
  fillRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius?: number,
  ) => ButtonGraphics;
  lineStyle: (width: number, color: number, alpha?: number) => ButtonGraphics;
  strokeRoundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    radius?: number,
  ) => ButtonGraphics;
  setPosition: (x: number, y: number) => ButtonGraphics;
  setScale: (x: number, y?: number) => ButtonGraphics;
  setVisible: (visible: boolean) => ButtonGraphics;
  setAlpha: (alpha: number) => ButtonGraphics;
  setDepth: (depth: number) => ButtonGraphics;
  setInteractive: (config?: { useHandCursor?: boolean }) => ButtonGraphics;
  on: (event: string, handler: (pointer?: unknown) => void) => ButtonGraphics;
  removeAllListeners: () => ButtonGraphics;
  destroy: () => void;
};

export type ButtonText = {
  setOrigin: (x?: number, y?: number) => ButtonText;
  setText: (value: string) => ButtonText;
  setScale: (x: number, y?: number) => ButtonText;
  setVisible: (visible: boolean) => ButtonText;
  setAlpha: (alpha: number) => ButtonText;
  setDepth: (depth: number) => ButtonText;
  destroy: () => void;
};

export type ButtonTextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontStyle?: string;
  stroke?: string;
  strokeThickness?: number;
  shadow?: {
    offsetX?: number;
    offsetY?: number;
    color?: string;
    blur?: number;
    fill?: boolean;
  };
};

export type ButtonSceneLike = {
  add: {
    graphics: (config?: unknown) => ButtonGraphics;
    text: (x: number, y: number, value: string, style?: ButtonTextStyle) => ButtonText;
  };
};

function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Create a StyledButton. The button is positioned at (config.x, config.y)
 * which becomes the center of the rounded rectangle. The Graphics object
 * is positioned at that point and the gradient geometry is drawn around
 * the local origin (0,0) so scale tweens stay centered.
 */
export function createStyledButton(
  scene: ButtonSceneLike,
  config: StyledButtonConfig,
): StyledButton {
  const variant: ButtonVariant = config.variant ?? "primary";
  const bounds = getButtonBounds(config);
  const fontSize = config.fontSize ?? DEFAULT_FONT_SIZE;
  let enabled = true;

  const graphics: ButtonGraphics = scene.add.graphics();
  graphics.setPosition(bounds.x, bounds.y);
  graphics.setDepth(0);

  const initialColors = getVariantColors(variant);
  const label = scene.add
    .text(bounds.x, bounds.y, config.text, {
      color: colorToHex(initialColors.text),
      fontFamily: "Arial",
      fontStyle: "bold",
      fontSize: `${fontSize}px`,
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: "#000000", blur: 4, fill: true },
    })
    .setOrigin(0.5, 0.5)
    .setDepth(1);

  function render(currentVariant: ButtonVariant): void {
    const colors = getVariantColors(currentVariant);
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;

    graphics.clear();
    // Vertical gradient: top corners use `top`, bottom corners use `bottom`.
    graphics.fillGradientRoundedRect(
      -halfW,
      -halfH,
      bounds.width,
      bounds.height,
      DEFAULT_RADIUS,
      colors.top,
      colors.top,
      colors.bottom,
      colors.bottom,
      1,
    );
    // Outer accent stroke for the glow/border effect.
    graphics.lineStyle(BORDER_WIDTH, colors.border, 1);
    graphics.strokeRoundedRect(
      -halfW,
      -halfH,
      bounds.width,
      bounds.height,
      DEFAULT_RADIUS,
    );
  }

  render(variant);

  graphics.setInteractive({ useHandCursor: true });

  graphics.on("pointerover", () => {
    if (!enabled) return;
    graphics.setScale(HOVER_SCALE, HOVER_SCALE);
    label.setScale(HOVER_SCALE, HOVER_SCALE);
  });
  graphics.on("pointerout", () => {
    graphics.setScale(1, 1);
    label.setScale(1, 1);
  });
  graphics.on("pointerdown", () => {
    if (!enabled) return;
    graphics.setScale(PRESS_SCALE, PRESS_SCALE);
    label.setScale(PRESS_SCALE, PRESS_SCALE);
  });
  graphics.on("pointerup", () => {
    if (!enabled) return;
    graphics.setScale(HOVER_SCALE, HOVER_SCALE);
    label.setScale(HOVER_SCALE, HOVER_SCALE);
    config.onClick();
  });

  return {
    setText(next: string) {
      label.setText(next);
    },
    setVariant(next: ButtonVariant) {
      render(next);
    },
    setVisible(v: boolean) {
      graphics.setVisible(v);
      label.setVisible(v);
    },
    setEnabled(e: boolean) {
      enabled = e;
      graphics.setAlpha(e ? 1 : DISABLED_ALPHA);
      label.setAlpha(e ? 1 : DISABLED_ALPHA);
      if (!e) {
        // Reset any in-flight hover/press scale so the disabled state
        // shows the button at its natural size.
        graphics.setScale(1, 1);
        label.setScale(1, 1);
      }
    },
    destroy() {
      graphics.removeAllListeners();
      graphics.destroy();
      label.destroy();
    },
  };
}
