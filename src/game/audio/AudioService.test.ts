import { describe, expect, it } from "vitest";
import { NoopAudioBackend, PhaserAudioBackend } from "./AudioBackend";
import { AudioService } from "./AudioService";

describe("AudioService", () => {
  it("preloadAll delegates load to the backend for every manifest entry", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.preloadAll();
    const loads = backend.calls.filter((c) => c.op === "load");
    // 21 entries = 19 SFX (2 canonical slap-hit/slap-miss + 6 slap-hit
    // variants + 3 slap-miss variants + 8 other SFX) + 2 music.
    expect(loads).toHaveLength(21);
  });

  it("preload delegates to the backend", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.preload("slap-hit");
    expect(backend.calls.some((c) => c.op === "load" && c.key === "slap-hit"))
      .toBe(true);
  });

  it("play does nothing when sfxMuted (SFX key)", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: true,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    expect(svc.playSlapHit()).toBe(false);
    expect(backend.calls.some((c) => c.op === "play")).toBe(false);
  });

  it("SFX mute does not block music playback", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: true,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    expect(svc.playMenuTheme()).toBe(true);
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.key).toBe("menu-theme");
  });

  it("music mute does not block SFX playback", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    expect(svc.playMenuTheme()).toBe(false);
    expect(svc.playSlapHit()).toBe(true);
    const calls = backend.calls.filter((c) => c.op === "play");
    expect(calls).toHaveLength(1);
    expect(calls[0].key).toBe("slap-hit");
  });

  it("play multiplies sfxVolume by per-sound volume", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.5,
      musicVolume: 0.5,
    });
    // slap-hit has per-sound volume 0.9 -> 0.5 * 0.9 = 0.45
    svc.playSlapHit();
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.volume).toBeCloseTo(0.45, 5);
  });

  it("play multiplies musicVolume by per-sound volume", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.3,
    });
    // menu-theme has per-sound volume 0.6 -> 0.3 * 0.6 = 0.18
    svc.playMenuTheme();
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.volume).toBeCloseTo(0.18, 5);
  });

  it("clamps final volume to [0, 1]", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 2,
      musicVolume: 2,
    });
    svc.playSlapHit();
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.volume).toBeLessThanOrEqual(1);
  });

  it("passes the loop flag for music tracks", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.playMenuTheme();
    svc.playBattleTheme();
    const musicCalls = backend.calls.filter((c) => c.op === "play");
    expect(musicCalls).toHaveLength(2);
    expect(musicCalls[0].loop).toBe(true);
    expect(musicCalls[1].loop).toBe(true);
  });

  it("does not pass the loop flag (defaults to false) for SFX", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.playSlapHit();
    svc.playMenuClick();
    const sfxCalls = backend.calls.filter((c) => c.op === "play");
    expect(sfxCalls).toHaveLength(2);
    expect(sfxCalls[0].loop).toBeFalsy();
    expect(sfxCalls[1].loop).toBeFalsy();
  });

  it("updateSettings with sfxMuted=true stops only SFX (not music)", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.updateSettings({
      sfxMuted: true,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    const stopCalls = backend.calls.filter((c) => c.op === "stop");
    // every stop key should be an sfx key. Allow any of the 19 SFX
    // keys (canonical + slap-hit variants + slap-miss variants +
    // other SFX).
    for (const c of stopCalls) {
      expect(c.key).toBeDefined();
      expect([
        "slap-hit",
        "slap-miss",
        "slap-hit-1",
        "slap-hit-2",
        "slap-hit-3",
        "slap-hit-4",
        "slap-hit-5",
        "slap-hit-6",
        "slap-miss-1",
        "slap-miss-2",
        "slap-miss-3",
        "powerup-collect",
        "ring-out",
        "round-win",
        "round-lose",
        "round-draw",
        "countdown-tick",
        "menu-click",
        "menu-start",
      ]).toContain(c.key);
    }
    // 19 SFX keys (was 10 before slap-hit/slap-miss variants).
    expect(stopCalls).toHaveLength(19);
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(false);
    expect(svc.isSfxMuted()).toBe(true);
    expect(svc.isMusicMuted()).toBe(false);
  });

  it("updateSettings with musicMuted=true stops only music (not SFX)", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.updateSettings({
      sfxMuted: false,
      musicMuted: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    const stopCalls = backend.calls.filter((c) => c.op === "stop");
    expect(stopCalls).toHaveLength(2);
    const keys = stopCalls.map((c) => c.key).sort();
    expect(keys).toEqual(["battle-theme", "menu-theme"]);
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(false);
    expect(svc.isSfxMuted()).toBe(false);
    expect(svc.isMusicMuted()).toBe(true);
  });

  it("updateSettings with both mutes true stops both categories", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.updateSettings({
      sfxMuted: true,
      musicMuted: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    const stopCalls = backend.calls.filter((c) => c.op === "stop");
    // 21 keys total = 19 SFX + 2 music (was 12 before slap-hit/slap-miss
    // variants were added).
    expect(stopCalls).toHaveLength(21);
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(false);
  });

  it("updateSettings without mute changes does not stop anything", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.updateSettings({
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.5,
      musicVolume: 0.25,
    });
    expect(backend.calls.some((c) => c.op === "stop" || c.op === "stopAll"))
      .toBe(false);
  });

  it("every high-level SFX helper plays the correct key", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 1,
      musicVolume: 1,
    });
    svc.playSlapHit();
    svc.playSlapMiss();
    svc.playPowerUpCollect();
    svc.playRingOut();
    svc.playRoundWin();
    svc.playRoundLose();
    svc.playRoundDraw();
    svc.playCountdownTick();
    svc.playMenuClick();
    svc.playMenuStart();

    const playedKeys = backend.calls
      .filter((c) => c.op === "play")
      .map((c) => c.key);
    expect(playedKeys).toEqual([
      "slap-hit",
      "slap-miss",
      "powerup-collect",
      "ring-out",
      "round-win",
      "round-lose",
      "round-draw",
      "countdown-tick",
      "menu-click",
      "menu-start",
    ]);
  });

  it("playMenuTheme and playBattleTheme play the correct keys", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 1,
      musicVolume: 1,
    });
    svc.playMenuTheme();
    svc.playBattleTheme();
    const playedKeys = backend.calls
      .filter((c) => c.op === "play")
      .map((c) => c.key);
    expect(playedKeys).toEqual(["menu-theme", "battle-theme"]);
  });

  it("stopMusic stops only music-category keys", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.stopMusic();
    const stopCalls = backend.calls.filter((c) => c.op === "stop");
    expect(stopCalls).toHaveLength(2);
    const keys = stopCalls.map((c) => c.key).sort();
    expect(keys).toEqual(["battle-theme", "menu-theme"]);
  });

  it("stopSfx stops only sfx-category keys", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });
    svc.stopSfx();
    const stopCalls = backend.calls.filter((c) => c.op === "stop");
    // 19 SFX keys (was 10 before slap-hit/slap-miss variants were
    // added).
    expect(stopCalls).toHaveLength(19);
    for (const c of stopCalls) {
      expect(c.key).not.toBe("menu-theme");
      expect(c.key).not.toBe("battle-theme");
    }
  });

  it("stopAll delegates to backend stopAll", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: false,
      musicMuted: false,
      sfxVolume: 1,
      musicVolume: 1,
    });
    svc.stopAll();
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(true);
  });

  it("exposes per-category mute and volume getters", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      sfxMuted: true,
      musicMuted: false,
      sfxVolume: 0.42,
      musicVolume: 0.31,
    });
    expect(svc.isSfxMuted()).toBe(true);
    expect(svc.isMusicMuted()).toBe(false);
    expect(svc.getSfxVolume()).toBe(0.42);
    expect(svc.getMusicVolume()).toBe(0.31);
  });
});

