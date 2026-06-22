import { describe, expect, it, vi } from "vitest";

// Phaser pulls in `window` at import time. The BattleScene module imports
// Phaser transitively, so stub it out for the node test environment.
vi.mock("phaser", () => {
  class Scene {}
  const Phaser = {
    Scene,
    Geom: { Rectangle: class {} },
    Input: {
      Keyboard: {
        JustDown: () => false,
        KeyCodes: {
          A: "A",
          D: "D",
          S: "S",
          W: "W",
          SPACE: "SPACE",
          ENTER: "ENTER",
        },
      },
    },
    Math: {
      Distance: {
        Between: (ax: number, ay: number, bx: number, by: number) =>
          Math.hypot(ax - bx, ay - by),
      },
      Vector2: class {
        x: number;
        y: number;
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
        clone() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return new (this.constructor as any)(this.x, this.y);
        }
        normalize() {
          const len = Math.hypot(this.x, this.y);
          if (len > 0) {
            this.x /= len;
            this.y /= len;
          }
          return this;
        }
        lengthSq() {
          return this.x * this.x + this.y * this.y;
        }
        copy(other: { x: number; y: number }) {
          this.x = other.x;
          this.y = other.y;
          return this;
        }
        set(x: number, y: number) {
          this.x = x;
          this.y = y;
          return this;
        }
      },
    },
  };
  return { default: Phaser, ...Phaser };
});

import { resetOffender, computeP1Direction, computeP2Direction, applyBotSlap, handleRingOut, type BattleRuntimeLike, type BotSlapRuntimeLike, type RingOutRuntimeLike } from "./BattleScene";
import type { ActorState } from "../entities/Player";
import type { GameSettings } from "../config/gameSettings";
import type { DirectionInput } from "../systems/InputDirection";
import type { RoundState } from "../systems/RoundSystem";
import type { BotAIState } from "../systems/BotAI";

function mockActor(overrides: Partial<ActorState> = {}): ActorState {
  return {
    body: { setVelocity: () => void 0 },
    facing: { x: 1, y: 0, set: () => void 0, copy: () => void 0 },
    knockbackSpeed: 560,
    knockbackMultiplier: 2.5,
    knockbackBoostUntil: 9999,
    knockbackUntil: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    moveSpeed: 260,
    size: 36,
    slapRange: 84,
    spawn: { x: 0, y: 0 },
    speedBoostUntil: 9999,
    speedMultiplier: 2,
    shieldHitsRemaining: 1,
    shieldUntil: 9999,
    sprite: {
      x: 999,
      y: 999,
      setPosition: () => void 0,
    },
    ...overrides,
  } as unknown as ActorState;
}

function mockRuntime(opts: {
  player?: Partial<ActorState>;
  opponent?: Partial<ActorState>;
  opponentKind?: "bot" | "player2";
}): BattleRuntimeLike {
  const player = mockActor({
    speedMultiplier: 2,
    speedBoostUntil: 9999,
    knockbackMultiplier: 2.5,
    knockbackBoostUntil: 9999,
    shieldHitsRemaining: 1,
    shieldUntil: 9999,
    ...opts.player,
  });
  const opponent = mockActor({
    speedMultiplier: 2,
    speedBoostUntil: 9999,
    knockbackMultiplier: 2.5,
    knockbackBoostUntil: 9999,
    shieldHitsRemaining: 1,
    shieldUntil: 9999,
    ...opts.opponent,
  });
  return {
    player,
    opponent: {
      kind: opts.opponentKind ?? "bot",
      bot: opts.opponentKind === "player2" ? undefined : opponent,
      player: opts.opponentKind === "player2" ? opponent : undefined,
    },
  } as unknown as BattleRuntimeLike;
}

