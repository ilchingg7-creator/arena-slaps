import Phaser from "phaser";
import { battleConfig } from "../config/battleConfig";
import {
  DEFAULT_SETTINGS,
  type GameSettings,
} from "../config/gameSettings";
import { createBot, type Bot } from "../entities/Bot";
import {
  createPlayer,
  isKnockedBack,
  moveActor,
  resetActor,
  type ActorState,
  type Player,
} from "../entities/Player";
import { applySlap, isRingOut } from "../systems/CombatSystem";
import {
  createBattleResults,
  saveBattleResults,
} from "../systems/BattleResults";
import { combineMovementInput, type DirectionInput, type DirectionVector } from "../systems/InputDirection";
import {
  advanceRoundState,
  createRoundState,
  type RoundState,
} from "../systems/RoundSystem";
import {
  createPowerUpState,
  spawnPowerUp,
  tryCollectPowerUp,
  type PowerUpState,
} from "../systems/PowerUpSystem";
import { createAudioService } from "../audio/createAudioService";
import type { AudioService } from "../audio/AudioService";
import {
  computeBotDirection,
  createBotAI,
  shouldBotSlap,
  type BotAIState,
} from "../systems/BotAI";

type Opponent =
  | { kind: "bot"; bot: Bot; ai: BotAIState }
  | { kind: "player2"; player: Player };

/**
 * Minimal structural view of {@link BattleRuntime} that exposes only the
 * fields `resetOffender` needs. Exported so the unit test can construct a
 * stub without instantiating Phaser / the full BattleScene.
 */
export type BattleRuntimeLike = {
  player: ActorState;
  opponent:
    | { kind: "bot"; bot: ActorState }
    | { kind: "player2"; player: ActorState };
};

type BattleRuntime = {
  arena: Phaser.Geom.Rectangle;
  audio: AudioService;
  botAI: BotAIState | null;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  opponent: Opponent;
  player: Player;
  powerUp: PowerUpState;
  powerUpsCollected: {
    bots: number;
    player: number;
  };
  resultsShown: boolean;
  round: RoundState;
  settings: GameSettings;
  slapKeyP1: Phaser.Input.Keyboard.Key;
  slapKeyP2: Phaser.Input.Keyboard.Key;
  touchMovement: DirectionInput;
  wasd: {
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
  };
  scoreText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  winnerText: Phaser.GameObjects.Text;
  lastTickInt: number;
};

/**
 * Minimal structural view of a Phaser CursorKey / Key. Used by
 * {@link computeP1Direction} and {@link computeP2Direction} so they can be
 * unit-tested with plain `{ isDown: boolean }` stubs.
 */
export type DirectionKeyLike = {
  isDown: boolean;
};

/**
 * Minimal structural view of Phaser's CursorKeys (the four arrow keys).
 * Also reused for the WASD key set since they have the same shape.
 */
export type CursorKeysLike = {
  down: DirectionKeyLike;
  left: DirectionKeyLike;
  right: DirectionKeyLike;
  up: DirectionKeyLike;
};

/**
 * Combine P1's input sources into a single direction vector.
 *
 * In 1P-vs-bot mode, P1 may use EITHER arrow keys OR WASD (plus touch), so
 * all three sources are combined. In 2P-local mode, P1 is restricted to
 * WASD + touch so that P2 gets exclusive ownership of the arrow keys —
 * otherwise pressing arrows would move BOTH players (B2).
 *
 * Extracted from {@link getDirection} so the input-combination logic can be
 * unit-tested without instantiating Phaser.
 */
export function computeP1Direction(
  settings: Pick<GameSettings, "mode">,
  cursors: CursorKeysLike,
  wasd: CursorKeysLike,
  touchMovement: DirectionInput,
): DirectionVector {
  const inputs: DirectionInput[] = [];
  if (settings.mode !== "2p-local") {
    inputs.push({
      down: cursors.down.isDown,
      left: cursors.left.isDown,
      right: cursors.right.isDown,
      up: cursors.up.isDown,
    });
  }
  inputs.push({
    down: wasd.down.isDown,
    left: wasd.left.isDown,
    right: wasd.right.isDown,
    up: wasd.up.isDown,
  });
  inputs.push(touchMovement);
  return combineMovementInput(...inputs);
}

