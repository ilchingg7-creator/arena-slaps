import "./styles.css";
import { createGame } from "./game/createGame";
import { YandexSDK } from "./game/yandex/SDK";
import { loadSettings } from "./game/config/gameSettings";
import { CloudSaveService } from "./game/services/CloudSaveService";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount point");
}

/**
 * Entry point.
 *
 * 1. Initialize the Yandex Games SDK (graceful fallback for local dev).
 * 2. Initialize CloudSaveService (load + merge cloud data with local).
 * 3. Start the Phaser game.
 * 4. Wire up visibility-change handler to pause/resume audio + flush saves.
 * 5. Call LoadingAPI.ready() when the preload is done (Rule 1.19.2).
 */
async function main(): Promise<void> {
  // 1. Initialize Yandex SDK
  await YandexSDK.init();

  // 2. Initialize CloudSaveService (if SDK is available)
  const storage = typeof window !== "undefined" ? window.localStorage : null;
  if (storage && YandexSDK.isAvailable()) {
    await CloudSaveService.init(
      storage,
      (keys) => YandexSDK.playerGetData(keys),
      (data) => YandexSDK.playerSetData(data),
    );
  }

  // 3. Start the game
  const game = createGame(app as HTMLElement);

  // 4. Visibility change handler — stop all sound when the page is
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

  // 5. Call LoadingAPI.ready() after a short delay to let Phaser boot.
  game.events.once("ready", () => {
    YandexSDK.ready();
  });
}

void main();
