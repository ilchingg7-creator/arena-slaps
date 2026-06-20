import { describe, expect, it } from "vitest";
import { NoopAudioBackend, PhaserAudioBackend } from "./AudioBackend";
import { AudioService } from "./AudioService";

describe("AudioService", () => {
  it("preloadAll delegates load to the backend for every manifest entry", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 0.7,
    });
    svc.preloadAll();
    const loads = backend.calls.filter((c) => c.op === "load");
    expect(loads).toHaveLength(10);
  });

  it("preload delegates to the backend", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 0.7,
    });
    svc.preload("slap-hit");
    expect(backend.calls.some((c) => c.op === "load" && c.key === "slap-hit"))
      .toBe(true);
  });

  it("play does nothing when muted", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: true,
      masterVolume: 0.7,
    });
    expect(svc.playSlapHit()).toBe(false);
    expect(backend.calls.some((c) => c.op === "play")).toBe(false);
  });

  it("play multiplies master volume by per-sound volume", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 0.5,
    });
    // slap-hit has per-sound volume 0.9 -> 0.5 * 0.9 = 0.45
    svc.playSlapHit();
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.volume).toBeCloseTo(0.45, 5);
  });

  it("clamps final volume to [0, 1]", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 2,
    });
    svc.playSlapHit();
    const call = backend.calls.find((c) => c.op === "play");
    expect(call?.volume).toBeLessThanOrEqual(1);
  });

  it("updateSettings with muted=true calls stopAll on the backend", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 0.5,
    });
    svc.updateSettings({ muted: true, masterVolume: 0.5 });
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(true);
    expect(svc.isMuted()).toBe(true);
  });

  it("updateSettings with muted=false does not stopAll", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: true,
      masterVolume: 0.5,
    });
    svc.updateSettings({ muted: false, masterVolume: 0.5 });
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(false);
    expect(svc.isMuted()).toBe(false);
  });

  it("every high-level helper plays the correct key", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 1,
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

  it("stopAll delegates to backend", () => {
    const backend = new NoopAudioBackend();
    const svc = new AudioService(backend, {
      muted: false,
      masterVolume: 1,
    });
    svc.stopAll();
    expect(backend.calls.some((c) => c.op === "stopAll")).toBe(true);
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
    expect(loads).toEqual([{ key: "slap-hit", urls: "/sounds/slap-hit.ogg" }]);
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
    const plays: Array<{ key: string; volume: number }> = [];
    const scene = {
      sound: {
        play: (key: string, config?: { volume?: number }) => {
          plays.push({ key, volume: config?.volume ?? 1 });
        },
      },
    };
    const b = new PhaserAudioBackend(scene);
    b.play("slap-hit", 0.42);
    expect(plays).toEqual([{ key: "slap-hit", volume: 0.42 }]);
  });

  it("clamps volume on play", () => {
    const plays: Array<{ key: string; volume: number }> = [];
    const scene = {
      sound: {
        play: (key: string, config?: { volume?: number }) => {
          plays.push({ key, volume: config?.volume ?? 1 });
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
    const scene = { sound: { play: () => void 0, stopAll: () => { stopped = true; } } };
    const b = new PhaserAudioBackend(scene);
    b.stopAll();
    expect(stopped).toBe(true);
  });
});
