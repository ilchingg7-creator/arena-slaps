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
  type Player,
} from "../entities/Player";
import { applySlap, isRingOut } from "../systems/CombatSystem";
import {
  createBattleResults,
  saveBattleResults,
} from "../systems/BattleResults";
import { combineMovementInput, type DirectionInput } from "../systems/InputDirection";
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

function getDirection(runtime: BattleRuntime): Phaser.Math.Vector2 {
  const movement = combineMovementInput(
    {
      down: runtime.cursors.down.isDown,
      left: runtime.cursors.left.isDown,
      right: runtime.cursors.right.isDown,
      up: runtime.cursors.up.isDown,
    },
    {
      down: runtime.wasd.down.isDown,
      left: runtime.wasd.left.isDown,
      right: runtime.wasd.right.isDown,
      up: runtime.wasd.up.isDown,
    },
    runtime.touchMovement,
  );

  return new Phaser.Math.Vector2(movement.x, movement.y);
}

function getP2Direction(runtime: BattleRuntime): Phaser.Math.Vector2 {
  // P2 uses the same cursor keys as P1 in single-player mode would have.
  // In 2P mode, P1 is restricted to WASD and P2 gets the arrow keys.
  const movement = combineMovementInput({
    down: runtime.cursors.down.isDown,
    left: runtime.cursors.left.isDown,
    right: runtime.cursors.right.isDown,
    up: runtime.cursors.up.isDown,
  });
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

function resetActors(runtime: BattleRuntime): void {
  resetActor(runtime.player);
  if (runtime.opponent.kind === "bot") {
    resetActor(runtime.opponent.bot);
  } else {
    resetActor(runtime.opponent.player);
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

        this.scene.start("ResultsScene");
      }

      return;
    }

    // --- Player 1 movement ---
    if (!isKnockedBack(runtime.player, this.time.now)) {
      moveActor(runtime.player, getDirection(runtime));
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
        moveActor(runtime.opponent.bot, new Phaser.Math.Vector2(dir.x, dir.y));
      }

      if (
        shouldBotSlap(
          runtime.opponent.bot,
          runtime.player,
          runtime.opponent.ai,
          this.time.now,
        )
      ) {
        const hit = applySlap(
          runtime.opponent.bot,
          runtime.player,
          runtime.round,
          "bots",
          runtime.settings.winningScore,
          this.time.now,
        );
        if (hit) {
          runtime.audio.playSlapHit();
        }
      }
    } else {
      if (!isKnockedBack(runtime.opponent.player, this.time.now)) {
        moveActor(runtime.opponent.player, getP2Direction(runtime));
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
      resetActors(runtime);
    }
    if (isRingOut(opponentActor, runtime.arena, battleConfig.arena.ringOutMargin)) {
      runtime.audio.playRingOut();
      resetActors(runtime);
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
