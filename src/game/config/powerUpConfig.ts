import { POWERUP_TIMINGS } from "./powerUpTimings";

export type PowerUpEffect =
  | "speed"
  | "knockback"
  | "shield"
  | "mega-knockback" // NEW
  | "freeze" // NEW
  | "double-slap"; // NEW

export type PowerUpDefinition = {
  key: PowerUpEffect;
  label: string;
  labelKey: string; // translation key, e.g. "powerup.speed"
  description: string;
  color: number;
  /** Duration in ms (looked up from POWERUP_TIMINGS by effect). */
  durationKey: keyof typeof POWERUP_TIMINGS; // e.g. "speedBoostMs"
  /** Optional multiplier for speed effect. */
  speedMultiplier?: number;
  /** Optional multiplier for knockback effect. */
  knockbackMultiplier?: number;
};

export const POWERUP_DEFINITIONS: readonly PowerUpDefinition[] = [
  {
    key: "speed",
    label: "Boost",
    labelKey: "powerup.speed",
    description: "Move 35% faster for 8 seconds.",
    color: 0x81b29a,
    durationKey: "speedBoostMs",
    speedMultiplier: 1.35,
  },
  {
    key: "knockback",
    label: "Heavy Hand",
    labelKey: "powerup.knockback",
    description: "Heavier slap knockback for 8 seconds.",
    color: 0xf2cc8f,
    durationKey: "knockbackBoostMs",
    knockbackMultiplier: 1.25,
  },
  {
    key: "shield",
    label: "Shield",
    labelKey: "powerup.shield",
    description: "Block the next slap within 5 seconds.",
    color: 0x3d405b,
    durationKey: "shieldMs",
  },
  {
    key: "mega-knockback",
    label: "Mega Hand",
    labelKey: "powerup.mega-knockback",
    description: "Massive slap knockback for 4 seconds.",
    color: 0xe07a5f,
    durationKey: "megaKnockbackBoostMs",
    knockbackMultiplier: 1.75,
  },
  {
    key: "freeze",
    label: "Freeze",
    labelKey: "powerup.freeze",
    description: "Freeze the opponent for 1.5 seconds.",
    color: 0x00f5ff,
    durationKey: "freezeMs",
  },
  {
    key: "double-slap",
    label: "Double Slap",
    labelKey: "powerup.double-slap",
    description: "Next slap hits twice within 5 seconds.",
    color: 0x9b5de5,
    durationKey: "doubleSlapMs",
  },
];

/**
 * Look up a power-up definition by its effect key. Throws if the key is
 * not in {@link POWERUP_DEFINITIONS} — this should never happen for an
 * internally-generated key, but guards against typos / stale state.
 */
export function getPowerUpDefinition(key: PowerUpEffect): PowerUpDefinition {
  const def = POWERUP_DEFINITIONS.find((d) => d.key === key);
  if (!def) {
    throw new Error(`Unknown power-up effect: ${key}`);
  }
  return def;
}

/**
 * Look up a power-up definition by its rotation index. Wraps around using
 * modulo so the spawn rotation cycles through all 6 definitions forever.
 */
export function getPowerUpDefinitionByIndex(index: number): PowerUpDefinition {
  return POWERUP_DEFINITIONS[
    ((index % POWERUP_DEFINITIONS.length) + POWERUP_DEFINITIONS.length) %
      POWERUP_DEFINITIONS.length
  ];
}

/** Total number of distinct power-up definitions (currently 6). */
export function getPowerUpCount(): number {
  return POWERUP_DEFINITIONS.length;
}
