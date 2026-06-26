/**
 * Central manifest of all game sound effects and music tracks.
 *
 * TO REPLACE A SOUND:
 *   1. Drop a `.ogg` file into /public/sounds/ with the same filename,
 *      OR change the `path` field below to point at your new file.
 *   2. The build pipeline (PreloadScene -> loadSounds) reads this manifest
 *      verbatim, so no other code changes are required.
 *
 * TO ADD A NEW SOUND:
 *   1. Add a new entry to {@link SoundKey} (the union type below).
 *   2. Add a matching entry to {@link SOUND_MANIFEST} with a `category`
 *      ("sfx" or "music").
 *   3. Optionally expose a high-level method on {@link AudioService}.
 *
 * All paths are relative to /public/ (Vite convention) and MUST end in .ogg.
 */

export const SOUND_KEYS = [
  // SFX (10)
  "slap-hit",
  "slap-miss",
  "powerup-collect",
  "ring-out",
  "round-win",
  "round-lose",
  "round-draw",
  "countdown-tick",
  "menu-click",
  "menu-start",
  // Music (2)
  "menu-theme",
  "battle-theme",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

export type SoundCategory = "sfx" | "music";

export type SoundDefinition = {
  key: SoundKey;
  path: string;
  category: SoundCategory;
  /**
   * Optional per-sound volume multiplier (0..1), applied on top of the
   * category volume (sfxVolume or musicVolume). Useful for taming loud SFX
   * without touching the mix.
   */
  volume?: number;
};

function ogg(name: string): string {
  // Relative path — resolves against the current document URL, so it
  // works when the build is hosted in a subdirectory (Yandex Games).
  return `./sounds/${name}.ogg`;
}

export const SOUND_MANIFEST: readonly SoundDefinition[] = [
  // SFX
  { key: "slap-hit", path: ogg("slap-hit"), category: "sfx", volume: 0.9 },
  { key: "slap-miss", path: ogg("slap-miss"), category: "sfx", volume: 0.5 },
  { key: "powerup-collect", path: ogg("powerup-collect"), category: "sfx", volume: 0.7 },
  { key: "ring-out", path: ogg("ring-out"), category: "sfx", volume: 0.8 },
  { key: "round-win", path: ogg("round-win"), category: "sfx", volume: 0.9 },
  { key: "round-lose", path: ogg("round-lose"), category: "sfx", volume: 0.9 },
  { key: "round-draw", path: ogg("round-draw"), category: "sfx", volume: 0.8 },
  { key: "countdown-tick", path: ogg("countdown-tick"), category: "sfx", volume: 0.6 },
  { key: "menu-click", path: ogg("menu-click"), category: "sfx", volume: 0.6 },
  { key: "menu-start", path: ogg("menu-start"), category: "sfx", volume: 0.8 },
  // Music
  { key: "menu-theme", path: ogg("menu-theme"), category: "music", volume: 0.6 },
  { key: "battle-theme", path: ogg("battle-theme"), category: "music", volume: 0.5 },
];

export function getSoundDefinition(key: SoundKey): SoundDefinition {
  const def = SOUND_MANIFEST.find((entry) => entry.key === key);

  if (!def) {
    throw new Error(`No sound definition for key: ${key}`);
  }

  return def;
}

export function getAllSoundPaths(): readonly SoundDefinition[] {
  return SOUND_MANIFEST;
}

/**
 * Return every manifest entry belonging to the given category.
 *
 * The returned array is a fresh defensive copy — mutating it does not affect
 * the underlying manifest. Use this to drive per-category playback / stop
 * behaviour in the AudioService.
 */
export function getSoundsByCategory(
  category: SoundCategory,
): readonly SoundDefinition[] {
  return SOUND_MANIFEST.filter((entry) => entry.category === category);
}
