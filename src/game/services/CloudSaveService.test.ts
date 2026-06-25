import { describe, expect, it, vi, beforeEach } from "vitest";
import { CloudSaveService } from "./CloudSaveService";
import { DEFAULT_PROFILE } from "../config/profile";
import { DEFAULT_SETTINGS } from "../config/gameSettings";

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_PROFILE,
    powerUpStats: {},
    cosmetics: { owned: [], equipped: {}, p2Equipped: {} },
    ...overrides,
  };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe("CloudSaveService — init (merge strategy)", () => {
  beforeEach(() => {
    CloudSaveService.reset();
  });

  it("uses local data when cloud is empty (first launch on this device)", async () => {
    const storage = makeStorage();
    const localProfile = makeProfile({ level: 5, lastPlayedAt: 1000 });
    storage.setItem("arena-slaps:profile", JSON.stringify(localProfile));

    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:profile")!);
    expect(loaded.level).toBe(5); // local wins
  });

  it("uses cloud data when cloud is newer (played on another device)", async () => {
    const storage = makeStorage();
    const localProfile = makeProfile({ level: 3, lastPlayedAt: 1000 });
    storage.setItem("arena-slaps:profile", JSON.stringify(localProfile));

    const cloudProfile = makeProfile({ level: 7, lastPlayedAt: 5000 });
    const cloudGetData = vi.fn().mockResolvedValue({
      profile: JSON.stringify(cloudProfile),
    });
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:profile")!);
    expect(loaded.level).toBe(7); // cloud wins
    expect(loaded.lastPlayedAt).toBe(5000);
  });

  it("uses local data when local is newer (played offline)", async () => {
    const storage = makeStorage();
    const localProfile = makeProfile({ level: 10, lastPlayedAt: 9000 });
    storage.setItem("arena-slaps:profile", JSON.stringify(localProfile));

    const cloudProfile = makeProfile({ level: 5, lastPlayedAt: 3000 });
    const cloudGetData = vi.fn().mockResolvedValue({
      profile: JSON.stringify(cloudProfile),
    });
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:profile")!);
    expect(loaded.level).toBe(10); // local wins
  });

  it("merges settings from cloud when cloud has settings", async () => {
    const storage = makeStorage();
    const localSettings = makeSettings({ sfxVolume: 0.5 });
    storage.setItem("arena-slaps:settings", JSON.stringify(localSettings));

    const cloudSettings = makeSettings({ sfxVolume: 0.9 });
    const cloudGetData = vi.fn().mockResolvedValue({
      settings: JSON.stringify(cloudSettings),
    });
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:settings")!);
    expect(loaded.sfxVolume).toBe(0.9); // cloud wins
  });

  it("handles corrupt cloud data gracefully (falls back to local)", async () => {
    const storage = makeStorage();
    const localProfile = makeProfile({ level: 3 });
    storage.setItem("arena-slaps:profile", JSON.stringify(localProfile));

    const cloudGetData = vi.fn().mockResolvedValue({
      profile: "not valid json{{{",
    });
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:profile")!);
    expect(loaded.level).toBe(3); // local wins (cloud was corrupt)
  });

  it("does not crash when cloudGetData throws (network error)", async () => {
    const storage = makeStorage();
    const localProfile = makeProfile({ level: 3 });
    storage.setItem("arena-slaps:profile", JSON.stringify(localProfile));

    const cloudGetData = vi.fn().mockRejectedValue(new Error("network"));
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const loaded = JSON.parse(storage.getItem("arena-slaps:profile")!);
    expect(loaded.level).toBe(3); // local wins (cloud failed)
  });
});

describe("CloudSaveService — saveProfile / saveSettings (cloud only)", () => {
  beforeEach(() => {
    CloudSaveService.reset();
  });

  it("saveProfile triggers a debounced cloud write", async () => {
    vi.useFakeTimers();
    const storage = makeStorage();
    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const profile = makeProfile({ level: 5 });
    CloudSaveService.saveProfile(profile);

    // Cloud write should not happen immediately
    expect(cloudSetData).not.toHaveBeenCalled();

    // After 3 seconds debounce
    vi.advanceTimersByTime(3000);
    expect(cloudSetData).toHaveBeenCalledWith({
      profile: JSON.stringify(profile),
    });

    vi.useRealTimers();
  });

  it("multiple rapid saveProfile calls only trigger ONE cloud write", async () => {
    vi.useFakeTimers();
    const storage = makeStorage();
    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    CloudSaveService.saveProfile(makeProfile({ level: 1 }));
    CloudSaveService.saveProfile(makeProfile({ level: 2 }));
    CloudSaveService.saveProfile(makeProfile({ level: 3 }));

    vi.advanceTimersByTime(3000);

    expect(cloudSetData).toHaveBeenCalledTimes(1);
    const call = cloudSetData.mock.calls[0][0];
    expect(JSON.parse(call.profile).level).toBe(3); // last write wins

    vi.useRealTimers();
  });

  it("saveSettings triggers a debounced cloud write", async () => {
    vi.useFakeTimers();
    const storage = makeStorage();
    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    const settings = makeSettings({ sfxVolume: 0.8 });
    CloudSaveService.saveSettings(settings);

    vi.advanceTimersByTime(3000);
    expect(cloudSetData).toHaveBeenCalledWith({
      settings: JSON.stringify(settings),
    });

    vi.useRealTimers();
  });

  it("does not call cloudSetData when not initialized (dev mode)", () => {
    CloudSaveService.reset();
    CloudSaveService.saveProfile(makeProfile({ level: 5 }));
    // No crash, no cloud write
  });
});

describe("CloudSaveService — flush", () => {
  beforeEach(() => {
    CloudSaveService.reset();
  });

  it("flush forces pending cloud writes immediately", async () => {
    vi.useFakeTimers();
    const storage = makeStorage();
    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);

    CloudSaveService.saveProfile(makeProfile({ level: 5 }));
    // Don't wait for debounce — flush now
    await CloudSaveService.flush();

    expect(cloudSetData).toHaveBeenCalledWith({
      profile: expect.any(String),
    });

    vi.useRealTimers();
  });

  it("flush is a no-op when nothing is pending", async () => {
    const storage = makeStorage();
    const cloudGetData = vi.fn().mockResolvedValue({});
    const cloudSetData = vi.fn().mockResolvedValue(undefined);

    await CloudSaveService.init(storage, cloudGetData, cloudSetData);
    await CloudSaveService.flush();
    expect(cloudSetData).not.toHaveBeenCalled();
  });
});
