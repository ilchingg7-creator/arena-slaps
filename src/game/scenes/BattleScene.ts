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
  registerPoint,
  type RoundState,
} from "../systems/RoundSystem";
import type { ScoringSide } from "../systems/ScoringSystem";
import {
  createPowerUpState,
  spawnPowerUp,
  tryCollectPowerUp,
  shouldDespawnPowerUp,
  isInDespawnWarning,
  shouldBlink,
  despawnPowerUp,
  isFrozen,
  isDoubleSlapReady,
  type PowerUpState,
} from "../systems/PowerUpSystem";
import { getAudioService } from "../audio/getAudioService";
import type { AudioService } from "../audio/AudioService";
import { createBackground } from "../ui/Background";
import { createPauseMenu, type PauseMenu } from "../ui/PauseMenu";
import { loadProfile, saveProfile } from "../config/profile";
import { ProfileService } from "../services/ProfileService";
import {
  computeBotDirection,
  createBotAI,
  shouldBotSlap,
  type BotAIState,
} from "../systems/BotAI";
import { createAnimatedSprite, type AnimatedSprite } from "../sprites/AnimatedSprite";
import {
  getActorAnimationState,
  getActorEffectTint,
} from "../sprites/actorAnimations";
import { resolveNicknames, type NicknamePair } from "./nicknameHelpers";
import { I18nService } from "../i18n/I18nService";

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
  /**
   * Localization service. Loaded once in `create()` from the user's
   * persisted language preference. Used for the HUD "Time:" prefix,
   * the controls hint, and the winner banner (Draw / Player wins / etc).
   */
  i18n: I18nService;
  /**
   * Visual sprite wrapper for the opponent actor. Sits on top of the
   * (hidden) physics rectangle and swaps textures based on the opponent's
   * animation state. Prefix is "bot" in 1P-vs-bot mode and "player" in
   * 2P-local mode (the only two character texture sets that exist today).
   */
  opponentAnim: AnimatedSprite;
  /**
   * Floating name label rendered above the opponent's sprite. Repositioned
   * every frame in `update()` so it tracks the actor across the arena.
   * Set in `create()` once the opponent sprite has been created.
   */
  opponentNameLabel: Phaser.GameObjects.Text;
  opponent: Opponent;
  /**
   * Resolved (player, opponent) nicknames for the HUD score line and the
   * floating labels. Source of truth lives in the registry (written by
   * `init`), but `updateHud` reads from the runtime copy each frame to
   * avoid hitting the registry every tick.
   */
  nicknames: NicknamePair;
  player: Player;
  /**
   * Visual sprite wrapper for the human player. Sits on top of the (hidden)
   * physics rectangle and swaps textures based on the player's animation
   * state. Prefix is always "player".
   */
  playerAnim: AnimatedSprite;
  /**
   * Floating name label rendered above the player's sprite. Repositioned
   * every frame in `update()` so it tracks the actor across the arena.
   * Set in `create()` once the player sprite has been created.
   */
  playerNameLabel: Phaser.GameObjects.Text;
  powerUp: PowerUpState;
  powerUpsCollected: {
    bots: number;
    player: number;
  };
  /**
   * Per-effect keys of every power-up the human player has collected this
   * round (e.g. ["speed", "shield", "speed"]). Mirrored into the profile
   * via `recordGameResult({ powerUpTypes })` so ProfileService can derive
   * the favorite power-up (M2 fix). Only player collections are tracked —
   * the bot/P2 collections aren't part of the player's profile.
   */
  powerUpTypesCollected: string[];
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
  runtime.timerText.setText(
    `${runtime.i18n.t("battle.time")}: ${Math.ceil(runtime.round.timeLeft)}`,
  );
  // --- Nicknames (Task 3b) ---
  // Both labels come from the resolved nickname pair stashed in the runtime.
  // Previously this used hard-coded "Player"/"Bot"/"P1"/"P2" labels; the
  // nickname pair flows through from BattleSetupScene (profile nickname for
  // the player, random nickname for the bot / P2).
  const { player: playerLabel, opponent: opponentLabel } = runtime.nicknames;
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
 *
 * Note: previously this type also carried `round` and `settings.winningScore`
 * so `applyBotSlap` could forward them to `applySlap` for scoring. Scoring
 * has moved to the ring-out handler (`handleRingOut`), so the bot slap path
 * no longer touches round state — those fields are gone.
 */