describe("resetOffender", () => {
  it("resets only the player when who === 'player'", () => {
    const runtime = mockRuntime({});
    resetOffender(runtime, "player");
    // Player reset.
    expect(runtime.player.speedMultiplier).toBe(1);
    expect(runtime.player.speedBoostUntil).toBe(0);
    expect(runtime.player.knockbackMultiplier).toBe(1);
    expect(runtime.player.knockbackBoostUntil).toBe(0);
    expect(runtime.player.shieldHitsRemaining).toBe(0);
    expect(runtime.player.shieldUntil).toBe(0);
  });

  it("does NOT reset the opponent when who === 'player'", () => {
    const runtime = mockRuntime({});
    resetOffender(runtime, "player");
    const opp =
      runtime.opponent.kind === "bot"
        ? runtime.opponent.bot
        : runtime.opponent.player;
    expect(opp.speedMultiplier).toBe(2);
    expect(opp.speedBoostUntil).toBe(9999);
    expect(opp.knockbackMultiplier).toBe(2.5);
    expect(opp.knockbackBoostUntil).toBe(9999);
    expect(opp.shieldHitsRemaining).toBe(1);
    expect(opp.shieldUntil).toBe(9999);
  });

  it("resets only the opponent when who === 'opponent' (bot)", () => {
    const runtime = mockRuntime({ opponentKind: "bot" });
    resetOffender(runtime, "opponent");
    // Player should be untouched.
    expect(runtime.player.speedMultiplier).toBe(2);
    expect(runtime.player.speedBoostUntil).toBe(9999);
    expect(runtime.player.knockbackMultiplier).toBe(2.5);
    expect(runtime.player.shieldHitsRemaining).toBe(1);
    // Opponent should be reset.
    expect(runtime.opponent.kind).toBe("bot");
    const opp =
      runtime.opponent.kind === "bot"
        ? runtime.opponent.bot
        : runtime.opponent.player;
    expect(opp.speedMultiplier).toBe(1);
    expect(opp.speedBoostUntil).toBe(0);
    expect(opp.knockbackMultiplier).toBe(1);
    expect(opp.knockbackBoostUntil).toBe(0);
    expect(opp.shieldHitsRemaining).toBe(0);
    expect(opp.shieldUntil).toBe(0);
  });

  it("resets only the opponent when who === 'opponent' (player2)", () => {
    const runtime = mockRuntime({ opponentKind: "player2" });
    resetOffender(runtime, "opponent");
    // Player should be untouched.
    expect(runtime.player.speedMultiplier).toBe(2);
    expect(runtime.player.shieldHitsRemaining).toBe(1);
    // P2 should be reset.
    expect(runtime.opponent.kind).toBe("player2");
    const opp =
      runtime.opponent.kind === "bot"
        ? runtime.opponent.bot
        : runtime.opponent.player;
    expect(opp.speedMultiplier).toBe(1);
    expect(opp.shieldHitsRemaining).toBe(0);
    expect(opp.knockbackMultiplier).toBe(1);
  });
});

// --- B2: 2P arrow-key ownership ---
// In 2P-local mode, P1 must use WASD only and P2 must own the arrow keys.
// Previously getDirection fed `cursors` (arrows) into P1's movement, so
// pressing arrows moved BOTH players.

type KeyStub = { isDown: boolean };
type CursorKeysStub = {
  down: KeyStub;
  left: KeyStub;
  right: KeyStub;
  up: KeyStub;
};

function keys(allDown: boolean): CursorKeysStub {
  return {
    down: { isDown: allDown },
    left: { isDown: allDown },
    right: { isDown: allDown },
    up: { isDown: allDown },
  };
}

function keysWith(overrides: Partial<CursorKeysStub>): CursorKeysStub {
  return {
    down: overrides.down ?? { isDown: false },
    left: overrides.left ?? { isDown: false },
    right: overrides.right ?? { isDown: false },
    up: overrides.up ?? { isDown: false },
  };
}

const noTouch: DirectionInput = {
  down: false,
  left: false,
  right: false,
  up: false,
};

const settings1p: GameSettings = {
  mode: "1p-vs-bot",
  botDifficulty: "medium",
  roundLengthSeconds: 60,
  winningScore: 5,
  sfxMuted: false,
  musicMuted: false,
  sfxVolume: 0.7,
  musicVolume: 0.5,
};

const settings2p: GameSettings = { ...settings1p, mode: "2p-local" };

describe("computeP1Direction (B2)", () => {
  it("in 2P mode, arrow keys do NOT affect P1's direction vector", () => {
    // Arrows pressed (down), WASD released, no touch.
    const cursors = keysWith({ down: { isDown: true } });
    const wasd = keys(false);
    const dir = computeP1Direction(settings2p, cursors, wasd, noTouch);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });

  it("in 2P mode, WASD still drives P1", () => {
    const cursors = keysWith({ down: { isDown: true } }); // arrows pressed
    const wasd = keysWith({ up: { isDown: true } }); // W pressed
    const dir = computeP1Direction(settings2p, cursors, wasd, noTouch);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(-1); // up = negative y
  });

  it("in 1P mode, arrow keys DO drive P1 (preserves prior behaviour)", () => {
    const cursors = keysWith({ down: { isDown: true } });
    const wasd = keys(false);
    const dir = computeP1Direction(settings1p, cursors, wasd, noTouch);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(1); // down = positive y
  });

  it("in 1P mode, WASD and arrows combine (no cancellation in 1P)", () => {
    const cursors = keysWith({ left: { isDown: true } });
    const wasd = keysWith({ right: { isDown: true } });
    const dir = computeP1Direction(settings1p, cursors, wasd, noTouch);
    // left + right cancel
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });

  it("touch input still drives P1 in 2P mode", () => {
    const cursors = keysWith({ down: { isDown: true } }); // arrows pressed (should be ignored)
    const wasd = keys(false);
    const touch: DirectionInput = {
      down: false,
      left: true,
      right: false,
      up: false,
    };
    const dir = computeP1Direction(settings2p, cursors, wasd, touch);
    expect(dir.x).toBe(-1);
    expect(dir.y).toBe(0);
  });
});

