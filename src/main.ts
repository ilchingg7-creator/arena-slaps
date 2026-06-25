import "./styles.css";
import { createGame } from "./game/createGame";
import { YandexSDK } from "./game/yandex/SDK";
import { loadSettings } from "./game/config/gameSettings";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount point");
}

/**
 * Entry point.
 *
 * 1. Initialize the Yandex Games SDK (graceful fallback for local dev).
 * 2. Start the Phaser game.
 * 3. Wire up visibility-change handler to pause/resume audio (Rule 1.3).
 * 4. Call LoadingAPI.ready() when the preload is done (Rule 1.19.2).
 */
async function main(): Promise<void> {
  // 1. Initialize Yandex SDK
  await YandexSDK.init();

  // 2. Start the game
  const game = createGame(app as HTMLElement);

  // 3. Visibility change handler — stop all sound when the page is
  //    minimized/hidden, resume when it comes back (Rule 1.3).
  //    Phaser's built-in `pauseOnBlur` only pauses the game loop, not
  //    individual sounds — we need to explicitly stop audio.
  if (typeof document !== "undefined") {
    // Bug 10 fix: remember WHICH track was playing (not just a boolean)
    // so we can resume the correct one when the tab becomes visible
    // again. Previously the code always restarted menu theme, even if
    // the player was in a battle with battle theme playing.
    //
    // Issue 1 fix: previously getAudioService was called with
    // `game.scene.scenes[0] ?? app` — but scenes[0] can be undefined
    // when the tab is hidden early (before any scene finished booting),
    // and `app` is an HTMLElement, not a Phaser.Scene. This caused
    // getAudioService to crash silently or return a fresh instance
    // without stopping the music. Fix: read the shared AudioService
    // directly from game.registry (where getAudioService stores it)
    // instead of going through a scene. Fall back to no-op if it
    // hasn't been created yet.
    let previousMusicKey: string | null = null;
    document.addEventListener("visibilitychange", () => {
      // Read the shared AudioService from the game registry directly.
      // The registry key matches the one in getAudioService.ts.
      const audio = game.registry.get("audioService") as
        | { getCurrentMusicKey(): string | null; stopAll(): void; playMenuTheme(): void; playBattleTheme(): void; }
        | undefined;
      if (document.hidden) {
        // Page hidden — stop all audio, remember which track was playing.
        if (audio) {
          previousMusicKey = audio.getCurrentMusicKey();
          audio.stopAll();
        }
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
  }

  // 4. Call LoadingAPI.ready() after a short delay to let Phaser boot.
  //    The actual "game is playable" signal fires when PreloadScene
  //    transitions to MainMenuScene. We use a scene event to call ready()
  //    at the right moment.
  game.events.once("ready", () => {
    YandexSDK.ready();
  });
}

void main();
