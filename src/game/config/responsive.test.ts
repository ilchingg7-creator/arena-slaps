import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  computeArenaDimensions,
  computeUIScale,
  scaleFontSize,
  scalePx,
  isPortrait,
  isMobileScreen,
  isTouchDevice,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  ARENA_MAX_WIDTH,
  ARENA_MAX_HEIGHT,
} from "./responsive";

describe("responsive", () => {
  describe("computeArenaDimensions", () => {
    it("returns 920×~518 at design size (1280×720)", () => {
      const arena = computeArenaDimensions({ width: 1280, height: 720 });
      expect(arena.width).toBeCloseTo(920, 0);
      // 720 * 0.72 = 518.4, min(518.4, 520) = 518.4
      expect(arena.height).toBeCloseTo(518.4, 0);
    });

    it("centers arena horizontally", () => {
      const arena = computeArenaDimensions({ width: 1280, height: 720 });
      expect(arena.offsetX).toBeCloseTo((1280 - arena.width) / 2, 1);
    });

    it("offsets arena down by ~3% of screen height for HUD", () => {
      const arena = computeArenaDimensions({ width: 1280, height: 720 });
      expect(arena.offsetY).toBeGreaterThan(0);
      // offsetY = (720 - 518.4) / 2 + 720 * 0.03 = 100.8 + 21.6 = 122.4
      expect(arena.offsetY).toBeCloseTo(122.4, 0);
    });

    it("scales down on mobile (375×667)", () => {
      const arena = computeArenaDimensions({ width: 375, height: 667 });
      expect(arena.width).toBeLessThan(920);
      expect(arena.height).toBeLessThan(520);
      // Width = 375 * 0.72 = 270
      expect(arena.width).toBeCloseTo(270, 0);
      // Height = 667 * 0.72 = 480.24
      expect(arena.height).toBeCloseTo(480.24, 0);
    });

    it("scales down on tablet (768×1024)", () => {
      const arena = computeArenaDimensions({ width: 768, height: 1024 });
      expect(arena.width).toBeLessThan(920);
      // Width = 768 * 0.72 = 553
      expect(arena.width).toBeCloseTo(553, 0);
    });

    it("does not exceed max dimensions on large screens (1920×1080)", () => {
      const arena = computeArenaDimensions({ width: 1920, height: 1080 });
      expect(arena.width).toBe(ARENA_MAX_WIDTH);
      expect(arena.height).toBe(ARENA_MAX_HEIGHT);
    });

    it("centers arena on wide screens", () => {
      const arena = computeArenaDimensions({ width: 1920, height: 1080 });
      expect(arena.offsetX).toBeCloseTo((1920 - 920) / 2, 0);
    });

    it("arena fits within screen bounds on all test sizes", () => {
      const sizes = [
        { width: 1280, height: 720 },
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 },
        { width: 414, height: 896 },
        { width: 1366, height: 768 },
      ];
      for (const s of sizes) {
        const arena = computeArenaDimensions(s);
        expect(arena.width).toBeLessThanOrEqual(s.width);
        expect(arena.height).toBeLessThanOrEqual(s.height);
        expect(arena.offsetX).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("computeUIScale", () => {
    it("returns 1.0 at design size (1280×720)", () => {
      expect(computeUIScale({ width: 1280, height: 720 })).toBeCloseTo(1.0, 2);
    });

    it("returns < 1.0 on mobile (375×667)", () => {
      const scale = computeUIScale({ width: 375, height: 667 });
      expect(scale).toBeLessThan(1.0);
      // min(375/1280, 667/720) = min(0.293, 0.926) = 0.293
      expect(scale).toBeCloseTo(0.293, 0);
    });

    it("returns > 1.0 on large screens (1920×1080)", () => {
      const scale = computeUIScale({ width: 1920, height: 1080 });
      expect(scale).toBeGreaterThan(1.0);
      // min(1920/1280, 1080/720) = min(1.5, 1.5) = 1.5 → capped at 1.3
      expect(scale).toBe(1.3);
    });

    it("is capped at 1.3 maximum", () => {
      const scale = computeUIScale({ width: 3840, height: 2160 });
      expect(scale).toBe(1.3);
    });

    it("is floored at 0.5 minimum", () => {
      const scale = computeUIScale({ width: 200, height: 200 });
      expect(scale).toBe(0.5);
    });

    it("handles portrait orientation (375×812)", () => {
      const scale = computeUIScale({ width: 375, height: 812 });
      // min(375/1280, 812/720) = min(0.293, 1.128) = 0.293
      expect(scale).toBeCloseTo(0.293, 0);
    });

    it("handles landscape mobile (812×375)", () => {
      const scale = computeUIScale({ width: 812, height: 375 });
      // min(812/1280, 375/720) = min(0.634, 0.521) = 0.521
      expect(scale).toBeCloseTo(0.521, 0);
    });
  });

  describe("scaleFontSize", () => {
    it("returns base size at scale 1.0", () => {
      expect(scaleFontSize(22, 1.0)).toBe("22px");
    });

    it("scales down at 0.5", () => {
      expect(scaleFontSize(22, 0.5)).toBe("11px");
    });

    it("scales up at 1.3", () => {
      expect(scaleFontSize(22, 1.3)).toBe("29px");
    });

    it("rounds to integer", () => {
      expect(scaleFontSize(22, 0.293)).toBe("6px");
    });
  });

  describe("scalePx", () => {
    it("returns base at scale 1.0", () => {
      expect(scalePx(240, 1.0)).toBe(240);
    });

    it("scales down at 0.5", () => {
      expect(scalePx(240, 0.5)).toBe(120);
    });

    it("rounds to integer", () => {
      expect(scalePx(240, 0.293)).toBe(70);
    });
  });

  describe("isPortrait", () => {
    it("returns true when height > width", () => {
      expect(isPortrait({ width: 375, height: 812 })).toBe(true);
    });

    it("returns false when width > height", () => {
      expect(isPortrait({ width: 1280, height: 720 })).toBe(false);
    });

    it("returns false for square", () => {
      expect(isPortrait({ width: 500, height: 500 })).toBe(false);
    });
  });

  describe("isMobileScreen", () => {
    it("returns false at design size", () => {
      expect(isMobileScreen({ width: 1280, height: 720 })).toBe(false);
    });

    it("returns true for mobile (375×667)", () => {
      expect(isMobileScreen({ width: 375, height: 667 })).toBe(true);
    });

    it("returns false for large desktop (1920×1080)", () => {
      expect(isMobileScreen({ width: 1920, height: 1080 })).toBe(false);
    });
  });

  describe("isTouchDevice", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns false when window is undefined (SSR)", () => {
      vi.stubGlobal("window", undefined);
      expect(isTouchDevice()).toBe(false);
    });

    it("returns true when ontouchstart exists", () => {
      vi.stubGlobal("window", { ontouchstart: () => {} });
      vi.stubGlobal("navigator", { maxTouchPoints: 0 });
      expect(isTouchDevice()).toBe(true);
    });

    it("returns true when maxTouchPoints > 0", () => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", { maxTouchPoints: 5 });
      expect(isTouchDevice()).toBe(true);
    });

    it("returns false when neither touch feature exists", () => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", { maxTouchPoints: 0 });
      expect(isTouchDevice()).toBe(false);
    });
  });

  describe("constants", () => {
    it("DESIGN_WIDTH is 1280", () => {
      expect(DESIGN_WIDTH).toBe(1280);
    });
    it("DESIGN_HEIGHT is 720", () => {
      expect(DESIGN_HEIGHT).toBe(720);
    });
    it("ARENA_MAX_WIDTH is 920", () => {
      expect(ARENA_MAX_WIDTH).toBe(920);
    });
    it("ARENA_MAX_HEIGHT is 520", () => {
      expect(ARENA_MAX_HEIGHT).toBe(520);
    });
  });
});
