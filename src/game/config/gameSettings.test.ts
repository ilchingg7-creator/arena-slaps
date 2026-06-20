import { describe, expect, it } from "vitest";
import {
  BOT_DIFFICULTY_OPTIONS,
  DEFAULT_SETTINGS,
  describeVolume,
  MASTER_VOLUME_OPTIONS,
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
    expect(DEFAULT_SETTINGS.muted).toBe(false);
    expect(DEFAULT_SETTINGS.masterVolume).toBe(0.7);
  });

  it("lists every option preset", () => {
    expect(MODE_OPTIONS).toEqual(["1p-vs-bot", "2p-local"]);
    expect(BOT_DIFFICULTY_OPTIONS).toEqual(["easy", "medium", "hard"]);
    expect([...ROUND_LENGTH_OPTIONS]).toEqual([30, 60, 90, 120]);
    expect([...WINNING_SCORE_OPTIONS]).toEqual([3, 5, 7, 10]);
    expect([...MASTER_VOLUME_OPTIONS]).toEqual([0, 0.25, 0.5, 0.7, 1]);
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
    expect(loaded.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(loaded.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
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
      muted: true,
      masterVolume: 0.25,
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
    expect(cycleOption(MASTER_VOLUME_OPTIONS, 0.7)).toBe(1);
    expect(cycleOption(MASTER_VOLUME_OPTIONS, 1)).toBe(0);
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
});
