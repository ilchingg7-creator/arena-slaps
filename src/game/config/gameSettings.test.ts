import { describe, expect, it } from "vitest";
import {
  BOT_DIFFICULTY_OPTIONS,
  DEFAULT_SETTINGS,
  describeVolume,
  MODE_OPTIONS,
  ROUND_LENGTH_OPTIONS,
  WINNING_SCORE_OPTIONS,
  cycleOption,
  describeDifficulty,
  describeMode,
  loadSettings,
  saveSettings,
  type GameSettings,
} from "./gameSettings";

describe("gameSettings", () => {
  it("exposes sensible defaults", () => {
    expect(DEFAULT_SETTINGS.mode).toBe("1p-vs-bot");
    expect(DEFAULT_SETTINGS.botDifficulty).toBe("medium");
    expect(DEFAULT_SETTINGS.roundLengthSeconds).toBe(60);
    expect(DEFAULT_SETTINGS.winningScore).toBe(5);
    expect(DEFAULT_SETTINGS.mapKey).toBe("arena-default");
    expect(DEFAULT_SETTINGS.sfxMuted).toBe(false);
    expect(DEFAULT_SETTINGS.musicMuted).toBe(false);
    expect(DEFAULT_SETTINGS.sfxVolume).toBe(0.7);
    expect(DEFAULT_SETTINGS.musicVolume).toBe(0.5);
  });

  it("lists every option preset", () => {
    expect(MODE_OPTIONS).toEqual(["1p-vs-bot", "2p-local"]);
    expect(BOT_DIFFICULTY_OPTIONS).toEqual(["easy", "medium", "hard"]);
    expect([...ROUND_LENGTH_OPTIONS]).toEqual([30, 60, 90, 120]);
    expect([...WINNING_SCORE_OPTIONS]).toEqual([3, 5, 7, 10]);
  });

  it("returns defaults when storage is missing", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when storage has no entry", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        /* noop */
      },
    };
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when storage payload is corrupt", () => {
    const storage = {
      getItem: () => "not-json",
      setItem: () => {
        /* noop */
      },
    };
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial saved settings over defaults", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({ mode: "2p-local", winningScore: 7 }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadSettings(storage);
    expect(loaded.mode).toBe("2p-local");
    expect(loaded.winningScore).toBe(7);
    expect(loaded.botDifficulty).toBe(DEFAULT_SETTINGS.botDifficulty);
    expect(loaded.roundLengthSeconds).toBe(DEFAULT_SETTINGS.roundLengthSeconds);
    expect(loaded.mapKey).toBe(DEFAULT_SETTINGS.mapKey);
    expect(loaded.sfxMuted).toBe(DEFAULT_SETTINGS.sfxMuted);
    expect(loaded.musicMuted).toBe(DEFAULT_SETTINGS.musicMuted);
    expect(loaded.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
    expect(loaded.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
  });

  it("persists settings via setItem", () => {
    let captured = "";
    const storage = {
      getItem: () => null,
      setItem: (_key: string, value: string) => {
        captured = value;
      },
    };
    const next: GameSettings = {
      mode: "2p-local",
      botDifficulty: "hard",
      roundLengthSeconds: 90,
      winningScore: 10,
      mapKey: "arena-neon",
      sfxMuted: true,
      musicMuted: false,
      sfxVolume: 0.25,
      musicVolume: 0.5,
    };
    saveSettings(storage, next);
    expect(JSON.parse(captured)).toEqual(next);
  });

  it("cycles forward through options and wraps around", () => {
    expect(cycleOption(MODE_OPTIONS, "1p-vs-bot")).toBe("2p-local");
    expect(cycleOption(MODE_OPTIONS, "2p-local")).toBe("1p-vs-bot");
    expect(cycleOption(BOT_DIFFICULTY_OPTIONS, "easy")).toBe("medium");
    expect(cycleOption(BOT_DIFFICULTY_OPTIONS, "hard")).toBe("easy");
    expect(cycleOption(WINNING_SCORE_OPTIONS, 5)).toBe(7);
    expect(cycleOption(WINNING_SCORE_OPTIONS, 10)).toBe(3);
  });

  it("describes modes and difficulties for UI", () => {
    expect(describeMode("1p-vs-bot")).toBe("1P vs Bot");
    expect(describeMode("2p-local")).toBe("2P Local");
    expect(describeDifficulty("easy")).toBe("Easy");
    expect(describeDifficulty("medium")).toBe("Medium");
    expect(describeDifficulty("hard")).toBe("Hard");
  });

  it("describes volumes as a percentage", () => {
    expect(describeVolume(0)).toBe("0%");
    expect(describeVolume(0.25)).toBe("25%");
    expect(describeVolume(0.7)).toBe("70%");
    expect(describeVolume(1)).toBe("100%");
  });

  it("migrates legacy muted/masterVolume into sfxMuted/musicMuted/sfxVolume/musicVolume when only old fields are present", () => {
    const storage = {
      getItem: () => JSON.stringify({ muted: true, masterVolume: 0.5 }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadSettings(storage);
    expect(loaded.sfxMuted).toBe(true);
    expect(loaded.musicMuted).toBe(true);
    expect(loaded.sfxVolume).toBe(0.5);
    expect(loaded.musicVolume).toBe(0.5);
    // No legacy fields leak through.
    expect((loaded as unknown as Record<string, unknown>).muted).toBeUndefined();
    expect((loaded as unknown as Record<string, unknown>).masterVolume).toBeUndefined();
  });

  it("migrates legacy muted=false/masterVolume to unmuted + mapped volumes", () => {
    const storage = {
      getItem: () => JSON.stringify({ muted: false, masterVolume: 0.25 }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadSettings(storage);
    expect(loaded.sfxMuted).toBe(false);
    expect(loaded.musicMuted).toBe(false);
    expect(loaded.sfxVolume).toBe(0.25);
    expect(loaded.musicVolume).toBe(0.25);
  });

  it("prefers new fields over legacy when both are present", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          muted: true,
          masterVolume: 0.25,
          sfxMuted: false,
          musicMuted: true,
          sfxVolume: 0.7,
          musicVolume: 0.5,
        }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadSettings(storage);
    expect(loaded.sfxMuted).toBe(false);
    expect(loaded.musicMuted).toBe(true);
    expect(loaded.sfxVolume).toBe(0.7);
    expect(loaded.musicVolume).toBe(0.5);
  });

  it("does not crash or migrate when only new fields are present (no legacy keys)", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          sfxMuted: true,
          musicMuted: false,
          sfxVolume: 0.5,
          musicVolume: 0.25,
        }),
      setItem: () => {
        /* noop */
      },
    };
    const loaded = loadSettings(storage);
    expect(loaded.sfxMuted).toBe(true);
    expect(loaded.musicMuted).toBe(false);
    expect(loaded.sfxVolume).toBe(0.5);
    expect(loaded.musicVolume).toBe(0.25);
  });

  // --- Bug 9: validate mode + botDifficulty against option lists ---
  describe("Bug 9: settings migration validates mode + botDifficulty", () => {
    it("falls back to default mode when stored value is unknown (corrupt save)", () => {
      const storage = {
        getItem: () => JSON.stringify({ mode: "nonexistent-mode" }),
        setItem: () => {
          /* noop */
        },
      };
      const loaded = loadSettings(storage);
      // Unknown mode → fall back to DEFAULT_SETTINGS.mode ("1p-vs-bot").
      expect(loaded.mode).toBe("1p-vs-bot");
    });

    it("falls back to default botDifficulty when stored value is unknown", () => {
      const storage = {
        getItem: () => JSON.stringify({ botDifficulty: "god" }),
        setItem: () => {
          /* noop */
        },
      };
      const loaded = loadSettings(storage);
      // Unknown difficulty → fall back to DEFAULT_SETTINGS.botDifficulty.
      expect(loaded.botDifficulty).toBe("medium");
    });

    it("accepts a valid mode from the save", () => {
      const storage = {
        getItem: () => JSON.stringify({ mode: "2p-local" }),
        setItem: () => {
          /* noop */
        },
      };
      const loaded = loadSettings(storage);
      expect(loaded.mode).toBe("2p-local");
    });

    it("accepts a valid botDifficulty from the save", () => {
      const storage = {
        getItem: () => JSON.stringify({ botDifficulty: "hard" }),
        setItem: () => {
          /* noop */
        },
      };
      const loaded = loadSettings(storage);
      expect(loaded.botDifficulty).toBe("hard");
    });

    it("accepts all 3 valid botDifficulty values", () => {
      for (const diff of ["easy", "medium", "hard"] as const) {
        const storage = {
          getItem: () => JSON.stringify({ botDifficulty: diff }),
          setItem: () => {
            /* noop */
          },
        };
        const loaded = loadSettings(storage);
        expect(loaded.botDifficulty).toBe(diff);
      }
    });

    it("accepts all 2 valid mode values", () => {
      for (const mode of ["1p-vs-bot", "2p-local"] as const) {
        const storage = {
          getItem: () => JSON.stringify({ mode }),
          setItem: () => {
            /* noop */
          },
        };
        const loaded = loadSettings(storage);
        expect(loaded.mode).toBe(mode);
      }
    });
  });
});