export type BotSlapRuntimeLike = {
  player: ActorState;
  opponent:
    | { kind: "bot"; bot: ActorState; ai: BotAIState }
    | { kind: "player2"; player: ActorState };
  audio: {
    playSlapHit: () => void;
    playSlapMiss: () => void;
  };
};

/**
 * Minimal structural view of {@link BattleRuntime} that exposes only the
 * fields {@link handleRingOut} needs. Exported so the unit test can construct
 * a stub without instantiating Phaser / the full BattleScene.
 */
export type RingOutRuntimeLike = {
  player: ActorState;
  opponent:
    | { kind: "bot"; bot: ActorState }
    | { kind: "player2"; player: ActorState };
  round: RoundState;
  audio: {
    playRingOut: () => void;
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
  // C2: frozen actors cannot slap. The freeze power-up blocks ALL actions,
  // including slapping. `shouldBotSlap` itself doesn't check frozen state
  // (it only looks at distance + cooldown + dodge), so without this gate a
  // frozen bot would still attempt a slap and `applySlap` would happily
  // land the knockback. We early-return silently — no slap-hit / slap-miss
  // audio — to match the player paths, which are also gated on `isFrozen`
  // in `update()` and play no audio when frozen.
  if (isFrozen(runtime.opponent.bot, now)) {
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
  const hit = applySlap(runtime.opponent.bot, runtime.player, now);
  if (hit) {
    runtime.audio.playSlapHit();
  } else {
    runtime.audio.playSlapMiss();
  }
}

/**
 * Handle a ring-out: award the point to the OPPOSITE side (the actor that
 * fell off concedes), play the ring-out sound, and reset only the offender.
 *
 * Extracted from `update()` so the scoring-on-ring-out contract can be
 * unit-tested without driving the full Phaser scene. Previously the
 * ring-out branch only played the sound + reset the offender — no point
 * was awarded, because `applySlap` was awarding points on every successful
 * slap. Scoring has now moved here (slap → knockback only, ring-out →
 * point + reset).
 */
export function handleRingOut(
  runtime: RingOutRuntimeLike,
  who: "player" | "opponent",
  winningScore: number,
): void {
  // The actor that rings out concedes the point to the OPPOSITE side:
  // player rings out → bots score; opponent rings out → player scores.
  const side: ScoringSide = who === "player" ? "bots" : "player";
  registerPoint(runtime.round, side, winningScore);
  runtime.audio.playRingOut();
  resetOffender(runtime, who);
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
  private pauseMenu: PauseMenu | null = null;

  constructor() {
    super("BattleScene");
  }

  init(
    data:
      | {
          settings?: Partial<GameSettings>;
          playerNickname?: string;
          botNickname?: string;
          player2Nickname?: string;
        }
      | undefined,
  ): void {
    const settings: GameSettings = {
      ...DEFAULT_SETTINGS,
      ...(data?.settings ?? {}),
    };
    this.registry.set("settings", settings);
    // --- Nicknames (Task 3b) ---
    // Resolve (player, opponent) pair via the pure helper so the rules can
    // be unit-tested without instantiating Phaser. The result is stashed in
    // the registry here; `create()` copies it into the runtime so updateHud
    // doesn't have to hit the registry every frame.
    const nicknames = resolveNicknames(
      settings.mode,
      data?.playerNickname ?? "Player",
      data?.botNickname,
      data?.player2Nickname,
    );
    this.registry.set("nicknames", nicknames);
  }

  create(): void {
    const settings: GameSettings =
      this.registry.get("settings") ?? DEFAULT_SETTINGS;
    // Nicknames were resolved in `init` and stashed in the registry. The
    // runtime copies them so `updateHud` doesn't have to read the registry
    // every frame.
    const nicknames: NicknamePair =
      this.registry.get("nicknames") ??
      resolveNicknames(settings.mode, "Player");

    const width = this.scale.width || 1280;
    const height = this.scale.height || 720;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const i18n = I18nService.load(storage);
    const arena = new Phaser.Geom.Rectangle(
      (width - battleConfig.arena.width) / 2,
      (height - battleConfig.arena.height) / 2,
      battleConfig.arena.width,
      battleConfig.arena.height,
    );

    this.cameras.main.setBackgroundColor("#101820");

    // --- Cosmic sky background (arena-bg.png) ---
    // Rendered at depth -100 so all gameplay objects sit on top.
    // Uses createBackground for consistency with the other scenes — the
    // component handles the missing-texture fallback automatically.
    createBackground(this as unknown as Phaser.Scene, { key: "arena-bg" });

    // --- Levitating arena platform (arena-platform.png) ---
    // Drawn behind the arena boundary stroke so the neon platform edge is
    // visible underneath the white boundary line. Falls back to a
    // rectangle with the manifest's fallbackColor when the texture is missing.
    if (this.textures.exists("arena-platform")) {
      this.add.image(arena.centerX, arena.centerY, "arena-platform")
        .setDisplaySize(battleConfig.arena.width, battleConfig.arena.height)
        .setDepth(-50);
    } else {
      this.add.rectangle(
        arena.centerX,
        arena.centerY,
        battleConfig.arena.width,
        battleConfig.arena.height,
        0x2a2d44,
      ).setDepth(-50);
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xf4f1de, 1);
    graphics.strokeRectShape(arena);

    const player = createPlayer(
      this,
      arena.left + 160,
      arena.centerY,
      battleConfig.player,
    );

    // --- AnimatedSprite (Task 2a): wrap the player's rectangle with a
    // texture-swapping visual sprite. The rectangle continues to own the
    // physics body and drive collisions; the AnimatedSprite is purely
    // visual and is repositioned every frame to track the rectangle.
    // Hiding the rectangle keeps the AnimatedSprite as the only visible
    // representation of the player.
    const playerAnim = createAnimatedSprite(this, {
      prefix: "player",
      x: arena.left + 160,
      y: arena.centerY,
    });
    player.sprite.setVisible(false);

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

    // --- AnimatedSprite for the opponent. In 1P-vs-bot mode the prefix is
    // "bot" (uses the bot-* texture set); in 2P-local mode the prefix is
    // "player" (only two character texture sets exist today, so P2 shares
    // the player-* set with P1). The future-2B agent may add a player2-*
    // set and switch the prefix.
    const opponentPrefix = opponent.kind === "bot" ? "bot" : "player";
    const opponentSprite =
      opponent.kind === "bot" ? opponent.bot.sprite : opponent.player.sprite;
    const opponentAnim = createAnimatedSprite(this, {
      prefix: opponentPrefix,
      x: arena.right - 160,
      y: arena.centerY,
    });
    opponentSprite.setVisible(false);

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

    // --- Floating name labels (Task 3b) ---
    // Rendered above each actor and repositioned every frame in `update()`
    // so they track the actors as they move around the arena. Depth 10
    // keeps them on top of the arena graphics + animated sprites.
    const playerNameLabel = this.add
      .text(player.sprite.x, player.sprite.y - 40, nicknames.player, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(10);
    const opponentNameLabel = this.add
      .text(opponentSprite.x, opponentSprite.y - 40, nicknames.opponent, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.runtime = {
      arena,
      audio: getAudioService(this, settings),
      botAI: opponent.kind === "bot" ? opponent.ai : null,
      cursors,
      i18n,
      nicknames,
      opponentAnim,
      opponentNameLabel,
      opponent,
      player,
      playerAnim,
      playerNameLabel,
      powerUp: createPowerUpState(),
      powerUpsCollected: {
        bots: 0,
        player: 0,
      },
      powerUpTypesCollected: [],
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
        ? i18n.t("battle.controls.2p")
        : i18n.t("battle.controls.1p");
    // Semi-transparent background pill behind the hint for readability
    const hintY = arena.bottom + 38;
    this.add
      .rectangle(width / 2, hintY, 720, 32, 0x000000, 0.5)
      .setOrigin(0.5, 0.5)
      .setDepth(5);
    this.add
      .text(width / 2, hintY, controlsHint, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "16px",
        stroke: "#000000",
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 1, color: "#000000", blur: 2, fill: true },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6);

    const slapP1 = () => {
      const rt = this.runtime;
      if (!rt || rt.round.isComplete) {
        return;
      }
      const hit = applySlap(
        rt.player,
        this.opponentActor(),
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

    // --- Pause menu (Task 2c) ---
    // Esc toggles the pause overlay. While the menu is visible the battle
    // scene is paused (this.scene.pause() halts update() + physics). The
    // menu's onResume/onSettings/onQuit callbacks drive the scene-level
    // resume / settings-toggle / quit-to-main-menu behaviour.
    //
    // M1: pass the shared audio + settings + storage so the inline
    // VolumeSliders can push live updates through `audio.updateSettings`
    // and persist to localStorage. The scene also forwards global
    // pointermove/up events to the menu so the slider drag stays alive
    // when the pointer leaves the slider's hit zone (mirroring the
    // AudioSettingsScene pattern).
    const pauseMenu = createPauseMenu(this, {
      battleSceneKey: "BattleScene",
      i18n,
      audio: this.runtime.audio,
      settings,
      storage: typeof window !== "undefined" ? window.localStorage : null,
      onResume: () => {
        this.scene.resume();
      },
      onSettings: () => {
        pauseMenu.toggleSettings();
      },
      onQuit: () => {
        this.scene.stop();
        this.scene.start("MainMenuScene");
      },
    });
    this.pauseMenu = pauseMenu;

    // Forward global pointer events to the pause menu so the inline
    // VolumeSliders keep tracking the drag while the pointer is outside
    // their hit zones (M1). Safe to forward every frame: the slider's
    // handlePointerMove is a no-op when not dragging, and endDrag is
    // idempotent.
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.pauseMenu) {
        this.pauseMenu.handlePointerMove(pointer);
      }
    });
    this.input.on("pointerup", () => {
      if (this.pauseMenu) {
        this.pauseMenu.endDrag();
      }
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.pauseMenu) {
        return;
      }
      // Don't toggle the pause menu once the round is complete — the
      // results transition is already in flight and pausing would freeze
      // the ResultsScene handoff.
      if (this.runtime?.round.isComplete) {
        return;
      }
      if (this.pauseMenu.isVisible()) {
        this.pauseMenu.hide();
        this.scene.resume();
      } else {
        this.pauseMenu.show();
        this.scene.pause();
      }
    });

    // Clean up the pause menu + runtime when the scene shuts down.
    this.events.on("shutdown", () => {
      if (this.pauseMenu) {
        this.pauseMenu.destroy();
        this.pauseMenu = null;
      }
      this.runtime = null;
    });
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
          ? runtime.i18n.t("battle.draw")
          : runtime.round.winner === "player"
            ? runtime.settings.mode === "2p-local"
              ? runtime.i18n.t("battle.p1Wins")
              : runtime.i18n.t("battle.playerWins")
            : runtime.settings.mode === "2p-local"
              ? runtime.i18n.t("battle.p2Wins")
              : runtime.i18n.t("battle.botWins"),
      );
      updateHud(runtime);
      // Sync the animated sprites one last time so they settle on the
      // actors' final positions before the scene transitions out.
      this.syncAnimatedSprites();

      if (!runtime.resultsShown) {
        runtime.resultsShown = true;
        // MINOR-10: hide the floating nickname labels so they don't
        // overlap the winner banner. They're not needed once the round
        // has settled — the results scene shows its own summary.
        runtime.playerNameLabel.setVisible(false);
        runtime.opponentNameLabel.setVisible(false);
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

        // Record game result to the player's profile (1P-vs-bot only —
        // in 2P-local mode both players are human, so "win/loss" doesn't
        // apply to a single profile).
        if (storage && runtime.settings.mode === "1p-vs-bot") {
          try {
            const profile = loadProfile(storage);
            const service = new ProfileService(profile);
            const outcome: "win" | "loss" | "draw" =
              runtime.round.winner === "player"
                ? "win"
                : runtime.round.winner === "bots"
                  ? "loss"
                  : "draw";
            service.recordGameResult({
              mode: runtime.settings.mode,
              outcome,
              ringOutsInflicted: runtime.round.score.player,
              ringOutsSuffered: runtime.round.score.bots,
              powerUpsCollected: runtime.powerUpsCollected.player,
              // M2: pass the per-effect keys collected this round so
              // ProfileService can derive the favorite power-up.
              powerUpTypes: runtime.powerUpTypesCollected,
            });
            saveProfile(storage, service.getProfile());
          } catch {
            // Profile recording is non-critical — don't crash the round-end flow.
          }
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
    if (!isKnockedBack(runtime.player, this.time.now) && !isFrozen(runtime.player, this.time.now)) {
      moveActor(runtime.player, getDirection(runtime), this.time.now);
    }

    // --- Opponent logic ---
    const opponentActor = this.opponentActor();
    if (runtime.opponent.kind === "bot") {
      if (!isKnockedBack(runtime.opponent.bot, this.time.now) && !isFrozen(runtime.opponent.bot, this.time.now)) {
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
      if (!isKnockedBack(runtime.opponent.player, this.time.now) && !isFrozen(runtime.opponent.player, this.time.now)) {
        moveActor(
          runtime.opponent.player,
          getP2Direction(runtime),
          this.time.now,
        );
      }

      if (Phaser.Input.Keyboard.JustDown(runtime.slapKeyP2) && !isFrozen(runtime.opponent.player, this.time.now)) {
        const hit = applySlap(
          runtime.opponent.player,
          runtime.player,
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
    // C2: frozen actors cannot slap. The freeze power-up was previously
    // checked before `moveActor` but NOT before the three slap paths, so a
    // frozen P1 could still slap. The `isFrozen` gate here (and the matching
    // gates on P2 + `applyBotSlap`) make freeze block ALL actions.
    if (Phaser.Input.Keyboard.JustDown(runtime.slapKeyP1) && !isFrozen(runtime.player, this.time.now)) {
      const hit = applySlap(
        runtime.player,
        opponentActor,
        this.time.now,
      );
      if (hit) {
        runtime.audio.playSlapHit();
      } else {
        runtime.audio.playSlapMiss();
      }
    }

    // --- Power-up despawn + blink + spawn + collect ---
    // 1) If a power-up is currently active, drive its despawn timer + the
    //    blink strobe during the warning window (last 2s before despawn).
    //    The blink visibility is computed from `shouldBlink` — outside the
    //    warning window the sprite stays fully visible.
    // 2) If no power-up is active (either because none has spawned yet OR
    //    the despawn / collect logic just cleared it), spawn the next one.
    // 3) Try to collect the active power-up for both the player and the
    //    opponent. tryCollectPowerUp is a no-op when no power-up is active
    //    or when the actor is out of pickup range.
    if (runtime.powerUp.active) {
      const now = this.time.now;
      // Blink during the warning window; otherwise keep the sprite visible.
      if (isInDespawnWarning(runtime.powerUp, now)) {
        runtime.powerUp.active.sprite.setVisible(shouldBlink(runtime.powerUp, now));
      } else {
        runtime.powerUp.active.sprite.setVisible(true);
      }
      // Despawn after the 8s lifetime elapses.
      // MINOR-2: previously this called `playRingOut()` as the despawn cue —
      // but the ring-out sound is a loud "out of bounds" cue that confused
      // players (sounded like someone rang out when nothing happened). The
      // despawn is silent now; the blinking warning strobe during the last
      // 2s already signals the upcoming despawn visually. A dedicated
      // "powerup-despawn" sound can be added in a future audio pass.
      if (shouldDespawnPowerUp(runtime.powerUp, now)) {
        despawnPowerUp(runtime.powerUp);
      }
    }

    if (!runtime.powerUp.active) {
      spawnPowerUp(this, runtime.powerUp, runtime.arena, battleConfig.powerUp.size);
    }

    // M2: capture the active power-up's effect key BEFORE calling
    // tryCollectPowerUp — `tryCollectPowerUp` nulls `state.active` as
    // part of the collect (it kicks off the collected animation and
    // defers sprite destruction, but the active slot is cleared
    // immediately so subsequent calls during the 250ms animation window
    // return false). Reading `active?.definition.key` after the call
    // would always be undefined.
    const collectedKey = runtime.powerUp.active?.definition.key;
    if (tryCollectPowerUp(runtime.player, runtime.powerUp, this.time.now, opponentActor)) {
      runtime.powerUpsCollected.player += 1;
      if (collectedKey) {
        runtime.powerUpTypesCollected.push(collectedKey);
      }
      runtime.audio.playPowerUpCollect();
    }

    if (tryCollectPowerUp(opponentActor, runtime.powerUp, this.time.now, runtime.player)) {
      runtime.powerUpsCollected.bots += 1;
      runtime.audio.playPowerUpCollect();
    }

    // --- Ring out ---
    // Points are awarded ONLY on ring-out: the actor that falls off concedes
    // a point to the opposite side. Slaps apply knockback but do not score
    // (see `applySlap`). `handleRingOut` also plays the ring-out sound and
    // resets only the offender.
    if (isRingOut(runtime.player, runtime.arena, battleConfig.arena.ringOutMargin)) {
      handleRingOut(runtime, "player", runtime.settings.winningScore);
    }
    if (isRingOut(opponentActor, runtime.arena, battleConfig.arena.ringOutMargin)) {
      handleRingOut(runtime, "opponent", runtime.settings.winningScore);
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

    // --- AnimatedSprite sync (Task 2a) ---
    // The animated sprites are visual mirrors of the (hidden) physics
    // rectangles. Update their texture state, effect tint, and position
    // once per frame AFTER all movement / slap / ring-out logic has
    // settled so they reflect the actors' final state for this tick.
    this.syncAnimatedSprites();

    // --- Floating name labels (Task 3b) ---
    // Track each actor's final position for this tick. Same offset (-40)
    // used in `create()` so the label sits just above the sprite.
    runtime.playerNameLabel.setPosition(
      runtime.player.sprite.x,
      runtime.player.sprite.y - 40,
    );
    runtime.opponentNameLabel.setPosition(
      opponentActor.sprite.x,
      opponentActor.sprite.y - 40,
    );

    updateHud(runtime);
  }

  /**
   * Synchronize both actors' {@link AnimatedSprite} wrappers with their
   * underlying physics rectangles for the current frame. Reads the actors'
   * velocity + power-up state via the pure helpers in `actorAnimations`
   * and pushes the resulting (state, tint, position) triple into each
   * sprite. The sprites themselves no-op when nothing has changed, so
   * calling this every frame is cheap.
   *
   * This is a method rather than a free function so it can read
   * `this.runtime` + `this.time.now` without the caller having to thread
   * them through. Safe to call whenever `this.runtime` is non-null.
   */
  private syncAnimatedSprites(): void {
    const runtime = this.runtime;
    if (!runtime) {
      return;
    }
    const now = this.time.now;

    const playerState = getActorAnimationState(runtime.player, now);
    const playerTint = getActorEffectTint(runtime.player, now);
    runtime.playerAnim.setState(playerState);
    runtime.playerAnim.setEffectTint(playerTint);
    runtime.playerAnim.setPosition(
      runtime.player.sprite.x,
      runtime.player.sprite.y,
    );

    const opponentActorState = this.opponentActor();
    const opponentState = getActorAnimationState(opponentActorState, now);
    const opponentTint = getActorEffectTint(opponentActorState, now);
    runtime.opponentAnim.setState(opponentState);
    runtime.opponentAnim.setEffectTint(opponentTint);
    runtime.opponentAnim.setPosition(
      opponentActorState.sprite.x,
      opponentActorState.sprite.y,
    );
  }
}
