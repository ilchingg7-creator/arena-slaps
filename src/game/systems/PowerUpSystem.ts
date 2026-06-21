import type { ActorState } from "../entities/Player";

export type PowerUpEffect = "speed" | "knockback" | "shield";

export type PowerUpDefinition = {
  color: number;
  description: string;
  effect: PowerUpEffect;
  label: string;
  knockbackMultiplier?: number;
  speedMultiplier?: number;
};

/**
 * Effect durations in milliseconds. All three power-ups are temporary so the
 * player must make use of them quickly:
 *   - Boost and Heavy Hand last 8 seconds.
 *   - Shield expires after 5 seconds even if no slap is absorbed (so the
 *     shield can't be banked indefinitely) and is also consumed after a
 *     single blocked slap.
 */
export const powerUpDurations = {
  speedMs: 8000,
  knockbackMs: 8000,
  shieldMs: 5000,
} as const;

type PowerUpSprite = {
  destroy: () => void;
  x: number;
  y: number;
};

type PowerUpLabel = {
  destroy: () => void;
};

type SceneLike = {
  add: {
    circle: (x: number, y: number, size: number, color: number) => PowerUpSprite;
    text: (
      x: number,
      y: number,
      value: string,
      style?: { color?: string; fontFamily?: string; fontSize?: string },
    ) => {
      setOrigin: (x?: number, y?: number) => PowerUpLabel;
      destroy: () => void;
    };
  };
};

type ArenaLike = {
  bottom: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
};

export const powerUpDefinitions = [
  {
    color: 0x81b29a,
    description: "Move 35% faster for 8 seconds.",
    effect: "speed",
    label: "Boost",
    speedMultiplier: 1.35,
  },
  {
    color: 0xf2cc8f,
    description: "Heavier slap knockback for 8 seconds.",
    effect: "knockback",
    label: "Heavy Hand",
    knockbackMultiplier: 1.25,
  },
  {
    color: 0x3d405b,
    description: "Block the next slap within 5 seconds.",
    effect: "shield",
    label: "Shield",
  },
] satisfies readonly PowerUpDefinition[];

type ActivePowerUp = {
  definition: PowerUpDefinition;
  sprite: PowerUpSprite;
  label: PowerUpLabel;
};

export type PowerUpState = {
  active: ActivePowerUp | null;
  spawnIndex: number;
};

export function createPowerUpState(): PowerUpState {
  return {
    active: null,
    spawnIndex: 0,
  };
}

export function getNextPowerUpDefinition(index: number): PowerUpDefinition {
  return powerUpDefinitions[index % powerUpDefinitions.length];
}

export function spawnPowerUp(
  scene: SceneLike,
  state: PowerUpState,
  arena: ArenaLike,
  size: number,
): void {
  if (state.active) {
    return;
  }

  const slots = [
    { x: arena.centerX, y: arena.centerY },
    { x: arena.left + 100, y: arena.top + 100 },
    { x: arena.right - 100, y: arena.bottom - 100 },
  ];
  const point = slots[state.spawnIndex % slots.length];
  const definition = getNextPowerUpDefinition(state.spawnIndex);

  const label = scene.add.text(
    point.x,
    point.y - size - 14,
    definition.label,
    {
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "14px",
    },
  ).setOrigin(0.5, 0.5);

  state.spawnIndex += 1;
  state.active = {
    definition,
    sprite: scene.add.circle(point.x, point.y, size, definition.color),
    label,
  };
}

export function tryCollectPowerUp(
  actor: ActorState,
  state: PowerUpState,
  now: number,
): boolean {
  if (!state.active) {
    return false;
  }

  const dx = actor.sprite.x - state.active.sprite.x;
  const dy = actor.sprite.y - state.active.sprite.y;
  const distance = Math.hypot(dx, dy);

  if (distance > actor.size) {
    return false;
  }

  const definition = state.active.definition;

  if (definition.effect === "speed") {
    actor.speedMultiplier = definition.speedMultiplier ?? actor.speedMultiplier;
    actor.speedBoostUntil = now + powerUpDurations.speedMs;
  } else if (definition.effect === "knockback") {
    actor.knockbackMultiplier =
      definition.knockbackMultiplier ?? actor.knockbackMultiplier;
    actor.knockbackBoostUntil = now + powerUpDurations.knockbackMs;
  } else {
    actor.shieldHitsRemaining = 1;
    actor.shieldUntil = now + powerUpDurations.shieldMs;
  }

  state.active.sprite.destroy();
  state.active.label.destroy();
  state.active = null;
  return true;
}

/**
 * Whether the shield power-up is currently active. The shield is active iff
 * there is at least one hit remaining AND the shield's wall-clock expiry has
 * not yet passed.
 */
export function isShieldActive(actor: ActorState, now: number): boolean {
  return actor.shieldHitsRemaining > 0 && now < actor.shieldUntil;
}

/**
 * Consume one shield hit. Called by `applySlap` after a successful block.
 * Decrements `shieldHitsRemaining` (clamped at zero) so a 1-hit shield is
 * consumed after blocking a single slap.
 */
export function consumeShieldHit(actor: ActorState): void {
  if (actor.shieldHitsRemaining > 0) {
    actor.shieldHitsRemaining -= 1;
  }
}

/**
 * Reset any expired power-up boosts on the actor. Called every frame from
 * `moveActor` (and from `applySlap` for the attacker) so that an expired
 * Boost / Heavy Hand reverts the actor's multiplier to its baseline of 1
 * as soon as the duration elapses.
 *
 * We do NOT touch the shield here — shield expiry is handled by
 * `isShieldActive`, which already checks the wall-clock expiry.
 */
export function expirePowerUpBoosts(actor: ActorState, now: number): void {
  if (actor.speedBoostUntil > 0 && now > actor.speedBoostUntil) {
    actor.speedMultiplier = 1;
    actor.speedBoostUntil = 0;
  }
  if (actor.knockbackBoostUntil > 0 && now > actor.knockbackBoostUntil) {
    actor.knockbackMultiplier = 1;
    actor.knockbackBoostUntil = 0;
  }
}