/**
 * P2's direction vector from the arrow keys. In 2P-local mode P2 owns the
 * arrow keys exclusively (B2).
 */
export function computeP2Direction(cursors: CursorKeysLike): DirectionVector {
  return combineMovementInput({
    down: cursors.down.isDown,
    left: cursors.left.isDown,
    right: cursors.right.isDown,
    up: cursors.up.isDown,
  });
}

function getDirection(runtime: BattleRuntime): Phaser.Math.Vector2 {
  const movement = computeP1Direction(
    runtime.settings,
    runtime.cursors,
    runtime.wasd,
    runtime.touchMovement,
  );
  return new Phaser.Math.Vector2(movement.x, movement.y);
}

function getP2Direction(runtime: BattleRuntime): Phaser.Math.Vector2 {
  const movement = computeP2Direction(runtime.cursors);
  return new Phaser.Math.Vector2(movement.x, movement.y);
}

function updateHud(runtime: BattleRuntime): void {
  runtime.timerText.setText(`Time: ${Math.ceil(runtime.round.timeLeft)}`);
  const opponentLabel =
    runtime.settings.mode === "2p-local" ? "P2" : "Bot";
  const playerLabel =
    runtime.settings.mode === "2p-local" ? "P1" : "Player";
  runtime.scoreText.setText(
    `${playerLabel} ${runtime.round.score.player} - ${runtime.round.score.bots} ${opponentLabel}`,
  );
}

/**
 * Reset only the actor that rang out, leaving the other actor's power-up
 * effects intact. Previously this code reset BOTH actors on any ring-out,
 * which meant a bot ring-out would strip the human player of any active
 * Boost / Heavy Hand / Shield — see bug B3.
 */
export function resetOffender(
  runtime: BattleRuntimeLike,
  who: "player" | "opponent",
): void {
  if (who === "player") {
    resetActor(runtime.player);
    return;
  }
  if (runtime.opponent.kind === "bot") {
    resetActor(runtime.opponent.bot);
  } else {
    resetActor(runtime.opponent.player);
  }
}

/**
 * Minimal structural view of {@link BattleRuntime} that exposes only the
 * fields {@link applyBotSlap} needs. Exported so the unit test can construct
 * a stub without instantiating Phaser / the full BattleScene.
 */
export type BotSlapRuntimeLike = {
  player: ActorState;
  opponent:
    | { kind: "bot"; bot: ActorState; ai: BotAIState }
    | { kind: "player2"; player: ActorState };
  round: RoundState;
  settings: Pick<GameSettings, "winningScore">;
  audio: {
    playSlapHit: () => void;
    playSlapMiss: () => void;
  };
};

/**
 * Attempt a bot slap and play the appropriate sound.
 *
 * Previously the bot branch of `update()` only played `slap-hit` on success
 * and was silent on failure (cooldown / shield block / out-of-range). P1
 * and P2 slap paths already played `slap-miss` on failure, so the bot was
 * the only actor whose missed slaps were silent (B9).
 *
 * Extracted from `update()` so the audio-feedback contract can be
 * unit-tested without driving the full Phaser scene.
 */
