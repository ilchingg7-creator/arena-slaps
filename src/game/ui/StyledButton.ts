import {
  NEON_COLORS,
  NEON_PANEL,
  getHudTextStyle,
  getNeonButtonVariant,
} from "./neonTheme";

/**
 * A reusable modern "youth-appealing" button for Phaser scenes.
 *
 * Renders:
 *   - A Graphics object positioned at (x, y) with a dark neon panel fill
 *     plus a glow stroke and inset accent border.
 *   - A bold text label centered on the button.
 *   - Interactive hit area covering the button bounds.
 *
 * Interaction:
 *   - pointerover  -> scale up to 1.05x
 *   - pointerout   -> reset scale to 1.0x
 *   - pointerdown  -> scale down to 0.95x
 *   - pointerup    -> scale back to 1.05x and fire onClick
 *
 * The component does NOT depend on Phaser types directly (uses a minimal
 * duck type) so it can be exercised in unit tests with a stub scene.
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
  width?: number;
  height?: number;
  fontSize?: number;
  onClick: () => void;
};

export type StyledButton = {
  setText: (text: string) => void;
  setVariant: (variant: ButtonVariant) => void;
  setVisible: (visible: boolean) => void;
  setDepth: (depth: number) => void;
  setEnabled: (enabled: boolean) => void;
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
const HOVER_SCALE = 1.05;
const PRESS_SCALE = 0.95;
const DISABLED_ALPHA = 0.5;

export function getVariantColors(variant: ButtonVariant): VariantColors {
  const neon = getNeonButtonVariant(variant);
  return {
    top: NEON_COLORS.bgPanelAlt,
    bottom: neon.body,
    border: neon.edge,
    text: neon.text,
  };
}

export function getButtonBounds(config: StyledButtonConfig): ButtonBounds {
  return {
    x: config.x,
    y: config.y,
    width: config.width ?? DEFAULT_WIDTH,
    height: config.height ?? DEFAULT_HEIGHT,
  };
}

export type ButtonGraphics = {
  clear: () => ButtonGraphics;
  fillStyle: (color: number, alpha?: number) => ButtonGraphics;
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
  setInteractive: (
    config?:
      | { useHandCursor?: boolean }
      | {
          hitArea: unknown;
          hitAreaCallback: (
            hitArea: unknown,
            x: number,
            y: number,
          ) => boolean;
          useHandCursor?: boolean;
        },
  ) => ButtonGraphics;
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
    text: (
      x: number,
      y: number,
      value: string,
      style?: ButtonTextStyle,
    ) => ButtonText;
  };
};

function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

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

  const initialColors = getNeonButtonVariant(variant);
  const textStyle = getHudTextStyle("score");
  const label = scene.add
    .text(bounds.x, bounds.y, config.text, {
      ...textStyle,
      color: colorToHex(initialColors.text),
      fontSize: `${fontSize}px`,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(1);

  function render(currentVariant: ButtonVariant): void {
    const colors = getNeonButtonVariant(currentVariant);
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;

    graphics.clear();
    graphics.fillStyle(colors.body, 1);
    graphics.fillRoundedRect(
      -halfW,
      -halfH,
      bounds.width,
      bounds.height,
      NEON_PANEL.radius,
    );
    graphics.lineStyle(6, colors.glow, NEON_PANEL.glowAlpha);
    graphics.strokeRoundedRect(
      -halfW,
      -halfH,
      bounds.width,
      bounds.height,
      NEON_PANEL.radius,
    );
    graphics.lineStyle(NEON_PANEL.borderWidth, colors.edge, 1);
    graphics.strokeRoundedRect(
      -halfW + 3,
      -halfH + 3,
      bounds.width - 6,
      bounds.height - 6,
      NEON_PANEL.radius - 2,
    );
  }

  render(variant);

  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;
  const hitArea = {
    x: -halfW,
    y: -halfH,
    width: bounds.width,
    height: bounds.height,
  };
  const hitAreaCallback = (ha: unknown, px: number, py: number): boolean => {
    const r = ha as { x: number; y: number; width: number; height: number };
    return (
      px >= r.x &&
      px <= r.x + r.width &&
      py >= r.y &&
      py <= r.y + r.height
    );
  };
  graphics.setInteractive({ hitArea, hitAreaCallback, useHandCursor: true });

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
    setDepth(d: number) {
      graphics.setDepth(d);
      label.setDepth(d);
    },
    setEnabled(e: boolean) {
      enabled = e;
      graphics.setAlpha(e ? 1 : DISABLED_ALPHA);
      label.setAlpha(e ? 1 : DISABLED_ALPHA);
      if (!e) {
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
