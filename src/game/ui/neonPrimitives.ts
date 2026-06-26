import { NEON_COLORS, NEON_PANEL } from "./neonTheme";

type NeonGraphics = {
  fillStyle: (color: number, alpha?: number) => NeonGraphics;
  fillRoundedRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    radius?: number,
  ) => NeonGraphics;
  lineStyle: (width: number, color: number, alpha?: number) => NeonGraphics;
  strokeRoundedRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    radius?: number,
  ) => NeonGraphics;
  setDepth?: (depth: number) => NeonGraphics;
  setVisible?: (visible: boolean) => NeonGraphics;
  clear?: () => NeonGraphics;
  destroy?: () => void;
};

type NeonSceneLike = {
  add: {
    graphics: () => NeonGraphics;
  };
};

export function drawNeonPanel(
  scene: NeonSceneLike,
  x: number,
  y: number,
  width: number,
  height: number,
): NeonGraphics {
  const g = scene.add.graphics();
  g.fillStyle(NEON_COLORS.bgPanel, 0.92);
  g.fillRoundedRect(x, y, width, height, NEON_PANEL.radius);
  g.lineStyle(6, NEON_COLORS.cyan, 0.14);
  g.strokeRoundedRect(x, y, width, height, NEON_PANEL.radius);
  g.lineStyle(NEON_PANEL.borderWidth, NEON_COLORS.cyan, 1);
  g.strokeRoundedRect(
    x + 4,
    y + 4,
    width - 8,
    height - 8,
    Math.max(NEON_PANEL.radius - 2, 0),
  );
  return g;
}
