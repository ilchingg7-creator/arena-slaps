import Phaser from "phaser";
import { battleConfig } from "../config/battleConfig";
import { createBot, moveBotToward, type Bot } from "../entities/Bot";
import {
  createPlayer,
  moveActor,
  resetActor,
  type Player,
} from "../entities/Player";
import { applySlap, isRingOut } from "../systems/CombatSystem";
import { createBattleResults, saveBattleResults } from "../systems/BattleResults";
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

type BattleRuntime = {
  arena: Phaser.Geom.Rectangle;
  bot: Bot;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  touchMovement: DirectionInput;
  player: Player;
  powerUp: PowerUpState;
  powerUpsCollected: {
    bot: number;
    player: number;
  };
  resultsShown: boolean;
  round: RoundState;
  slapKey: Phaser.Input.Keyboard.Key;
  scoreText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  wasd: {
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
  };
  winnerText: Phaser.GameObjects.Text;
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

function updateHud(runtime: BattleRuntime): void {
  runtime.timerText.setText(`Time: ${Math.ceil(runtime.round.timeLeft)}`);
  runtime.scoreText.setText(
    `Player ${runtime.round.score.player} - ${runtime.round.score.bots} Bot`,
  );
}

function resetActors(runtime: BattleRuntime): void {
  resetActor(runtime.player);
  resetActor(runtime.bot);
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

  create(): void {
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
    const bot = createBot(this, arena.right - 160, arena.centerY, battleConfig.bot);

    this.physics.add.collider(player.sprite, bot.sprite);

    const keyboard = this.input.keyboard;
    const cursors = keyboard?.createCursorKeys() ?? {
      down: createDisabledKey(),
      left: createDisabledKey(),
      right: createDisabledKey(),
      up: createDisabledKey(),
    };
    const touchMovement: DirectionInput = {
      down: false,
      left: false,
      right: false,
      up: false,
    };

    this.runtime = {
      arena,
      bot,
      cursors,
      touchMovement,
      player,
      powerUp: createPowerUpState(),
      powerUpsCollected: {
        bot: 0,
        player: 0,
      },
      resultsShown: false,
      round: createRoundState(battleConfig.round.lengthSeconds),
      scoreText: this.add.text(arena.left, 24, "", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "24px",
      }),
      slapKey: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) ?? createDisabledKey(),
      timerText: this.add
        .text(arena.right, 24, "", {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "24px",
        })
        .setOrigin(1, 0),
      wasd: {
        down: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) ?? createDisabledKey(),
        left: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? createDisabledKey(),
        right: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? createDisabledKey(),
        up: keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) ?? createDisabledKey(),
      },
      winnerText: this.add
        .text(width / 2, arena.top - 36, "", {
          color: "#f4f1de",
          fontFamily: "Arial",
          fontSize: "28px",
        })
        .setOrigin(0.5),
    };

    this.add
      .text(width / 2, arena.bottom + 24, "Move: WASD / Arrows   Slap: Space, click arena, or tap SLAP", {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "18px",
      })
      .setOrigin(0.5, 0);

    const slap = () => {
      if (!this.runtime || this.runtime.round.isComplete) {
        return;
      }

      applySlap(
        this.runtime.player,
        this.runtime.bot,
        this.runtime.round,
        "player",
        battleConfig.round.winningScore,
        this.time.now,
      );
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

    createTouchButton(arena.left + 78, controlsY, "LEFT", () => {
      touchState.left = true;
    }, () => {
      touchState.left = false;
    });
    createTouchButton(arena.left + 158, controlsY - 48, "UP", () => {
      touchState.up = true;
    }, () => {
      touchState.up = false;
    });
    createTouchButton(arena.left + 158, controlsY + 48, "DOWN", () => {
      touchState.down = true;
    }, () => {
      touchState.down = false;
    });
    createTouchButton(arena.left + 238, controlsY, "RIGHT", () => {
      touchState.right = true;
    }, () => {
      touchState.right = false;
    });
    createTouchButton(arena.right - 92, controlsY, "SLAP", slap);

    this.input.on("pointerdown", (pointer) => {
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

      slap();
    });

    spawnPowerUp(this, this.runtime.powerUp, this.runtime.arena, battleConfig.powerUp.size);
    updateHud(this.runtime);
  }

  update(_time: number, delta: number): void {
    if (!this.runtime) {
      return;
    }

    const runtime = this.runtime;

    if (runtime.round.isComplete) {
      runtime.player.body.setVelocity(0, 0);
      runtime.bot.body.setVelocity(0, 0);
      runtime.winnerText.setText(
        runtime.round.winner === "draw"
          ? "Draw"
          : runtime.round.winner === "player"
            ? "Player wins"
            : "Bot wins",
      );
      updateHud(runtime);

      if (!runtime.resultsShown) {
        runtime.resultsShown = true;
        const storage = getStorage();
        const results = createBattleResults({
          botScore: runtime.round.score.bots,
          playerScore: runtime.round.score.player,
          powerUpsCollected: runtime.powerUpsCollected,
          roundsPlayed: 1,
          winner: runtime.round.winner ?? "draw",
        });

        if (storage) {
          saveBattleResults(storage, results);
        }

        this.scene.start("ResultsScene");
      }

      return;
    }

    moveActor(runtime.player, getDirection(runtime));
    moveBotToward(runtime.bot, runtime.player);

    if (Phaser.Input.Keyboard.JustDown(runtime.slapKey)) {
      applySlap(
        runtime.player,
        runtime.bot,
        runtime.round,
        "player",
        battleConfig.round.winningScore,
        this.time.now,
      );
    }

    applySlap(
      runtime.bot,
      runtime.player,
      runtime.round,
      "bots",
      battleConfig.round.winningScore,
      this.time.now,
    );

    if (!runtime.powerUp.active) {
      spawnPowerUp(this, runtime.powerUp, runtime.arena, battleConfig.powerUp.size);
    }

    if (
      tryCollectPowerUp(runtime.player, runtime.powerUp, this.time.now)
    ) {
      runtime.powerUpsCollected.player += 1;
    }

    if (
      tryCollectPowerUp(runtime.bot, runtime.powerUp, this.time.now)
    ) {
      runtime.powerUpsCollected.bot += 1;
    }

    if (isRingOut(runtime.player, runtime.arena, battleConfig.arena.ringOutMargin)) {
      resetActors(runtime);
    }

    if (isRingOut(runtime.bot, runtime.arena, battleConfig.arena.ringOutMargin)) {
      resetActors(runtime);
    }

    advanceRoundState(
      runtime.round,
      delta / 1000,
      battleConfig.round.winningScore,
    );
    updateHud(runtime);
  }
}