describe("NoopAudioBackend", () => {
  it("tracks load calls and reports isLoaded accurately", () => {
    const b = new NoopAudioBackend();
    expect(b.isLoaded("slap-hit")).toBe(false);
    b.load("slap-hit");
    expect(b.isLoaded("slap-hit")).toBe(true);
  });

  it("clamps negative volumes on play", () => {
    const b = new NoopAudioBackend();
    b.play("slap-hit", -1);
    expect(b.calls.find((c) => c.op === "play")?.volume).toBe(0);
  });

  it("clamps volumes > 1 on play", () => {
    const b = new NoopAudioBackend();
    b.play("slap-hit", 5);
    expect(b.calls.find((c) => c.op === "play")?.volume).toBe(1);
  });

  it("records the loop flag on play when provided", () => {
    const b = new NoopAudioBackend();
    b.play("menu-theme", 0.5, true);
    b.play("slap-hit", 0.5);
    b.play("battle-theme", 0.5, false);
    const calls = b.calls.filter((c) => c.op === "play");
    expect(calls[0].loop).toBe(true);
    expect(calls[1].loop).toBe(false);
    expect(calls[2].loop).toBe(false);
  });

  it("records stop calls keyed by sound", () => {
    const b = new NoopAudioBackend();
    b.stop("menu-theme");
    b.stop("slap-hit");
    const stops = b.calls.filter((c) => c.op === "stop");
    expect(stops).toHaveLength(2);
    expect(stops[0].key).toBe("menu-theme");
    expect(stops[1].key).toBe("slap-hit");
  });
});