export function applyBotSlap(
  runtime: BotSlapRuntimeLike,
  now: number,
): void {
  if (runtime.opponent.kind !== "bot") {
    return;
  }
  if (
    !shouldBotSlap(
      runtime.opponent.bot,
      runtime.player,
      runtime.opponent.ai,
      now,
    )
  ) {
    return;
  }
  const hit = applySlap(
    runtime.opponent.bot,
    runtime.player,
    runtime.round,
    "bots",
    runtime.settings.winningScore,
    now,
  );
  if (hit) {
    runtime.audio.playSlapHit();
  } else {
    runtime.audio.playSlapMiss();
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function createDisabledKey(): Phaser.Input.Keyboard.Key {
  return {
    isDown: false,
  } as Phaser.Input.Keyboard.Key;
}

export class BattleScene extends Phaser.Scene {
  private runtime: BattleRuntime | null = null;

  constructor() {
    super("BattleScene");
  }

  init(data: Partial<GameSettings> | undefined): void {
    const settings: GameSettings = {
      ...DEFAULT_SETTINGS,
      ...(data ?? {}),
    };
    this.registry.set("settings", settings);
  }

  create(): void {
    const settings: GameSettings =
      this.registry.get("settings") ?? DEFAULT_SETTINGS;

    const width = this.scale.width || 1280;
    const height = this.scale.height || 720;
    const arena = new Phaser.Geom.Rectangle(
      (width - battleConfig.arena.width) / 2,
      (height - battleConfig.arena.height) / 2,
      battleConfig.arena.width,
      battleConfig.arena.height,
    );

    this.cameras.main.setBackgroundColor("#101820");

    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xf4f1de, 1);
    graphics.strokeRectShape(arena);

    const player = createPlayer(
      this,
      arena.left + 160,
      arena.centerY,
      battleConfig.player,
    );

    const opponent: Opponent =
      settings.mode === "2p-local"
        ? {
            kind: "player2",
            player: createPlayer(
              this,
              arena.right - 160,
              arena.centerY,
              {
                ...battleConfig.player,
                color: battleConfig.bot.color,
              },
            ),
          }
        : {
            kind: "bot",
            bot: createBot(
              this,
              arena.right - 160,
              arena.centerY,
              battleConfig.bot,
            ),
            ai: createBotAI(settings.botDifficulty),
          };

    const opponentSprite =
      opponent.kind === "bot" ? opponent.bot.sprite : opponent.player.sprite;
    this.physics.add.collider(player.sprite, opponentSprite);

    const keyboard = this.input.keyboard;
    const cursors: Phaser.Types.Input.Keyboard.CursorKeys =
      keyboard?.createCursorKeys() ?? {
        down: createDisabledKey(),
        left: createDisabledKey(),
        right: createDisabledKey(),
        up: createDisabledKey(),
        space: createDisabledKey(),
        shift: createDisabledKey(),
      };
    const touchMovement: DirectionInput = {
      down: false,
      left: false,
      right: false,
      up: false,
    };

    const slapKeyP1 =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) ??
      createDisabledKey();
    const slapKeyP2 =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER) ??
      createDisabledKey();

    this.runtime = {
      arena,
      audio: createAudioService(this, settings),
      botAI: opponent.kind === "bot" ? opponent.ai : null,
      cursors,
      opponent,
      player,
      powerUp: createPowerUpState(),
      powerUpsCollected: {
        bots: 0,
        player: 0,
      },
      resultsShown: false,
      round: createRoundState(settings.roundLengthSeconds),
      settings,
      slapKeyP1,
      slapKeyP2,
      touchMovement,
      wasd: {
        down: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) ?? createDisabledKey(),
        left: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? createDisabledKey(),
        right: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? createDisabledKey(),
        up: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) ?? createDisabledKey(),
      },
      scoreText: this.add.text(arena.left, 24, "", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "24px",
      }),
      timerText: this.add
        .text(arena.right, 24, "", {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "24px",
        })
        .setOrigin(1, 0),
      winnerText: this.add
        .text(width / 2, arena.top - 36, "", {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "28px",
        })
        .setOrigin(0.5),
      lastTickInt: Math.ceil(settings.roundLengthSeconds),
    };

    const controlsHint =
      settings.mode === "2p-local"
        ? "P1: WASD + Space   |   P2: Arrows + Enter   |   Slap or tap SLAP"
        : "Move: WASD / Arrows   Slap: Space, click arena, or tap SLAP";
    this.add
      .text(width / 2, arena.bottom + 24, controlsHint, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "18px",
      })
      .setOrigin(0.5, 0);

    const slapP1 = () => {
      const rt = this.runtime;
      if (!rt || rt.round.isComplete) {
        return;
      }
      const hit = applySlap(
        rt.player,
        this.opponentActor(),
        rt.round,
        "player",
        rt.settings.winningScore,
        this.time.now,
      );
      if (hit) {
        rt.audio.playSlapHit();
      } else {
        rt.audio.playSlapMiss();
      }
    };

    const slapP2 = () => {
      const rt = this.runtime;
      if (!rt || rt.round.isComplete) {
        return;
      }
      if (rt.opponent.kind !== "player2") {
        return;
      }
      const hit = applySlap(
        rt.opponent.player,
        rt.player,
        rt.round,
        "bots",
        rt.settings.winningScore,
        this.time.now,
      );
      if (hit) {
        rt.audio.playSlapHit();
      } else {
        rt.audio.playSlapMiss();
      }
    };

    const createTouchButton = (
      x: number,
      y: number,
      label: string,
      onDown: () => void,
      onUp?: () => void,
    ) =>
      this.add
        .text(x, y, label, {
          align: "center",
          backgroundColor: "#f4f1de",
          color: "#101820",
          fontFamily: "Arial",
          fontSize: "22px",
          padding: {
            x: 16,
            y: 10,
          },
        })
        .setOrigin(0.5)
        .setInteractive()
        .on("pointerdown", onDown)
        .on("pointerup", onUp ?? (() => void 0))
        .on("pointerout", onUp ?? (() => void 0));

    const touchState = this.runtime.touchMovement;
    const controlsY = arena.bottom + 82;

    createTouchButton(
      arena.left + 78,
      controlsY,
      "LEFT",
      () => {
        touchState.left = true;
      },
      () => {
        touchState.left = false;
      },
    );
    createTouchButton(
      arena.left + 158,
      controlsY - 48,
      "UP",
      () => {
        touchState.up = true;
      },
      () => {
        touchState.up = false;
      },
    );
    createTouchButton(
      arena.left + 158,
      controlsY + 48,
      "DOWN",
      () => {
        touchState.down = true;
      },
      () => {
        touchState.down = false;
      },
    );
    createTouchButton(
      arena.left + 238,
      controlsY,
      "RIGHT",
      () => {
        touchState.right = true;
      },
      () => {
        touchState.right = false;
      },
    );
    createTouchButton(arena.right - 92, controlsY, "SLAP", slapP1);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        !this.runtime ||
        this.runtime.round.isComplete ||
        pointer.x < arena.left ||
        pointer.x > arena.right ||
        pointer.y < arena.top ||
        pointer.y > arena.bottom
      ) {
        return;
      }
      slapP1();
    });

    spawnPowerUp(
      this,
      this.runtime.powerUp,
      this.runtime.arena,
      battleConfig.powerUp.size,
    );
    updateHud(this.runtime);

    // Start battle background music (loops via AudioService).
    this.runtime.audio.playBattleTheme();
  }

  private opponentActor() {
    if (!this.runtime) {
      throw new Error("BattleScene not initialized");
    }
    return this.runtime.opponent.kind === "bot"
      ? this.runtime.opponent.bot
      : this.runtime.opponent.player;
  }

  update(_time: number, delta: number): void {
    if (!this.runtime) {
      return;
    }

    const runtime = this.runtime;

    if (runtime.round.isComplete) {
      runtime.player.body.setVelocity(0, 0);
      const opp = this.opponentActor();
      opp.body.setVelocity(0, 0);
      runtime.winnerText.setText(
        runtime.round.winner === "draw"
          ? "Draw"
          : runtime.round.winner === "player"
            ? runtime.settings.mode === "2p-local"
              ? "P1 wins"
              : "Player wins"
            : runtime.settings.mode === "2p-local"
              ? "P2 wins"
              : "Bot wins",
      );
      updateHud(runtime);

      if (!runtime.resultsShown) {
        runtime.resultsShown = true;
        const storage = getStorage();
        const results = createBattleResults({
          botScore: runtime.round.score.bots,
          mode: runtime.settings.mode,
          playerScore: runtime.round.score.player,
          powerUpsCollected: {
            bot: runtime.powerUpsCollected.bots,
            player: runtime.powerUpsCollected.player,
          },
          roundsPlayed: 1,
          winner: runtime.round.winner ?? "draw",
        });

        if (storage) {
          saveBattleResults(storage, results);
        }

        // End-of-round sting. In 2P-local mode we always use round-win
        // because the game logic doesn't know which human is "the player";
        // in 1P-vs-bot we play win/lose/draw depending on outcome.
        if (runtime.settings.mode === "2p-local") {
          if (runtime.round.winner === "draw") {
            runtime.audio.playRoundDraw();
          } else {
            runtime.audio.playRoundWin();
          }
        } else if (runtime.round.winner === "player") {
          runtime.audio.playRoundWin();
        } else if (runtime.round.winner === "bots") {
          runtime.audio.playRoundLose();
        } else {
          runtime.audio.playRoundDraw();
        }

        // Stop battle music before leaving the battle scene.
        runtime.audio.stopMusic();

        this.scene.start("ResultsScene");
      }

      return;
    }

    // --- Player 1 movement ---
    if (!isKnockedBack(runtime.player, this.time.now)) {
      moveActor(runtime.player, getDirection(runtime), this.time.now);
    }

    // --- Opponent logic ---
    const opponentActor = this.opponentActor();
    if (runtime.opponent.kind === "bot") {
      if (!isKnockedBack(runtime.opponent.bot, this.time.now)) {
        const dir = computeBotDirection(
          runtime.opponent.bot,
          runtime.player,
          runtime.powerUp,
          runtime.opponent.ai,
          this.time.now,
        );
        moveActor(
          runtime.opponent.bot,
          new Phaser.Math.Vector2(dir.x, dir.y),
          this.time.now,
        );
      }

      // B9: bot slap attempt + audio feedback. applyBotSlap internally
      // gates on shouldBotSlap and plays slap-hit / slap-miss as appropriate.
      // Previously this block only played slap-hit on success and was silent
      // on failure (cooldown / shield block). Delegating to a single helper
      // also avoids double-calling shouldBotSlap (which has the side effect
      // of stamping ai.lastSlapAttemptAt = now).
      applyBotSlap(runtime, this.time.now);
    } else {
      if (!isKnockedBack(runtime.opponent.player, this.time.now)) {
        moveActor(
          runtime.opponent.player,
          getP2Direction(runtime),
          this.time.now,
        );
      }

      if (Phaser.Input.Keyboard.JustDown(runtime.slapKeyP2)) {
        const hit = applySlap(
          runtime.opponent.player,
          runtime.player,
          runtime.round,
          "bots",
          runtime.settings.winningScore,
          this.time.now,
        );
        if (hit) {
          runtime.audio.playSlapHit();
        } else {
          runtime.audio.playSlapMiss();
        }
      }
    }

    // --- Player 1 slap ---
    if (Phaser.Input.Keyboard.JustDown(runtime.slapKeyP1)) {
      const hit = applySlap(
        runtime.player,
        opponentActor,
        runtime.round,
        "player",
        runtime.settings.winningScore,
        this.time.now,
      );
      if (hit) {
        runtime.audio.playSlapHit();
      } else {
        runtime.audio.playSlapMiss();
      }
    }

    // --- Power-up spawn + collect ---
    if (!runtime.powerUp.active) {
      spawnPowerUp(this, runtime.powerUp, runtime.arena, battleConfig.powerUp.size);
    }

    if (tryCollectPowerUp(runtime.player, runtime.powerUp, this.time.now)) {
      runtime.powerUpsCollected.player += 1;
      runtime.audio.playPowerUpCollect();
    }

    if (tryCollectPowerUp(opponentActor, runtime.powerUp, this.time.now)) {
      runtime.powerUpsCollected.bots += 1;
      runtime.audio.playPowerUpCollect();
    }

    // --- Ring out ---
    if (isRingOut(runtime.player, runtime.arena, battleConfig.arena.ringOutMargin)) {
      runtime.audio.playRingOut();
      resetOffender(runtime, "player");
    }
    if (isRingOut(opponentActor, runtime.arena, battleConfig.arena.ringOutMargin)) {
      runtime.audio.playRingOut();
      resetOffender(runtime, "opponent");
    }

    advanceRoundState(
      runtime.round,
      delta / 1000,
      runtime.settings.winningScore,
    );

    // --- Countdown ticks during the last 3 seconds ---
    const tickInt = Math.ceil(runtime.round.timeLeft);
    if (
      !runtime.round.isComplete &&
      tickInt !== runtime.lastTickInt &&
      tickInt <= 3 &&
      tickInt > 0
    ) {
      runtime.audio.playCountdownTick();
    }
    runtime.lastTickInt = tickInt;

    updateHud(runtime);
  }
}
