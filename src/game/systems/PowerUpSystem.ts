import type { ActorState } from "../entities/Player";

export type PowerUpEffect = "speed" | "knockback" | "shield";

export type PowerUpDefinition = {
  color: number;
  description: string;
  effect: PowerUpEffect;
  label: string;
  knockbackMultiplier?: number;
  speedMultiplier?: number;
  shieldDurationMs?: number;
};

type PowerUpSprite = {
  destroy: () => void;
  x: number;
  y: number;
};

type SceneLike = {
  add: {
    circle: (x: number, y: number, size: number, color: number) => PowerUpSprite;
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
    description: "Move faster for the next clash.",
    effect: "speed",
    label: "Boost",
    speedMultiplier: 1.35,
  },
  {
    color: 0xf2cc8f,
    description: "Deliver a heavier slap.",
    effect: "knockback",
    label: "Heavy Hand",
    knockbackMultiplier: 1.25,
  },
  {
    color: 0x3d405b,
    description: "Absorb the next hit for a moment.",
    effect: "shield",
    label: "Shield",
    shieldDurationMs: 3000,
  },
] satisfies readonly PowerUpDefinition[];

type ActivePowerUp = {
  definition: PowerUpDefinition;
  sprite: PowerUpSprite;
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

  state.spawnIndex += 1;
  state.active = {
    definition,
    sprite: scene.add.circle(point.x, point.y, size, definition.color),
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
  } else if (definition.effect === "knockback") {
    actor.knockbackMultiplier =
      definition.knockbackMultiplier ?? actor.knockbackMultiplier;
  } else {
    actor.shieldedUntil = now + (definition.shieldDurationMs ?? 0);
  }

  state.active.sprite.destroy();
  state.active = null;
  return true;
}
