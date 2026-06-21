/**
 * Central manifest of all sprite textures in the game.
 *
 * The pipeline is manifest-driven: scenes never hardcode sprite file paths.
 * `spriteLoader.ts` iterates this manifest in `PreloadScene` and calls
 * `scene.load.image(key, path)` for each entry. `SpriteManager.ts` then
 * looks up a definition by key when a scene asks it to create a game
 * object — and falls back to a primitive (rectangle / circle) when the
 * texture isn't loaded yet (e.g. during development before the PNG exists,
 * or on a low-end device that skips sprite loading).
 *
 * TO ADD A NEW SPRITE:
 *   1. Add a new entry to {@link SPRITE_DEFINITIONS} below.
 *   2. Drop the `.png` file into `/public/sprites/` using the filename you
 *      used in the `path` field. (If the file is missing the fallback
 *      primitive will be rendered, so you can develop against the manifest
 *      before the art is ready.)
 *   3. Reference the new key from a scene via
 *      `spriteManager.createSprite("your-key", x, y)`.
 *
 * TO ADD A SPRITE ATLAS (for animations):
 *   1. Add a new entry to {@link SPRITE_ATLASES} with the image PNG path
 *      and the JSON atlas path (exported by TexturePacker / Phaser's
 *      atlas exporter).
 *   2. Drop both files into `/public/sprites/`.
 *   3. `PreloadScene` will call `scene.load.atlas(key, imagePath, atlasPath)`.
 *
 * All paths are relative to /public/ (Vite convention) and MUST end in
 * `.png` for sprites / `.png`+`.json` for atlases.
 *
 * Naming convention: `<category>-<name>.png` (e.g. `player-idle.png`,
 * `powerup-speed.png`).
 */

export type SpriteCategory = "character" | "ui" | "background" | "effect";

export type SpriteDefinition = {
  /** Unique key used to look up the texture in Phaser's TextureManager. */
  key: string;
  /** Path under /public/, e.g. "/sprites/player-idle.png". */
  path: string;
  /** Logical grouping used by getSpritesByCategory and tooling. */
  category: SpriteCategory;
  /** Optional display width. Defaults to the texture's natural width when omitted. */
  width?: number;
  /** Optional display height. Defaults to the texture's natural height when omitted. */
  height?: number;
  /** Which primitive to render if the texture is missing. */
  fallback: "rectangle" | "circle";
  /** Fill color for the fallback primitive. */
  fallbackColor: number;
};

export type AtlasDefinition = {
  /** Unique atlas key, e.g. "player-atlas". */
  key: string;
  /** Path to the PNG (under /public/). */
  imagePath: string;
  /** Path to the JSON atlas (under /public/). */
  atlasPath: string;
  category: SpriteCategory;
};

function png(name: string): string {
  return `/sprites/${name}.png`;
}

export const SPRITE_DEFINITIONS: readonly SpriteDefinition[] = [
  {
    key: "player-idle",
    path: png("player-idle"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "bot-idle",
    path: png("bot-idle"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "powerup-speed",
    path: png("powerup-speed"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0x81b29a,
  },
  {
    key: "powerup-knockback",
    path: png("powerup-knockback"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0xf2cc8f,
  },
  {
    key: "powerup-shield",
    path: png("powerup-shield"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "menu-bg",
    path: png("menu-bg"),
    category: "background",
    width: 1280,
    height: 720,
    fallback: "rectangle",
    fallbackColor: 0x101820, // dark navy
  },
  {
    key: "arena-bg",
    path: png("arena-bg"),
    category: "background",
    width: 1280,
    height: 720,
    fallback: "rectangle",
    fallbackColor: 0x1a1a2e, // dark blue-purple
  },
  {
    key: "arena-platform",
    path: png("arena-platform"),
    category: "background",
    width: 920,
    height: 520,
    fallback: "rectangle",
    fallbackColor: 0x2a2d44,
  },
];

export const SPRITE_ATLASES: readonly AtlasDefinition[] = [
  // Placeholder for future animated character atlases.
  // Example:
  // {
  //   key: "player-atlas",
  //   imagePath: "/sprites/player-atlas.png",
  //   atlasPath: "/sprites/player-atlas.json",
  //   category: "character",
  // },
];

/**
 * Look up a single sprite definition by key. Throws if the key is not
 * registered in the manifest — this surfaces programmer errors (typos,
 * referencing a sprite that hasn't been added yet) at the call site
 * instead of silently rendering a missing-texture placeholder.
 */
export function getSpriteDefinition(key: string): SpriteDefinition {
  const def = SPRITE_DEFINITIONS.find((entry) => entry.key === key);
  if (!def) {
    throw new Error(`No sprite definition for key: ${key}`);
  }
  return def;
}

/**
 * Return every sprite definition whose category matches. Useful for batch
 * operations like "load all UI sprites" or "log all character sprites".
 */
export function getSpritesByCategory(
  category: SpriteCategory,
): readonly SpriteDefinition[] {
  return SPRITE_DEFINITIONS.filter((entry) => entry.category === category);
}

/**
 * Return the full list of sprite definitions. Equivalent to reading
 * {@link SPRITE_DEFINITIONS} directly; provided as a function for symmetry
 * with {@link getSpritesByCategory} and to keep a stable API if the
 * underlying storage ever changes.
 */
export function getAllSpritePaths(): readonly SpriteDefinition[] {
  return SPRITE_DEFINITIONS;
}
