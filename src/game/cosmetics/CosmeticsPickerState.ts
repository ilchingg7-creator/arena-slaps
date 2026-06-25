/**
 * CosmeticsPickerState — pure state machine for the cosmetics picker UI.
 *
 * The picker shows cells for each cosmetic in a category. The player
 * can click a cell to equip it (if available) or see why it's locked.
 * In 2P-local mode, both players pick cosmetics — P1 edits
 * `profile.cosmetics.equipped`, P2 edits `profile.cosmetics.p2Equipped`.
 *
 * This module is pure: it produces a new state object on each action
 * without mutating the input. The actual Phaser rendering happens in
 * the CosmeticsPicker UI component (separate file).
 */

import type { Profile, EquippedCosmetics } from "../config/profile";
import {
  COSMETICS,
  getCosmeticsByCategory,
  isCosmeticAvailable,
  type CosmeticCategory,
  type CosmeticDefinition,
} from "../config/CosmeticsManifest";

export type CosmeticCellState = {
  def: CosmeticDefinition;
  /** Whether this cosmetic is available for the player to equip. */
  available: boolean;
  /** Whether this cosmetic is currently equipped in the target slot. */
  equipped: boolean;
  /** Why it's locked (only set when available=false). */
  lockReason?: { kind: "level"; requiredLevel: number } | { kind: "paid" };
};

export type PickerRenderModel = {
  category: CosmeticCategory;
  cells: CosmeticCellState[];
};

/**
 * Build the render model for a picker showing the cosmetics in the
 * given category, for the given player (P1 or P2).
 *
 * `is2P` controls the 2P-local free-cosmetics rule: when true, every
 * cosmetic is available regardless of level or ownership.
 */
export function buildPickerModel(
  profile: Profile,
  category: CosmeticCategory,
  is2P: boolean,
  target: "p1" | "p2",
): PickerRenderModel {
  const equippedSlot = target === "p1" ? profile.cosmetics.equipped : profile.cosmetics.p2Equipped;
  const allInCategory = getCosmeticsByCategory(category);
  const cells: CosmeticCellState[] = allInCategory.map((def) => {
    const available = isCosmeticAvailable(profile, def.id, is2P);
    const equipped = equippedSlot[category] === def.id;
    let lockReason: CosmeticCellState["lockReason"];
    if (!available) {
      if (def.source.kind === "free" && def.source.unlockLevel !== undefined) {
        lockReason = { kind: "level", requiredLevel: def.source.unlockLevel };
      } else if (def.source.kind === "paid") {
        lockReason = { kind: "paid" };
      }
    }
    return { def, available, equipped, lockReason };
  });
  return { category, cells };
}

/**
 * Equip a cosmetic on the target player's slot. Returns a NEW
 * EquippedCosmetics object (does not mutate the input). If the cosmetic
 * is unavailable for the player, returns the input unchanged.
 *
 * Equipping a cosmetic that's already equipped UNEQUIPS it (toggle
 * behavior) — except for the "none" variants (color, outline-none,
 * etc.) which can't be toggled off via this function (they're the
 * explicit "no cosmetic" state).
 */
export function equipCosmetic(
  equipped: EquippedCosmetics,
  cosmeticId: string,
  profile: Profile,
  is2P: boolean,
): EquippedCosmetics {
  const def = COSMETICS.find((c) => c.id === cosmeticId);
  if (!def) return equipped;
  if (!isCosmeticAvailable(profile, cosmeticId, is2P)) return equipped;

  // Toggle: if already equipped, unequip (set to undefined). The "none"
  // variants are NOT toggled — clicking them when already equipped is a
  // no-op (they're the explicit "off" state).
  const isNoneVariant = cosmeticId.endsWith("-none");
  if (equipped[def.category] === cosmeticId && !isNoneVariant) {
    const next = { ...equipped };
    delete next[def.category];
    return next;
  }

  return { ...equipped, [def.category]: cosmeticId };
}
