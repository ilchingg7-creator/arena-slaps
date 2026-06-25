import { describe, expect, it } from "vitest";
import {
  NEON_COLORS,
  NEON_PANEL,
  getHudTextStyle,
  getNeonButtonVariant,
} from "./neonTheme";

describe("neonTheme", () => {
  it("exports the Cyber Fight Club accent colors", () => {
    expect(NEON_COLORS.bgInk).toBe(0x090b12);
    expect(NEON_COLORS.cyan).toBe(0x20f6ff);
    expect(NEON_COLORS.lime).toBe(0xb7ff3c);
    expect(NEON_COLORS.magenta).toBe(0xff4fd8);
    expect(NEON_COLORS.impact).toBe(0xff5a36);
  });

  it("maps primary buttons to dark chrome plus neon borders", () => {
    expect(getNeonButtonVariant("primary")).toMatchObject({
      body: 0x101522,
      edge: 0x20f6ff,
      glow: 0x20f6ff,
      text: 0xf6fbff,
    });
  });

  it("maps secondary buttons to the muted neon border", () => {
    expect(getNeonButtonVariant("secondary")).toMatchObject({
      body: 0x101522,
      edge: 0x6f7a94,
      glow: 0x6f7a94,
      text: 0xf6fbff,
    });
  });

  it("falls back to the secondary chrome for unknown button variants", () => {
    expect(getNeonButtonVariant("invalid" as never)).toMatchObject({
      body: 0x101522,
      edge: 0x6f7a94,
      glow: 0x6f7a94,
      text: 0xf6fbff,
    });
  });

  it("exports a compact HUD style with readable stroke", () => {
    expect(getHudTextStyle("score")).toMatchObject({
      fontFamily: "Arial",
      fontStyle: "bold",
      strokeThickness: 4,
    });
    expect(NEON_PANEL.radius).toBeGreaterThan(0);
  });
});
