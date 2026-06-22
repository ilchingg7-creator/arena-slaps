/**
 * Responsive layout helpers.
 *
 * The game uses Scale.RESIZE — the canvas fills the entire viewport and
 * `this.scale.width` / `this.scale.height` reflect the real screen size.
 * These helpers compute arena dimensions and UI scale factors relative
 * to the current screen size so the game looks correct on any device.
 *
 * Design target: 1280×720 (desktop). The arena is 920×520 at this size.
 * On smaller screens (mobile), the arena and UI scale down proportionally.
 */

export type ScreenSize = { width: number; height: number };

export type ArenaDimensions = {
  width: number;
  height: number;
  /** X offset to center the arena horizontally. */
  offsetX: number;
  /** Y offset to center the arena vertically (leaving room for HUD). */
  offsetY: number;
};

/**
 * Reference resolution — the "design size" the game was originally built for.
 * At this resolution, all default sizes (arena 920×520, font 22px, etc.)
 * look correct with a scale factor of 1.0.
 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/**
 * Arena size as a fraction of the screen.
 * - Width: min(80% of screen width, 920px at design size)
 * - Height: min(72% of screen height, 520px at design size)
 * The arena never exceeds the design size (no upscaling beyond 1280×720
 * proportions), but shrinks on smaller screens.
 */
export const ARENA_WIDTH_RATIO = 0.72;
export const ARENA_HEIGHT_RATIO = 0.72;
export const ARENA_MAX_WIDTH = 920;
export const ARENA_MAX_HEIGHT = 520;

/**
 * Compute arena dimensions for the given screen size.
 * The arena is centered horizontally and positioned with a small top
 * offset for the HUD (score + timer).
 */
export function computeArenaDimensions(screen: ScreenSize): ArenaDimensions {
  const width = Math.min(screen.width * ARENA_WIDTH_RATIO, ARENA_MAX_WIDTH);
  const height = Math.min(screen.height * ARENA_HEIGHT_RATIO, ARENA_MAX_HEIGHT);
  const offsetX = (screen.width - width) / 2;
  const offsetY = (screen.height - height) / 2 + screen.height * 0.03; // 3% down for HUD
  return { width, height, offsetX, offsetY };
}

/**
 * Compute a UI scale factor for the given screen size.
 * - At 1280×720 (design size): scale = 1.0
 * - At smaller screens: scale < 1.0 (smaller fonts/buttons)
 * - At larger screens: scale capped at 1.3 (don't over-scale)
 *
 * The factor is based on the smaller dimension (min of width/height ratio)
 * so portrait and landscape both get a reasonable scale.
 */
export function computeUIScale(screen: ScreenSize): number {
  const widthRatio = screen.width / DESIGN_WIDTH;
  const heightRatio = screen.height / DESIGN_HEIGHT;
  const scale = Math.min(widthRatio, heightRatio);
  return Math.min(1.3, Math.max(0.5, scale));
}

/**
 * Scale a font size (in px) by the UI scale factor.
 */
export function scaleFontSize(basePx: number, scale: number): string {
  return `${Math.round(basePx * scale)}px`;
}

/**
 * Scale a pixel dimension by the UI scale factor.
 */
export function scalePx(basePx: number, scale: number): number {
  return Math.round(basePx * scale);
}

/**
 * Check if the screen is in portrait orientation.
 */
export function isPortrait(screen: ScreenSize): boolean {
  return screen.height > screen.width;
}

/**
 * Check if the screen is mobile-sized (smaller than design in either dimension).
 */
export function isMobileScreen(screen: ScreenSize): boolean {
  return screen.width < DESIGN_WIDTH || screen.height < DESIGN_HEIGHT;
}

/**
 * Check if the device supports touch input.
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}
