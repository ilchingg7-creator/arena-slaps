/**
 * Central manifest of all game sound effects.
 *
 * TO REPLACE A SOUND:
 *   1. Drop a `.ogg` file into /public/sounds/ with the same filename,
 *      OR change the `path` field below to point at your new file.
 *   2. The build pipeline (PreloadScene -> loadSounds) reads this manifest
 *      verbatim, so no other code changes are required.
 *
 * TO ADD A NEW SOUND:
 *   1. Add a new entry to {@link SoundKey} (the union type below).
 *   2. Add a matching entry to {@link SOUND_MANIFEST}.
 *   3. Optionally expose a high-level method on {@link AudioService}.
 *
 * All paths are relative to /public/ (Vite convention) and MUST end in .ogg.
 */

export const SOUND_KEYS = [
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
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

export type SoundDefinition = {
  key: SoundKey;
  path: string;
  /**
   * Optional per-sound volume multiplier (0..1), applied on top of the
   * global master volume. Useful for taming loud SFX without touching mix.
   */
  volume?: number;
};

function ogg(name: string): string {
  return `/sounds/${name}.ogg`;
}

export const SOUND_MANIFEST: readonly SoundDefinition[] = [
  { key: "slap-hit", path: ogg("slap-hit"), volume: 0.9 },
  { key: "slap-miss", path: ogg("slap-miss"), volume: 0.5 },
  { key: "powerup-collect", path: ogg("powerup-collect"), volume: 0.7 },
  { key: "ring-out", path: ogg("ring-out"), volume: 0.8 },
  { key: "round-win", path: ogg("round-win"), volume: 0.9 },
  { key: "round-lose", path: ogg("round-lose"), volume: 0.9 },
  { key: "round-draw", path: ogg("round-draw"), volume: 0.8 },
  { key: "countdown-tick", path: ogg("countdown-tick"), volume: 0.6 },
  { key: "menu-click", path: ogg("menu-click"), volume: 0.6 },
  { key: "menu-start", path: ogg("menu-start"), volume: 0.8 },
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
