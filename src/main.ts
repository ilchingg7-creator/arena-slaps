import "./styles.css";
import { createGame } from "./game/createGame";
import { YandexSDK } from "./game/yandex/SDK";
import { loadSettings } from "./game/config/gameSettings";
import { CloudSaveService } from "./game/services/CloudSaveService";
import { IAPService } from "./game/services/IAPService";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount point");
}

/**
 * Entry point.
 *
 * Yandex Games white-screen fix (2026-06-26): previously we did
 * `await YandexSDK.init()` BEFORE creating the Phaser game. On the
 * Yandex platform, if `YaGames.init()` is slow, fails, or hangs, the
 * Phaser game never starts → LoadingAPI.ready() never fires → the
 * Yandex loader never hides → infinite white screen.
 *
 * New flow:
 *   1. Start Yandex SDK init in the BACKGROUND (non-blocking).
 *   2. Create the Phaser game immediately so the player sees the
 *      loading screen right away.
 *   3. Once BOTH the game AND the SDK are ready, fire LoadingAPI.ready()
 *      to dismiss the Yandex loader. Promise.all gates this — if SDK
 *      init fails, we still attempt ready() with sdk=null (no-op) but
 *      at least the Phaser game is running and visible.
 *   4. After SDK init succeeds, set up CloudSaveService + IAPService.
 *   5. Visibility handler pauses audio + flushes saves on hide.
 */
async function main(): Promise<void> {
  // 1. Start Yandex SDK init in the BACKGROUND (non-blocking).
  const sdkPromise = YandexSDK.init();

  // 2. Create the game immediately — don't wait for the SDK.
  const game = createGame(app as HTMLElement);

  // 3. Visibility change handler — stop all sound when the page is
  //    minimized/hidden, resume when it comes back (Rule 1.3).
  //    Also flush cloud saves on hide.
  if (typeof document !== "undefined") {
    let previousMusicKey: string | null = null;
    document.addEventListener("visibilitychange", () => {
      const audio = game.registry.get("audioService") as
        | { getCurrentMusicKey(): string | null; stopAll(): void; playMenuTheme(): void; playBattleTheme(): void; }
        | undefined;
      if (document.hidden) {
        // Page hidden — stop all audio, remember which track was playing.
        if (audio) {
          previousMusicKey = audio.getCurrentMusicKey();
          audio.stopAll();
        }
        // Flush pending cloud saves before the tab is hidden.
        void CloudSaveService.flush();
      } else {
        // Page visible again — resume the SAME track that was playing.
        if (previousMusicKey && audio) {
          const keyToRestore = previousMusicKey;
          previousMusicKey = null;
          const storage = typeof window !== "undefined" ? window.localStorage : null;
          const settings = loadSettings(storage);
          if (!settings.musicMuted) {
            if (keyToRestore === "menu-theme") {
              audio.playMenuTheme();
            } else if (keyToRestore === "battle-theme") {
              audio.playBattleTheme();
            }
          }
        }
      }
    });

    // Flush cloud saves on beforeunload (page close / refresh).
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        void CloudSaveService.flush();
      });
    }
  }

  // 4. Fire LoadingAPI.ready() when BOTH the game AND the SDK are ready.
  //    The Yandex platform requires this signal to hide its loader.
  //    Without it, the player sees an infinite white screen.
  //    We use Promise.race between the SDK init and a 5s timeout — if
  //    YaGames.init() hangs, we still fire ready() (this.sdk will be
  //    null → ready() is a no-op, but the Phaser game is already
  //    visible and playable). The player gets SDK features when/if the
  //    init eventually resolves later.
  const sdkReadyWithTimeout = Promise.race([
    sdkPromise.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 5000)),
  ]);
  Promise.all([
    new Promise<void>((resolve) => {
      game.events.once("ready", () => resolve());
    }),
    sdkReadyWithTimeout,
  ])
    .then(() => {
      YandexSDK.ready();
    })
    .catch((err) => {
      console.warn("[main] SDK init failed; calling LoadingAPI.ready() anyway:", err);
      // Even on failure, attempt the ready() call. this.sdk may be null
      // (init threw before setting it), so ready() is a no-op — but at
      // least we don't leave the player stuck on white forever. If the
      // game itself booted, the player can still play without SDK
      // features (no ads, no cloud saves, no IAP).
      YandexSDK.ready();
    });

  // 5. After SDK init succeeds, set up CloudSaveService + IAPService
  //    (non-blocking — the game is already running at this point).
  sdkPromise
    .then(async () => {
      if (!YandexSDK.isAvailable()) return;
      const storage =
        typeof window !== "undefined" ? window.localStorage : null;
      if (!storage) return;

      await CloudSaveService.init(
        storage,
        (keys) => YandexSDK.playerGetData(keys),
        (data, flush) => YandexSDK.playerSetData(data, flush),
      );

      // Restore IAP purchases — must happen AFTER CloudSaveService.init
      // so the profile is already merged from cloud. Purchased cosmetics
      // are added to profile.cosmetics.owned.
      const profile = (await import("./game/config/profile")).loadProfile(
        storage,
      );
      const { saveProfile } = await import("./game/config/profile");
      await IAPService.init(
        profile,
        (p) => saveProfile(storage, p),
        () => YandexSDK.iapGetPurchases(),
      );
    })
    .catch((err) => {
      console.warn("[main] Yandex SDK post-init failed:", err);
    });
}

void main();