describe("computeP2Direction (B2)", () => {
  it("reads arrow keys for P2", () => {
    const cursors = keysWith({ right: { isDown: true } });
    const dir = computeP2Direction(cursors);
    expect(dir.x).toBe(1);
    expect(dir.y).toBe(0);
  });

  it("returns zero vector when no arrows pressed", () => {
    const cursors = keys(false);
    const dir = computeP2Direction(cursors);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });
});

// --- B9: bot slap miss is silent ---
// The bot branch of update() called applySlap but only played slap-hit on
// success — there was no else branch to play slap-miss when the slap failed
// (cooldown, shield block, or out-of-range). P1/P2 paths already played
// slap-miss, so the bot was the only actor whose missed slaps were silent.

function makeBotAI(): BotAIState {
  return {
    difficulty: "medium",
    lastDodgeAt: 0,
    lastPlayerAttackSeenAt: 0,
    lastSlapAttemptAt: 0,
    currentDir: { x: 0, y: 0 },
    dodgeUntil: 0,
  };
}

function makeRound(): RoundState {
  return {
    isComplete: false,
    timeLeft: 60,
    score: { player: 0, bots: 0 },
    winner: null,
  };
}

function makeBotSlapRuntime(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player?: any;
  ai?: BotAIState;
}): BotSlapRuntimeLike {
  const bot = mockActor({
    sprite: { x: 100, y: 0, setPosition: () => void 0 },
    slapRange: 200,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    knockbackSpeed: 560,
    knockbackMultiplier: 1,
    knockbackBoostUntil: 0,
    speedBoostUntil: 0,
    speedMultiplier: 1,
    ...opts.bot,
  });
  const player = mockActor({
    sprite: { x: 200, y: 0, setPosition: () => void 0 },
    shieldHitsRemaining: 0,
    shieldUntil: 0,
    knockbackUntil: 0,
    body: { setVelocity: () => void 0 },
    ...opts.player,
  });
  const audio = {
    playSlapHit: vi.fn(),
    playSlapMiss: vi.fn(),
  };
  return {
    player,
    opponent: { kind: "bot", bot, ai: opts.ai ?? makeBotAI() },
    audio,
  } as unknown as BotSlapRuntimeLike;
}

describe("applyBotSlap (B9)", () => {
  it("plays slap-miss when the bot's slap fails (cooldown)", () => {
    // Bot slapped very recently — applySlap returns false at the cooldown
    // check. shouldBotSlap doesn't check lastAttackAt, so it still returns
    // true and the slap is attempted.
    const now = 1000;
    const runtime = makeBotSlapRuntime({
      bot: { lastAttackAt: now - 100 }, // 100ms ago, within 450ms cooldown
    });
    applyBotSlap(runtime, now);
    expect(runtime.audio.playSlapMiss).toHaveBeenCalledTimes(1);
    expect(runtime.audio.playSlapHit).not.toHaveBeenCalled();
  });

  it("plays slap-miss when the bot's slap is blocked by shield", () => {
    const now = 1000;
    const runtime = makeBotSlapRuntime({
      bot: { lastAttackAt: Number.NEGATIVE_INFINITY },
      player: {
        shieldHitsRemaining: 1,
        shieldUntil: now + 9999,
      },
    });
    applyBotSlap(runtime, now);
    expect(runtime.audio.playSlapMiss).toHaveBeenCalledTimes(1);
    expect(runtime.audio.playSlapHit).not.toHaveBeenCalled();
  });

  it("plays slap-hit when the bot's slap succeeds", () => {
    const now = 1000;
    const runtime = makeBotSlapRuntime({
      bot: { lastAttackAt: Number.NEGATIVE_INFINITY },
      player: { shieldHitsRemaining: 0, shieldUntil: 0 },
    });
    applyBotSlap(runtime, now);
    expect(runtime.audio.playSlapHit).toHaveBeenCalledTimes(1);
    expect(runtime.audio.playSlapMiss).not.toHaveBeenCalled();
  });

  it("does nothing when shouldBotSlap returns false (out of range)", () => {
    const now = 1000;
    const runtime = makeBotSlapRuntime({
      bot: { slapRange: 10, lastAttackAt: Number.NEGATIVE_INFINITY },
    });
    applyBotSlap(runtime, now);
    expect(runtime.audio.playSlapHit).not.toHaveBeenCalled();
    expect(runtime.audio.playSlapMiss).not.toHaveBeenCalled();
  });

  // --- C2: frozen actors cannot slap ---
  // The freeze power-up was checked before `moveActor` (movement blocked)
  // but NOT before the three slap paths (P1, P2, bot). A frozen bot would
  // still slap the player. The fix adds an `isFrozen` gate inside
  // `applyBotSlap` (the bot path) — the P1 and P2 paths are gated in
  // BattleScene.update() directly. shouldBotSlap itself doesn't check
  // frozen state, so without the gate the bot would still attempt a slap
  // (and applySlap would succeed) while frozen.
  it("C2: does nothing when the bot is frozen (no slap attempt, no audio)", () => {
    const now = 1000;
    const runtime = makeBotSlapRuntime({
      bot: {
        lastAttackAt: Number.NEGATIVE_INFINITY,
        // Bot is frozen for the next 5s — should be unable to slap.
        frozenUntil: now + 5000,
      },
    });
    applyBotSlap(runtime, now);
    expect(runtime.audio.playSlapHit).not.toHaveBeenCalled();
    expect(runtime.audio.playSlapMiss).not.toHaveBeenCalled();
  });
});

