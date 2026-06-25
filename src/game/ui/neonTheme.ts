import type { ButtonVariant } from "./StyledButton";

export const NEON_COLORS = {
  bgInk: 0x090b12,
  bgPanel: 0x101522,
  bgPanelAlt: 0x151b2b,
  cyan: 0x20f6ff,
  lime: 0xb7ff3c,
  magenta: 0xff4fd8,
  impact: 0xff5a36,
  text: 0xf6fbff,
  textMuted: 0x92a0bb,
} as const;

export const NEON_PANEL = {
  radius: 12,
  borderWidth: 2,
  glowAlpha: 0.18,
} as const;

export type NeonButtonVariant = {
  body: number;
  edge: number;
  glow: number;
  text: number;
};

export function getNeonButtonVariant(
  variant: ButtonVariant,
): NeonButtonVariant {
  const common = {
    body: NEON_COLORS.bgPanel,
    text: NEON_COLORS.text,
  };

  switch (variant) {
    case "primary":
      return { ...common, edge: NEON_COLORS.cyan, glow: NEON_COLORS.cyan };
    case "success":
      return { ...common, edge: NEON_COLORS.lime, glow: NEON_COLORS.lime };
    case "danger":
      return { ...common, edge: NEON_COLORS.impact, glow: NEON_COLORS.impact };
    case "warning":
      return {
        ...common,
        edge: NEON_COLORS.magenta,
        glow: NEON_COLORS.magenta,
      };
    case "secondary":
    default:
      return { ...common, edge: 0x6f7a94, glow: 0x6f7a94 };
  }
}

export function getHudTextStyle(kind: "score" | "timer" | "title") {
  return {
    color: "#f6fbff",
    fontFamily: "Arial",
    fontSize: kind === "title" ? "42px" : "24px",
    fontStyle: "bold",
    stroke: "#05070d",
    strokeThickness: kind === "title" ? 5 : 4,
    shadow: {
      offsetX: 0,
      offsetY: 0,
      color: "#20f6ff",
      blur: 10,
      fill: false,
    },
  };
}
