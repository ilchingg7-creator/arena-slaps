import Phaser from "phaser";
import { battleConfig } from "../config/battleConfig";
import { YandexSDK } from "../yandex/SDK";
import { computeArenaDimensions } from "../config/responsive";
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
import { applySlap, getComboMultiplier, isRingOut } from "../systems/CombatSystem";
import { playRingOutFX } from "../systems/RingOutFX";
import {
  canDodge,
  getDodgeSpeedMultiplier,
  isDodging,
  startDodge,
} from "../systems/DodgeSystem";
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
import { processBattleEnd } from "../services/processBattleEnd";
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
import { DEFAULT_MAP_KEY, getMapByKey } from "../config/mapManifest";
import { resolveP1Cosmetics, resolveP2Cosmetics, type ResolvedCosmetics } from "../cosmetics/resolveCosmetics";
import {
  createCosmeticVisuals,
  applyOutline,
  applyTitleToLabel,
  type CosmeticVisuals,
} from "../cosmetics/CosmeticVisuals";

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
  arena?: Phaser.Geom.Rectangle;
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
  /**
   * P1 dodge key (Task 2ac). Defaults to Left-Shift. When JustDown AND
   * `canDodge(player, now)` is true AND a movement direction is held,
   * `startDodge` stamps the i-frame window and the BattleScene applies
   * the dodge velocity (2x move speed) for the 200ms duration.
   */
  dodgeKeyP1: Phaser.Input.Keyboard.Key;
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
  /**
   * Combo counter HUD (Task 2ac). Shows "Combo: x3" near the score text
   * while the player has comboStacks > 0. Hidden otherwise. Updated every
   * frame in {@link updateHud}. Reuses the same font / color as the score
   * text for visual consistency.
   */
  comboText: Phaser.GameObjects.Text;
  lastTickInt: number;
  lastPowerUpDespawnAt: number;
  isPaused: boolean;
  /**
   * Wall-clock timestamp (ms) when the battle started. Set in `create()`.
   * Used at round-end to compute `roundDurationMs` for the speed_demon
   * achievement + the ResultsScene summary.
   */
  battleStartAt: number;
  /**
   * Highest combo stack count the player reached this battle. Updated
   * every frame from `runtime.player.comboStacks` (taking the max so a
   * brief spike to 5 then back to 0 still counts). Drives the
   * `combo_5` achievement.
   */
  maxComboReached: number;
  /**
   * Total successful dodges the player performed this battle. Incremented
   * in `update()` whenever `startDodge` returns true. Drives the
   * `dodge_master` achievement.
   */
  dodgesThisBattle: number;
  /**
   * Total times the player was knocked out (ring-out) this battle.
   * Incremented in `handleRingOut("player", ...)`. Drives the `survivor`
   * achievement (3+ ring-outs suffered AND a win).
   */
  ringOutsSufferedThisBattle: number;
  /**
   * P1's cosmetic visuals (headwear overlay + trail emitter + slapFx).
   * null when no visual cosmetics are equipped. Updated every frame in
   * update() to track the player's position.
   */
  p1CosmeticVisuals: CosmeticVisuals | null;
  /**
   * Opponent's cosmetic visuals (only for 2P-local — bots don't equip
   * cosmetics). null in 1P-vs-bot mode or when no visual cosmetics.
   */
  opponentCosmeticVisuals: CosmeticVisuals | null;
  /**
   * P1's resolved cosmetics (color, outline, trail, slapFx, title,
   * headwear). Cached at create() time so slapP1 can read the slapFx
   * texture key without re-resolving every slap.
   */
  p1Cosmetics: ResolvedCosmetics | null;
  /**
   * Opponent's resolved cosmetics (only set in 2P-local mode).
   */
  opponentCosmetics: ResolvedCosmetics | null;
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
  // --- Combo HUD (Task 2ac) ---
  // Show "Combo: xN" while the player has comboStacks > 0. The combo
  // counter resets to 0 when the player gets hit (defender.comboStacks = 0
  // in applySlap) or when 3000ms pass without a successful slap (reset by
  // getComboMultiplier, which is called every frame in update()).
  if (runtime.player.comboStacks > 0) {
    runtime.comboText.setText(`Combo: x${runtime.player.comboStacks}`);
    runtime.comboText.setVisible(true);
    // Track the peak for the `combo_5` achievement — taking the max each
    // frame preserves brief spikes (e.g. a 5-stack that times out before
    // the next update() would otherwise be missed).
    if (runtime.player.comboStacks > runtime.maxComboReached) {
      runtime.maxComboReached = runtime.player.comboStacks;
    }
  } else {
    runtime.comboText.setVisible(false);
  }
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
  const arena = runtime.arena;
  if (who === "player") {
    // Random respawn in the LEFT half of the arena.
    if (arena) {
      const halfWidth = (arena.right - arena.left) / 2;
      const margin = 80;
      const x = arena.left + margin + Math.random() * (halfWidth - margin * 2);
      const y = arena.top + margin + Math.random() * ((arena.bottom - arena.top) - margin * 2);
      runtime.player.spawn.set(x, y);
    }
    resetActor(runtime.player);
    return;
  }
  if (runtime.opponent.kind === "bot") {
    if (arena) {
      const halfWidth = (arena.right - arena.left) / 2;
      const margin = 80;
      const x = arena.left + halfWidth + margin + Math.random() * (halfWidth - margin * 2);
      const y = arena.top + margin + Math.random() * ((arena.bottom - arena.top) - margin * 2);
      runtime.opponent.bot.spawn.set(x, y);
    }
    resetActor(runtime.opponent.bot);
  } else {
    if (arena) {
      const halfWidth = (arena.right - arena.left) / 2;
      const margin = 80;
      const x = arena.left + halfWidth + margin + Math.random() * (halfWidth - margin * 2);
      const y = arena.top + margin + Math.random() * ((arena.bottom - arena.top) - margin * 2);
      runtime.opponent.player.spawn.set(x, y);
    }
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
 * fell off concedes) and play the ring-out sound.
 *
 * Extracted from `update()` so the scoring-on-ring-out contract can be
 * unit-tested without driving the full Phaser scene. Previously the
 * ring-out branch only played the sound + reset the offender — no point
 * was awarded, because `applySlap` was awarding points on every successful
 * slap. Scoring has now moved here (slap → knockback only, ring-out →
 * point + reset).
 *
 * Task 2b: the offender is NO LONGER reset inside this function. The
 * caller (BattleScene.update) invokes `playRingOutFX` after this and
 * passes `resetOffender` as the FX's `onComplete` callback, so the
 * offender teleport happens AFTER the visual sequence (camera shake +
 * fall animation + off-screen tween + flash) has had time to play.
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
  // NOTE: resetOffender is intentionally NOT called here. See the
  // docstring above — the caller is responsible for resetting the
  // offender via playRingOutFX's onComplete callback.
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
  /**
   * Per-actor flags tracking whether a ring-out FX sequence is currently
   * playing for that actor. While true for an actor, the ring-out section
   * in `update()` skips re-triggering FX for that actor — otherwise
   * `isRingOut` would re-fire every frame for the 500ms the offender is
   * off-screen, each call stacking another point + another FX on top of
   * the in-flight one (Task 2b).
   *
   * Set to `true` when `playRingOutFX` is invoked; cleared in its
   * `onComplete` callback right after `resetOffender` teleports the actor
   * back to spawn.
   */
  private ringOutFxInProgress: { player: boolean; opponent: boolean } = {
    player: false,
    opponent: false,
  };

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
    // Reset per-battle state. Phaser reuses scene instances across
    // stop()/start() cycles, so class fields are NOT re-initialized by
    // the constructor. Without this reset, ringOutFxInProgress can
    // stay true from a previous battle (if onComplete never fired
    // because the scene transitioned to ResultsScene mid-FX), which
    // would permanently freeze bot movement.
    this.ringOutFxInProgress = { player: false, opponent: false };
    this.pauseMenu = null;

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
    const arenaDims = computeArenaDimensions({ width, height });
    const arena = new Phaser.Geom.Rectangle(
      arenaDims.offsetX,
      arenaDims.offsetY,
      arenaDims.width,
      arenaDims.height,
    );

    this.cameras.main.setBackgroundColor("#101820");

    // --- Map selection (Task 3b) ---
    // Resolve the player's chosen map (persisted in settings.mapKey by
    // BattleSetupScene). Falls back to DEFAULT_MAP_KEY when the key is
    // missing or unknown — never throws, so a corrupt save can't break
    // the battle. The map's bgKey + platformKey replace the previously
    // hardcoded "arena-bg" / "arena-platform" sprite keys below.
    const mapKey = settings.mapKey ?? DEFAULT_MAP_KEY;
    const map = getMapByKey(mapKey) ?? getMapByKey(DEFAULT_MAP_KEY)!;
    const bgKey = map.bgKey ?? "arena-bg";
    const platformKey = map.platformKey ?? "arena-platform";

    // --- Cosmic sky background (arena-bg.png) ---
    // Rendered at depth -100 so all gameplay objects sit on top.
    // Uses createBackground for consistency with the other scenes — the
    // component handles the missing-texture fallback automatically.
    createBackground(this as unknown as Phaser.Scene, { key: bgKey });

    // --- Levitating arena platform (arena-platform.png) ---
    // Drawn behind the arena boundary stroke so the neon platform edge is
    // visible underneath the white boundary line. Falls back to a
    // rectangle with the manifest's fallbackColor when the texture is missing.
    if (this.textures.exists(platformKey)) {
      this.add.image(arena.centerX, arena.centerY, platformKey)
        .setDisplaySize(arena.width, arena.height)
        .setDepth(-50);
    } else {
      this.add.rectangle(
        arena.centerX,
        arena.centerY,
        arena.width,
        arena.height,
        0x2a2d44,
      ).setDepth(-50);
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xf4f1de, 1);
    graphics.strokeRectShape(arena);

    // --- Resolve P1 cosmetics (color, headwear, etc.) from the profile ---
    // The profile is loaded from localStorage; equipped cosmetics live in
    // profile.cosmetics.equipped. resolveP1Cosmetics returns concrete
    // values (color hex, headwear sprite key, etc.) that we can pass to
    // createPlayer + the AnimatedSprite overlay system.
    const profile = loadProfile(storage);
    const p1Cosmetics = resolveP1Cosmetics(profile, battleConfig.player.color);

    const player = createPlayer(
      this,
      arena.left + 160,
      arena.centerY,
      battleConfig.player,
      p1Cosmetics.color,
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
    // Hide the physics rectangle — keep alpha at 0 so the physics body
    // still works but only the AnimatedSprite is visible.
    player.sprite.setAlpha(0);

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
              // P2 cosmetics: resolve from profile.cosmetics.p2Equipped.
              // Falls back to the orange bot color when no cosmetic is
              // equipped (the default for P2).
              resolveP2Cosmetics(profile, battleConfig.bot.color).color,
            ),
          }
        : {
            kind: "bot",
            bot: createBot(
              this,
              arena.right - 160,
              arena.centerY,
              // Fix B: pick per-difficulty bot stats so Hard has parity with
              // the player (260/84/560) instead of always being weaker.
              battleConfig.botByDifficulty[settings.botDifficulty] ??
                battleConfig.botByDifficulty.medium,
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
    opponentSprite.setAlpha(0);

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
    // --- Dodge key (Task 2ac) ---
    // Left-Shift triggers P1's dodge. The dodge is a 200ms i-frame dash at
    // 2x move speed, on a 1.5s cooldown. The actual dodge trigger lives in
    // update() (gated on JustDown + canDodge + a non-zero movement
    // direction); here we just register the key so Phaser starts tracking
    // its up/down state.
    const dodgeKeyP1 =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT) ??
      createDisabledKey();

    // --- Floating name labels (Task 3b) ---
    // Rendered above each actor and repositioned every frame in `update()`
    // so they track the actors as they move around the arena. Depth 10
    // keeps them on top of the arena graphics + animated sprites.
    // --- Build name labels with optional title cosmetic ---
    // applyTitleToLabel appends the title (e.g. "Rookie") below the
    // nickname when a title cosmetic is equipped. Falls back to just the
    // nickname when no title is equipped.
    const p1LabelText = applyTitleToLabel(
      nicknames.player,
      p1Cosmetics.title,
      (titleKey) => {
        try {
          return i18n.t(`cosmetic.title.${titleKey}` as never);
        } catch {
          return titleKey;
        }
      },
    );
    const playerNameLabel = this.add
      .text(player.sprite.x, player.sprite.y - 40, p1LabelText, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "16px",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Opponent label — only add title in 2P-local mode (bots don't equip).
    const oppLabelText =
      settings.mode === "2p-local" && opponent.kind === "player2"
        ? applyTitleToLabel(
            nicknames.opponent,
            resolveP2Cosmetics(profile, battleConfig.bot.color).title,
            (titleKey) => {
              try {
                return i18n.t(`cosmetic.title.${titleKey}` as never);
              } catch {
                return titleKey;
              }
            },
          )
        : nicknames.opponent;
    const opponentNameLabel = this.add
      .text(opponentSprite.x, opponentSprite.y - 40, oppLabelText, {
        color: "#f4f1de",
        fontFamily: "Arial",
        fontSize: "16px",
        align: "center",
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
      dodgeKeyP1,
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
      // Combo counter (Task 2ac). Positioned just below the score text so
      // it stays "near the score" per the spec without overlapping. Hidden
      // by default; updateHud toggles visibility based on comboStacks.
      comboText: this.add
        .text(arena.left, 56, "", {
          color: "#f4d35e",
          fontFamily: "Arial",
          fontSize: "20px",
        })
        .setVisible(false),
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
      lastPowerUpDespawnAt: 0,
      isPaused: false,
      battleStartAt: this.time.now,
      maxComboReached: 0,
      dodgesThisBattle: 0,
      ringOutsSufferedThisBattle: 0,
      p1CosmeticVisuals: null,
      opponentCosmeticVisuals: null,
      p1Cosmetics: null,
      opponentCosmetics: null,
    };

    // --- Create cosmetic visuals (headwear + trail + slapFx) ---
    // P1's visuals are always created (cosmetics may be empty → null).
    this.runtime.p1Cosmetics = p1Cosmetics;
    this.runtime.p1CosmeticVisuals = createCosmeticVisuals(this, p1Cosmetics);
    // Apply outline if equipped.
    if (p1Cosmetics.outline !== null) {
      applyOutline(this, player.sprite, p1Cosmetics.outline, battleConfig.player.size);
    }
    // Apply title to the P1 HUD label (set later in create() when the
    // label is built — we cache the resolved cosmetics here so the label
    // builder can read p1Cosmetics.title).

    // Opponent visuals — only in 2P-local mode (bots don't equip cosmetics).
    if (settings.mode === "2p-local" && opponent.kind === "player2") {
      const oppCosmetics = resolveP2Cosmetics(profile, battleConfig.bot.color);
      this.runtime.opponentCosmetics = oppCosmetics;
      this.runtime.opponentCosmeticVisuals = createCosmeticVisuals(this, oppCosmetics);
      if (oppCosmetics.outline !== null) {
        applyOutline(this, opponent.player.sprite, oppCosmetics.outline, battleConfig.player.size);
      }
    }

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
      // Task 2ac: applySlap now applies the attacker's combo multiplier to
      // the knockback (1.0 / 1.5 / 3.0 based on comboStacks), increments
      // comboStacks on a hit, resets the defender's comboStacks to 0, and
      // short-circuits if the defender is mid-dodge (i-frames). The combo
      // multiplier is computed INSIDE applySlap — no manual multiplication
      // needed here.
      const hit = applySlap(
        rt.player,
        this.opponentActor(),
        this.time.now,
      );
      if (hit) {
        rt.audio.playSlapHit();
        // Play P1's slap FX cosmetic at the defender's position.
        if (rt.p1CosmeticVisuals) {
          const defender = this.opponentActor();
          rt.p1CosmeticVisuals.playSlapFx(defender.sprite.x, defender.sprite.y);
        }
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
      // Task 2ac: same combo + dodge i-frame wiring as slapP1 — applySlap
      // handles the multiplier and combo bookkeeping internally.
      const hit = applySlap(
        rt.opponent.player,
        rt.player,
        this.time.now,
      );
      if (hit) {
        rt.audio.playSlapHit();
        // Play P2's slap FX cosmetic at the defender's (P1's) position.
        if (rt.opponentCosmeticVisuals) {
          rt.opponentCosmeticVisuals.playSlapFx(rt.player.sprite.x, rt.player.sprite.y);
        }
      } else {
        rt.audio.playSlapMiss();
      }
    };

    // Touch controls removed — the on-screen buttons (LEFT/UP/DOWN/RIGHT/
    // SLAP) were visually inconsistent with the game's neon style and
    // cluttered the bottom of the arena. Keyboard + click/tap on the
    // arena are sufficient for all platforms. If mobile support is needed
    // later, a proper touch joystick + slap button can be added as styled
    // sprites in a future iteration.
    const controlsY = arena.bottom + 82;

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
      (key: string) => this.runtime?.i18n?.t(key as never) ?? key,
      // Pass Phaser's this.time.now so the despawn timer uses the SAME
      // time-base as shouldDespawnPowerUp / isInDespawnWarning / shouldBlink
      // (which are called from update() with `now = this.time.now`).
      this.time.now,
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
        if (this.runtime) this.runtime.isPaused = false;
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

    // Esc toggles the pause overlay. We DON'T use scene.pause() because
    // it freezes the scene's input — making it impossible to resume via
    // Esc or click the pause menu buttons. Instead, we set a soft-pause
    // flag that update() checks. The scene keeps running (input + render
    // work), but all game logic is skipped while paused.
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.pauseMenu) {
        return;
      }
      if (this.runtime?.round.isComplete) {
        return;
      }
      if (this.pauseMenu.isVisible()) {
        this.pauseMenu.hide();
        if (this.runtime) this.runtime.isPaused = false;
      } else {
        this.pauseMenu.show();
        if (this.runtime) this.runtime.isPaused = true;
      }
    });

    // Clean up the pause menu + runtime when the scene shuts down.
    this.events.on("shutdown", () => {
      if (this.pauseMenu) {
        this.pauseMenu.destroy();
        this.pauseMenu = null;
      }
      // Destroy cosmetic visuals (headwear images, particle emitters)
      // so they don't leak into the next battle.
      if (this.runtime) {
        this.runtime.p1CosmeticVisuals?.destroy();
        this.runtime.opponentCosmeticVisuals?.destroy();
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

    // Soft-pause: skip ALL game logic while the pause menu is visible.
    // Input + render still work (so Esc + pause menu buttons are active).
    if (runtime.isPaused) {
      // Zero out velocities so actors don't drift during pause.
      runtime.player.body.setVelocity(0, 0);
      this.opponentActor().body.setVelocity(0, 0);
      return;
    }

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

        // --- End-of-battle pipeline (1P-vs-bot only) ---
        // Run the full ProfileService + ProgressionService +
        // AchievementService pipeline via the pure `processBattleEnd`
        // helper. Results are stashed in the registry so the ResultsScene
        // can render XP gained, level-ups, new unlocks, and achievement
        // notifications without re-deriving them.
        const outcome: "win" | "loss" | "draw" =
          runtime.round.winner === "player"
            ? "win"
            : runtime.round.winner === "bots"
              ? "loss"
              : "draw";
        const battleEndOutput = storage
          ? (() => {
              try {
                const profile = loadProfile(storage);
                const out = processBattleEnd({
                  profile,
                  result: {
                    mode: runtime.settings.mode,
                    outcome,
                    ringOutsInflicted: runtime.round.score.player,
                    ringOutsSuffered: runtime.round.score.bots,
                    powerUpsCollected: runtime.powerUpsCollected.player,
                    powerUpTypes: runtime.powerUpTypesCollected,
                    mapKey: runtime.settings.mapKey ?? DEFAULT_MAP_KEY,
                  },
                  ctx: {
                    outcome,
                    playerScore: runtime.round.score.player,
                    botScore: runtime.round.score.bots,
                    roundDurationMs: this.time.now - runtime.battleStartAt,
                    powerUpsCollectedThisBattle:
                      runtime.powerUpsCollected.player,
                    powerUpTypesThisBattle: runtime.powerUpTypesCollected,
                    maxComboReached: runtime.maxComboReached,
                    dodgesThisBattle: runtime.dodgesThisBattle,
                    ringOutsSufferedThisBattle:
                      runtime.ringOutsSufferedThisBattle,
                    mode: runtime.settings.mode,
                    mapKey: runtime.settings.mapKey ?? DEFAULT_MAP_KEY,
                  },
                });
                saveProfile(storage, out.updatedProfile);
                return out;
              } catch {
                // Profile recording is non-critical — don't crash the round-end flow.
                return null;
              }
            })()
          : null;

        // Stash the pipeline output in the registry for ResultsScene to
        // read. Always set the key (even when null) so ResultsScene can
        // distinguish "no data" from "scene re-entered".
        this.registry.set("lastBattleEnd", battleEndOutput);

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

        // Show interstitial ad before ResultsScene (Rule 4.4: ads at
        // logical pauses). Frequency-capped: no more than 1 ad per 2 min.
        // In local dev (no SDK), transitions immediately.
        YandexSDK.showFullscreenAd(() => {
          this.scene.start("ResultsScene");
        });
      }

      return;
    }

    // --- Player 1 movement + dodge (Task 2ac) ---
    // The dodge key (Shift) is checked BEFORE movement so a fresh dodge
    // burst stamps its i-frame window and sets the dodge velocity in the
    // same frame. During the 200ms dodge window we SKIP the moveActor call
    // (which would overwrite the dodge velocity with normal movement) and
    // also bypass the `isKnockedBack` gate (i-frames let the player move
    // through knockback). The dodge velocity is set ONCE at trigger time;
    // the body's `setDamping(true)` + `setDrag(0.05)` keep it essentially
    // constant for the 200ms window.
    const now = this.time.now;
    const playerDodging = isDodging(runtime.player, now);
    let dodgeTriggeredThisFrame = false;
    if (
      Phaser.Input.Keyboard.JustDown(runtime.dodgeKeyP1) &&
      canDodge(runtime.player, now)
    ) {
      const dir = getDirection(runtime);
      if (dir.lengthSq() > 0) {
        const dodgeStarted = startDodge(runtime.player, { x: dir.x, y: dir.y }, now);
        if (dodgeStarted) {
          dodgeTriggeredThisFrame = true;
          runtime.dodgesThisBattle += 1;
        }
        // Apply the dodge velocity immediately. The caller (not startDodge)
        // owns the physics write per the DodgeSystem contract.
        runtime.player.body.setVelocity(
          dir.x *
            runtime.player.moveSpeed *
            runtime.player.speedMultiplier *
            getDodgeSpeedMultiplier(),
          dir.y *
            runtime.player.moveSpeed *
            runtime.player.speedMultiplier *
            getDodgeSpeedMultiplier(),
        );
      }
    }
    if (playerDodging || dodgeTriggeredThisFrame) {
      // Mid-dodge or just triggered: leave the dodge velocity intact (don't
      // call moveActor). i-frames are active — applySlap will short-circuit
      // if the bot/P2 swings at us this frame.
    } else if (
      !isKnockedBack(runtime.player, now) &&
      !isFrozen(runtime.player, now)
    ) {
      moveActor(runtime.player, getDirection(runtime), now);
    }

    // --- Opponent logic ---
    // Freeze bot movement during the player's ring-out FX so the bot
    // doesn't chase the off-screen physics body (m3 fix).
    const opponentActor = this.opponentActor();
    const playerRingingOut = this.ringOutFxInProgress.player;
    if (runtime.opponent.kind === "bot") {
      if (
        !isKnockedBack(runtime.opponent.bot, this.time.now) &&
        !isFrozen(runtime.opponent.bot, this.time.now) &&
        !playerRingingOut
      ) {
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

    // --- Combo timeout tick (Task 2ac) ---
    // getComboMultiplier is a cheap read that also resets `comboStacks` to
    // 0 when the combo has timed out (>3000ms since the last successful
    // slap). Calling it every frame for both actors keeps the HUD combo
    // counter honest — without this tick a stale 5-stack would display
    // "Combo: x5" forever even after the player stopped slapping.
    // The call is a no-op for fresh actors (comboStacks === 0 short-
    // circuits the reset check).
    getComboMultiplier(runtime.player, this.time.now);
    getComboMultiplier(opponentActor, this.time.now);

    // --- Comeback mechanic (Rage buff) ---
    // If a side is losing by 3+ score, give that side +15% speed AND
    // +15% knockback. When the gap closes (< 3), the buff is REMOVED
    // — but only if no power-up boost is active (speedBoostUntil /
    // knockbackBoostUntil > now means a power-up owns the multiplier
    // and we must not touch it). This prevents the sticky-buff issue
    // where the 1.15x persisted indefinitely after the gap closed.
    const scoreGap = runtime.round.score.player - runtime.round.score.bots;
    const playerLosing = scoreGap <= -3;
    const opponentLosing = scoreGap >= 3;
    const playerHasBoost = runtime.player.speedBoostUntil > this.time.now;
    const opponentHasBoost = opponentActor.speedBoostUntil > this.time.now;

    if (playerLosing) {
      runtime.player.speedMultiplier = Math.max(runtime.player.speedMultiplier, 1.15);
      runtime.player.knockbackMultiplier = Math.max(runtime.player.knockbackMultiplier, 1.15);
    } else if (!playerHasBoost) {
      // Gap closed + no active boost → revert to baseline 1.0.
      runtime.player.speedMultiplier = 1;
      runtime.player.knockbackMultiplier = 1;
    }

    if (opponentLosing) {
      opponentActor.speedMultiplier = Math.max(opponentActor.speedMultiplier, 1.15);
      opponentActor.knockbackMultiplier = Math.max(opponentActor.knockbackMultiplier, 1.15);
    } else if (!opponentHasBoost) {
      opponentActor.speedMultiplier = 1;
      opponentActor.knockbackMultiplier = 1;
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
        runtime.lastPowerUpDespawnAt = now;
      }
    }

    if (!runtime.powerUp.active && now - runtime.lastPowerUpDespawnAt > 3000) {
      // `now` here is `this.time.now` (Phaser time) — pass it through so
      // spawnPowerUp stamps spawnedAt in the SAME time-base as the despawn
      // checks. Bugfix: previously spawnPowerUp stamped Date.now() internally,
      // which drifted relative to Phaser time when the tab was backgrounded.
      spawnPowerUp(this, runtime.powerUp, runtime.arena, battleConfig.powerUp.size, (key: string) => runtime.i18n?.t(key as never) ?? key, now);
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
      runtime.lastPowerUpDespawnAt = this.time.now;
    }

    if (tryCollectPowerUp(opponentActor, runtime.powerUp, this.time.now, runtime.player)) {
      runtime.powerUpsCollected.bots += 1;
      runtime.audio.playPowerUpCollect();
      runtime.lastPowerUpDespawnAt = this.time.now;
    }

    // --- Ring out ---
    // Points are awarded ONLY on ring-out: the actor that falls off concedes
    // a point to the opposite side. Slaps apply knockback but do not score
    // (see `applySlap`). `handleRingOut` registers the point + plays the
    // ring-out sound. The visual FX (camera shake + fall animation + flash)
    // is played via `playRingOutFX`, and `resetOffender` is deferred to the
    // FX's onComplete callback so the actor stays visible during the fall.
    if (
      isRingOut(runtime.player, runtime.arena, battleConfig.arena.ringOutMargin) &&
      !this.ringOutFxInProgress.player
    ) {
      const fxX = runtime.player.sprite.x;
      const fxY = runtime.player.sprite.y;
      handleRingOut(runtime, "player", runtime.settings.winningScore);
      runtime.ringOutsSufferedThisBattle += 1;
      this.ringOutFxInProgress.player = true;
      playRingOutFX({
        scene: this,
        x: fxX,
        y: fxY,
        animatedSprite: runtime.playerAnim,
        onComplete: () => {
          if (this.runtime) {
            resetOffender(this.runtime, "player");
            // Kill any in-flight tweens on the sprite BEFORE restoring
            // alpha/scale — otherwise the fall tween (alpha:0, scale:0.2)
            // can overwrite our restoration on the next frame if it
            // hasn't fully completed yet.
            this.tweens.killTweensOf(runtime.playerAnim.gameObject);
            const go = runtime.playerAnim.gameObject as unknown as {
              setAlpha: (a: number) => void;
              setScale: (x: number, y?: number) => void;
            };
            go.setAlpha(1);
            go.setScale(1);
            runtime.playerAnim.setState("idle");
            runtime.playerAnim.setPosition(
              this.runtime.player.sprite.x,
              this.runtime.player.sprite.y,
            );
          }
          this.ringOutFxInProgress.player = false;
        },
      });
    }
    if (
      isRingOut(opponentActor, runtime.arena, battleConfig.arena.ringOutMargin) &&
      !this.ringOutFxInProgress.opponent
    ) {
      const fxX = opponentActor.sprite.x;
      const fxY = opponentActor.sprite.y;
      handleRingOut(runtime, "opponent", runtime.settings.winningScore);
      this.ringOutFxInProgress.opponent = true;
      playRingOutFX({
        scene: this,
        x: fxX,
        y: fxY,
        animatedSprite: runtime.opponentAnim,
        onComplete: () => {
          if (this.runtime) {
            resetOffender(this.runtime, "opponent");
            const opp = this.opponentActor();
            this.tweens.killTweensOf(runtime.opponentAnim.gameObject);
            const go = runtime.opponentAnim.gameObject as unknown as {
              setAlpha: (a: number) => void;
              setScale: (x: number, y?: number) => void;
            };
            go.setAlpha(1);
            go.setScale(1);
            runtime.opponentAnim.setState("idle");
            runtime.opponentAnim.setPosition(
              opp.sprite.x,
              opp.sprite.y,
            );
          }
          this.ringOutFxInProgress.opponent = false;
        },
      });
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

    // --- Update cosmetic visuals (headwear position + trail emission) ---
    // Track each actor's position + velocity so headwear stays glued
    // to the actor's head and the trail emitter only emits while moving.
    if (runtime.p1CosmeticVisuals) {
      const vx = runtime.player.body.velocity.x;
      const vy = runtime.player.body.velocity.y;
      runtime.p1CosmeticVisuals.update(
        runtime.player.sprite.x,
        runtime.player.sprite.y,
        vx * vx + vy * vy,
      );
    }
    if (runtime.opponentCosmeticVisuals) {
      const opp = this.opponentActor();
      const vx = opp.body.velocity.x;
      const vy = opp.body.velocity.y;
      runtime.opponentCosmeticVisuals.update(
        opp.sprite.x,
        opp.sprite.y,
        vx * vx + vy * vy,
      );
    }

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

    // Player: skip position sync during ring-out FX so the FX tween
    // owns the sprite's position (camera shake + fall + drift).
    // State + tint are still updated so the "fall" texture shows.
    const playerState = getActorAnimationState(runtime.player, now);
    const playerTint = getActorEffectTint(runtime.player, now);
    runtime.playerAnim.setState(playerState);
    runtime.playerAnim.setEffectTint(playerTint);
    if (!this.ringOutFxInProgress.player) {
      runtime.playerAnim.setPosition(
        runtime.player.sprite.x,
        runtime.player.sprite.y,
      );
    }

    // Opponent: same pattern.
    const opponentActorState = this.opponentActor();
    const opponentState = getActorAnimationState(opponentActorState, now);
    const opponentTint = getActorEffectTint(opponentActorState, now);
    runtime.opponentAnim.setState(opponentState);
    runtime.opponentAnim.setEffectTint(opponentTint);
    if (!this.ringOutFxInProgress.opponent) {
      runtime.opponentAnim.setPosition(
        opponentActorState.sprite.x,
        opponentActorState.sprite.y,
      );
    }
  }
}
