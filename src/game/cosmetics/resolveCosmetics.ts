/**
 * resolveCosmetics — pure helper that converts a player's equipped
 * cosmetics (cosmetic ids in `profile.cosmetics.equipped`) into the
 * concrete values the BattleScene needs to apply them (color hex,
 * outline hex, trail texture, headwear sprite key, etc.).
 *
 * Extracted into its own module so the resolution logic can be unit-
 * tested without instantiating Phaser / BattleScene.
 *
 * Resolution rules:
 *   - For each category, look up the equipped cosmetic id in the
 *     manifest. If the id is undefined or not in the manifest, fall
 *     back to the engine default (the value the actor would have
 *     without any cosmetics).
 *   - The 2P-local free-cosmetics rule is enforced UPSTREAM by
 *     `isCosmeticAvailable` (in CosmeticsManifest) — by the time we
 *     resolve here, the equipped ids are assumed valid. This helper
 *     doesn't re-check availability.
 *   - Returns a flat object with concrete values so BattleScene can
 *     pass them directly to `createActor` / particle emitters / etc.
 */

import type { Profile, EquippedCosmetics } from "../config/profile";
import { getCosmeticById } from "../config/CosmeticsManifest";

export type ResolvedCosmetics = {
  /** Color hex value (e.g. 0x3d405b) for the actor's sprite. */
  color: number;
  /** Outline color hex (e.g. 0xffffff). null = no outline. */
  outline: number | null;
  /** Trail texture key + color. null = no trail. */
  trail: { textureKey: string; color: number } | null;
  /** Slap FX texture key. null = no FX. */
  slapFx: string | null;
  /** Title key (e.g. "rookie"). null = no title. */
  title: string | null;
  /** Power-up skin key (e.g. "default"). */
  powerUpSkin: string;
  /** Headwear sprite key + Y offset. null = no headwear. */
  headwear: { spriteKey: string; offsetY: number } | null;
};

export type ResolveCosmeticsInput = {
  /** The equipped cosmetics record (P1 or P2). */
  equipped: EquippedCosmetics;
  /** Default color used when no color cosmetic is equipped. */
  defaultColor: number;
  /** Default power-up skin used when no skin cosmetic is equipped. */
  defaultPowerUpSkin?: string;
};

/**
 * Resolve equipped cosmetics into concrete values.
 *
 * The caller passes the `defaultColor` (the actor's base config color)
 * so the resolved color falls back gracefully when no color cosmetic
 * is equipped.
 */
export function resolveCosmetics(
  input: ResolveCosmeticsInput,
): ResolvedCosmetics {
  const { equipped, defaultColor } = input;

  // --- Color ---
  let color = defaultColor;
  if (equipped.color) {
    const def = getCosmeticById(equipped.color);
    if (def && def.category === "color") {
      color = (def.effect as { value: number }).value;
    }
  }

  // --- Outline ---
  let outline: number | null = null;
  if (equipped.outline && equipped.outline !== "outline-none") {
    const def = getCosmeticById(equipped.outline);
    if (def && def.category === "outline") {
      outline = (def.effect as { value: number }).value;
    }
  }

  // --- Trail ---
  let trail: { textureKey: string; color: number } | null = null;
  if (equipped.trail && equipped.trail !== "trail-none") {
    const def = getCosmeticById(equipped.trail);
    if (def && def.category === "trail") {
      const eff = def.effect as { textureKey: string; color: number };
      if (eff.textureKey) {
        trail = { textureKey: eff.textureKey, color: eff.color };
      }
    }
  }

  // --- Slap FX ---
  let slapFx: string | null = null;
  if (equipped.slapFx && equipped.slapFx !== "slapfx-none") {
    const def = getCosmeticById(equipped.slapFx);
    if (def && def.category === "slapFx") {
      const eff = def.effect as { textureKey: string };
      if (eff.textureKey) {
        slapFx = eff.textureKey;
      }
    }
  }

  // --- Title ---
  let title: string | null = null;
  if (equipped.title && equipped.title !== "title-none") {
    const def = getCosmeticById(equipped.title);
    if (def && def.category === "title") {
      const key = (def.effect as { key: string }).key;
      if (key) title = key;
    }
  }

  // --- Power-up skin ---
  let powerUpSkin = input.defaultPowerUpSkin ?? "default";
  if (equipped.powerUpSkin) {
    const def = getCosmeticById(equipped.powerUpSkin);
    if (def && def.category === "powerUpSkin") {
      powerUpSkin = (def.effect as { skinKey: string }).skinKey;
    }
  }

  // --- Headwear ---
  let headwear: { spriteKey: string; offsetY: number } | null = null;
  if (equipped.headwear && equipped.headwear !== "headwear-none") {
    const def = getCosmeticById(equipped.headwear);
    if (def && def.category === "headwear") {
      const eff = def.effect as { spriteKey: string; offsetY: number };
      if (eff.spriteKey) {
        headwear = { spriteKey: eff.spriteKey, offsetY: eff.offsetY };
      }
    }
  }

  return {
    color,
    outline,
    trail,
    slapFx,
    title,
    powerUpSkin,
    headwear,
  };
}

/**
 * Convenience wrapper: resolve P1's cosmetics from the profile.
 * Uses `defaultColor` from the actor config (caller passes it).
 */
export function resolveP1Cosmetics(
  profile: Profile,
  defaultColor: number,
): ResolvedCosmetics {
  return resolveCosmetics({
    equipped: profile.cosmetics.equipped,
    defaultColor,
  });
}

/**
 * Convenience wrapper: resolve P2's cosmetics from the profile.
 * P2 uses `cosmetics.p2Equipped` (the transient 2P-local slot).
 */
export function resolveP2Cosmetics(
  profile: Profile,
  defaultColor: number,
): ResolvedCosmetics {
  return resolveCosmetics({
    equipped: profile.cosmetics.p2Equipped,
    defaultColor,
  });
}
