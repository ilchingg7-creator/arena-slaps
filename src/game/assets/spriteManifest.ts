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
  // Relative path — resolves against the current document URL, so it
  // works when the build is hosted in a subdirectory (Yandex Games
  // hosts at /<appid>/<version-hash>/index.html). Absolute "/sprites/"
  // would resolve against the bucket root and 404 on Yandex.
  return `./sprites/${name}.png`;
}

export const SPRITE_DEFINITIONS: readonly SpriteDefinition[] = [
  // --- Player character sprites (7 states: idle + 4 run directions + slap + fall) ---
  {
    key: "player-idle",
    path: png("player-idle"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-run-n",
    path: png("player-run-n"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-run-s",
    path: png("player-run-s"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-run-e",
    path: png("player-run-e"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-run-w",
    path: png("player-run-w"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-slap",
    path: png("player-slap"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "player-fall",
    path: png("player-fall"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },

  // --- Bot character sprites (7 states, same shape as player) ---
  {
    key: "bot-idle",
    path: png("bot-idle"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-run-n",
    path: png("bot-run-n"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-run-s",
    path: png("bot-run-s"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-run-e",
    path: png("bot-run-e"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-run-w",
    path: png("bot-run-w"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-slap",
    path: png("bot-slap"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "bot-fall",
    path: png("bot-fall"),
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },

  // --- Original 3 power-ups (Phase 1) ---
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

  // --- New power-ups (Phase 2A — added for the new freeze / mega / double-slap effects) ---
  {
    key: "powerup-mega-knockback",
    path: png("powerup-mega-knockback"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0xe07a5f,
  },
  {
    key: "powerup-freeze",
    path: png("powerup-freeze"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0x88ccff,
  },
  {
    key: "powerup-double-slap",
    path: png("powerup-double-slap"),
    category: "effect",
    fallback: "circle",
    fallbackColor: 0x9b5de5,
  },

  // --- Backgrounds (Phase 1) ---
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

  // --- Logo (main menu title image) ---
  {
    key: "logo",
    path: png("logo"),
    category: "ui",
    fallback: "rectangle",
    fallbackColor: 0x9b5de5,
  },

  // --- Mute button sprites (sound + muted states) ---
  {
    key: "mute-sound",
    path: png("mute-sound"),
    category: "ui",
    fallback: "rectangle",
    fallbackColor: 0x81b29a,
  },
  {
    key: "mute-muted",
    path: png("mute-muted"),
    category: "ui",
    fallback: "rectangle",
    fallbackColor: 0xe07a5f,
  },

  // --- SFX/Music mute toggle sprites ---
  {
    key: "sfx-on", path: png("sfx-on"), category: "ui",
    fallback: "rectangle", fallbackColor: 0x81b29a,
  },
  {
    key: "sfx-muted", path: png("sfx-muted"), category: "ui",
    fallback: "rectangle", fallbackColor: 0xe07a5f,
  },
  {
    key: "music-on", path: png("music-on"), category: "ui",
    fallback: "rectangle", fallbackColor: 0x81b29a,
  },
  {
    key: "music-muted", path: png("music-muted"), category: "ui",
    fallback: "rectangle", fallbackColor: 0xe07a5f,
  },

  // --- New map backgrounds + platforms (5 maps × 2 = 10) ---
  {
    key: "arena-bg-neon", path: png("arena-bg-neon"), category: "background",
    width: 1280, height: 720, fallback: "rectangle", fallbackColor: 0x1a0b2e,
  },
  {
    key: "arena-platform-neon", path: png("arena-platform-neon"), category: "background",
    width: 920, height: 520, fallback: "rectangle", fallbackColor: 0x3c1450,
  },
  {
    key: "arena-bg-cosmic", path: png("arena-bg-cosmic"), category: "background",
    width: 1280, height: 720, fallback: "rectangle", fallbackColor: 0x0a0a32,
  },
  {
    key: "arena-platform-cosmic", path: png("arena-platform-cosmic"), category: "background",
    width: 920, height: 520, fallback: "rectangle", fallbackColor: 0x191e46,
  },
  {
    key: "arena-bg-volcano", path: png("arena-bg-volcano"), category: "background",
    width: 1280, height: 720, fallback: "rectangle", fallbackColor: 0x280a05,
  },
  {
    key: "arena-platform-volcano", path: png("arena-platform-volcano"), category: "background",
    width: 920, height: 520, fallback: "rectangle", fallbackColor: 0x501e0a,
  },
  {
    key: "arena-bg-ice", path: png("arena-bg-ice"), category: "background",
    width: 1280, height: 720, fallback: "rectangle", fallbackColor: 0x0a1e32,
  },
  {
    key: "arena-platform-ice", path: png("arena-platform-ice"), category: "background",
    width: 920, height: 520, fallback: "rectangle", fallbackColor: 0x285078,
  },
  {
    key: "arena-bg-grass", path: png("arena-bg-grass"), category: "background",
    width: 1280, height: 720, fallback: "rectangle", fallbackColor: 0x0a280f,
  },
  {
    key: "arena-platform-grass", path: png("arena-platform-grass"), category: "background",
    width: 920, height: 520, fallback: "rectangle", fallbackColor: 0x28501e,
  },

  // --- Cosmetic headwear (4 overlays — drawn above the actor sprite) ---
  {
    key: "headwear-cap", path: png("headwear-cap"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x325aa0,
  },
  {
    key: "headwear-crown", path: png("headwear-crown"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0xf0c83c,
  },
  {
    key: "headwear-horns", path: png("headwear-horns"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0xb41e1e,
  },
  {
    key: "headwear-halo", path: png("headwear-halo"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0xffdc3c,
  },
  {
    key: "headwear-helmet", path: png("headwear-helmet"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x787880,
  },

  // --- Premium cosmetic headwear (paid) ---
  { key: "headwear-wizard", path: png("headwear-wizard"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x3c50b4 },
  { key: "headwear-pirate", path: png("headwear-pirate"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x1e1e23 },
  { key: "headwear-space", path: png("headwear-space"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x96c8ff },
  { key: "headwear-ninja", path: png("headwear-ninja"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x141419 },
  { key: "headwear-viking", path: png("headwear-viking"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x785028 },
  { key: "headwear-tophat", path: png("headwear-tophat"), category: "character", width: 48, height: 48, fallback: "rectangle", fallbackColor: 0x141419 },

  // --- Premium trail particles (paid) ---
  { key: "trail-fire", path: png("trail-fire"), category: "effect", width: 16, height: 16, fallback: "circle", fallbackColor: 0xff6414 },
  { key: "trail-rainbow", path: png("trail-rainbow"), category: "effect", width: 16, height: 16, fallback: "circle", fallbackColor: 0xc864ff },
  { key: "trail-galaxy", path: png("trail-galaxy"), category: "effect", width: 16, height: 16, fallback: "circle", fallbackColor: 0x503cc8 },
  { key: "trail-poison", path: png("trail-poison"), category: "effect", width: 16, height: 16, fallback: "circle", fallbackColor: 0x50c832 },

  // --- Premium slap FX (paid) ---
  { key: "slapfx-explosion", path: png("slapfx-explosion"), category: "effect", width: 48, height: 48, fallback: "circle", fallbackColor: 0xff8c1e },
  { key: "slapfx-confetti", path: png("slapfx-confetti"), category: "effect", width: 48, height: 48, fallback: "circle", fallbackColor: 0xff5050 },
  { key: "slapfx-skull", path: png("slapfx-skull"), category: "effect", width: 48, height: 48, fallback: "circle", fallbackColor: 0xf0f0f0 },
  { key: "slapfx-heart", path: png("slapfx-heart"), category: "effect", width: 48, height: 48, fallback: "circle", fallbackColor: 0xff5078 },

  {
    key: "headwear-party-hat", path: png("headwear-party-hat"), category: "character",
    width: 48, height: 48, fallback: "rectangle", fallbackColor: 0xb432c8,
  },

  // --- Cosmetic trail particles (small soft circles for emitters) ---
  {
    key: "trail-dust", path: png("trail-dust"), category: "effect",
    width: 16, height: 16, fallback: "circle", fallbackColor: 0xb4aa96,
  },
  {
    key: "trail-sparkle", path: png("trail-sparkle"), category: "effect",
    width: 16, height: 16, fallback: "circle", fallbackColor: 0xffffff,
  },

  // --- Cosmetic slap FX (burst textures, 48×48) ---
  {
    key: "slapfx-star", path: png("slapfx-star"), category: "effect",
    width: 48, height: 48, fallback: "circle", fallbackColor: 0xffdc3c,
  },
  {
    key: "slapfx-lightning", path: png("slapfx-lightning"), category: "effect",
    width: 48, height: 48, fallback: "circle", fallbackColor: 0x78b4ff,
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