// --- fix-scoring: points awarded on ring-out, not slap ---
// Previously applySlap called registerPoint on every successful slap, which
// meant a round could be won by slapping alone. Scoring has now moved to the
// ring-out handler: when an actor is knocked out of the arena, the OPPOSITE
// side is awarded the point. Slaps apply knockback only.

function makeRingOutRuntime(opts: {
  opponentKind?: "bot" | "player2";
}): RingOutRuntimeLike {
  const player = mockActor();
  const opponent = mockActor();
  const audio = {
    playRingOut: vi.fn(),
  };
  return {
    player,
    opponent: {
      kind: opts.opponentKind ?? "bot",
      bot: opts.opponentKind === "player2" ? undefined : opponent,
      player: opts.opponentKind === "player2" ? opponent : undefined,
    },
    round: makeRound(),
    audio,
  } as unknown as RingOutRuntimeLike;
}

describe("handleRingOut (fix-scoring)", () => {
  it("awards the point to the BOTS side when the PLAYER rings out", () => {
    const runtime = makeRingOutRuntime({});
    handleRingOut(runtime, "player", 5);
    expect(runtime.round.score.bots).toBe(1);
    expect(runtime.round.score.player).toBe(0);
    expect(runtime.audio.playRingOut).toHaveBeenCalledTimes(1);
  });

  it("awards the point to the PLAYER side when the OPPONENT rings out (bot)", () => {
    const runtime = makeRingOutRuntime({ opponentKind: "bot" });
    handleRingOut(runtime, "opponent", 5);
    expect(runtime.round.score.player).toBe(1);
    expect(runtime.round.score.bots).toBe(0);
    expect(runtime.audio.playRingOut).toHaveBeenCalledTimes(1);
  });

  it("awards the point to the PLAYER side when the OPPONENT rings out (player2)", () => {
    const runtime = makeRingOutRuntime({ opponentKind: "player2" });
    handleRingOut(runtime, "opponent", 5);
    expect(runtime.round.score.player).toBe(1);
    expect(runtime.round.score.bots).toBe(0);
    expect(runtime.audio.playRingOut).toHaveBeenCalledTimes(1);
  });

  it("resets only the offender that rang out (player)", () => {
    const runtime = makeRingOutRuntime({});
    handleRingOut(runtime, "player", 5);
    expect(runtime.player.speedMultiplier).toBe(1);
    expect(runtime.player.shieldHitsRemaining).toBe(0);
    // Opponent untouched.
    const opp =
      runtime.opponent.kind === "bot"
        ? runtime.opponent.bot
        : runtime.opponent.player;
    expect(opp.speedMultiplier).toBe(2);
    expect(opp.shieldHitsRemaining).toBe(1);
  });

  it("resets only the offender that rang out (opponent)", () => {
    const runtime = makeRingOutRuntime({});
    handleRingOut(runtime, "opponent", 5);
    expect(runtime.player.speedMultiplier).toBe(2);
    expect(runtime.player.shieldHitsRemaining).toBe(1);
    // Opponent reset.
    const opp =
      runtime.opponent.kind === "bot"
        ? runtime.opponent.bot
        : runtime.opponent.player;
    expect(opp.speedMultiplier).toBe(1);
    expect(opp.shieldHitsRemaining).toBe(0);
  });

  it("completes the round when winningScore is reached via ring-out", () => {
    const runtime = makeRingOutRuntime({});
    handleRingOut(runtime, "player", 1); // bots reaches winningScore=1
    expect(runtime.round.isComplete).toBe(true);
    expect(runtime.round.winner).toBe("bots");
  });

  it("does not complete the round before winningScore is reached", () => {
    const runtime = makeRingOutRuntime({});
    handleRingOut(runtime, "player", 5); // bots=1, winningScore=5
    expect(runtime.round.isComplete).toBe(false);
    expect(runtime.round.winner).toBeNull();
  });
});