describe("PhaserAudioBackend", () => {
  it("delegates load to scene.load.audio with the manifest path", () => {
    const loads: Array<{ key: string; urls: string }> = [];
    const scene = {
      load: {
        audio: (key: string, urls: string | string[]) => {
          if (Array.isArray(urls)) {
            loads.push({ key, urls: urls[0] });
          } else {
            loads.push({ key, urls });
          }
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.load("slap-hit");
    expect(loads).toEqual([{ key: "slap-hit", urls: "./sounds/slap-hit.ogg" }]);
  });

  it("does not re-load the same key twice", () => {
    const loads: Array<{ key: string; urls: string }> = [];
    const scene = {
      load: {
        audio: (key: string, urls: string | string[]) => {
          loads.push({ key, urls: Array.isArray(urls) ? urls[0] : urls });
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.load("slap-hit");
    b.load("slap-hit");
    expect(loads).toHaveLength(1);
  });

  it("plays via scene.sound.play with the given volume", () => {
    const plays: Array<{ key: string; volume: number; loop?: boolean }> = [];
    const scene = {
      sound: {
        play: (
          key: string,
          config?: { volume?: number; loop?: boolean },
        ) => {
          plays.push({
            key,
            volume: config?.volume ?? 1,
            loop: config?.loop,
          });
          return true;
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.play("slap-hit", 0.42);
    expect(plays).toEqual([{ key: "slap-hit", volume: 0.42, loop: undefined }]);
  });

  it("passes loop:true to scene.sound.play when requested", () => {
    const plays: Array<{ key: string; volume: number; loop?: boolean }> = [];
    const scene = {
      sound: {
        play: (
          key: string,
          config?: { volume?: number; loop?: boolean },
        ) => {
          plays.push({
            key,
            volume: config?.volume ?? 1,
            loop: config?.loop,
          });
          return true;
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.play("menu-theme", 0.5, true);
    expect(plays).toEqual([{ key: "menu-theme", volume: 0.5, loop: true }]);
  });

  it("clamps volume on play", () => {
    const plays: Array<{ key: string; volume: number }> = [];
    const scene = {
      sound: {
        play: (key: string, config?: { volume?: number }) => {
          plays.push({ key, volume: config?.volume ?? 1 });
          return true;
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.play("slap-hit", 5);
    expect(plays[0].volume).toBe(1);
    b.play("slap-hit", -1);
    expect(plays[1].volume).toBe(0);
  });

  it("stopAll delegates to scene.sound.stopAll when present", () => {
    let stopped = false;
    const scene = {
      sound: { play: () => true, stopAll: () => { stopped = true; } },
    };
    const b = new PhaserAudioBackend(scene);
    b.stopAll();
    expect(stopped).toBe(true);
  });

  it("stopAll destroys tracked BaseSound instances to avoid leaks (MINOR-5)", () => {
    // The SoundManager's stopAll() only stops playback — it leaves the
    // BaseSound instances in its internal list. Repeated play/stop cycles
    // would otherwise accumulate dangling BaseSounds. stopAll() must call
    // `destroy()` on each tracked sound to release them.
    const stopCalls: string[] = [];
    const destroyCalls: string[] = [];
    const sounds: Record<string, { stop: () => void; destroy: () => void; play: () => boolean }> = {};
    const scene = {
      sound: {
        play: () => true,
        stopAll: () => { /* noop */ },
        add: (key: string) => {
          const sound = {
            stop: () => { stopCalls.push(key); },
            destroy: () => { destroyCalls.push(key); },
            play: () => true,
          };
          sounds[key] = sound;
          return sound;
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.play("menu-theme", 0.5, true);
    b.play("slap-hit", 0.7);
    b.stopAll();
    expect(stopCalls).toEqual(expect.arrayContaining(["menu-theme", "slap-hit"]));
    expect(destroyCalls).toEqual(expect.arrayContaining(["menu-theme", "slap-hit"]));
    // Each tracked sound is stopped + destroyed exactly once.
    expect(stopCalls).toHaveLength(2);
    expect(destroyCalls).toHaveLength(2);
  });

  it("stop(key) delegates to the BaseSound.stop of the looked-up sound", () => {
    const stoppedKeys: string[] = [];
    const scene = {
      sound: {
        play: () => true,
        get: (key: string) => ({
          stop: () => {
            stoppedKeys.push(key);
          },
        }),
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.stop("menu-theme");
    b.stop("slap-hit");
    expect(stoppedKeys).toEqual(["menu-theme", "slap-hit"]);
  });

  it("stop(key) is a no-op when scene.sound.get returns nothing", () => {
    const scene = {
      sound: {
        play: () => true,
        get: () => null,
      },
    };
    const b = new PhaserAudioBackend(scene);
    expect(() => b.stop("menu-theme")).not.toThrow();
  });
});
