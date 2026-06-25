/**
 * CloudSaveService — manages cloud saves via Yandex Player Data.
 *
 * On init, loads cloud data and merges with local (lastPlayedAt wins).
 * On saveProfile/saveSettings, schedules a debounced cloud write (3s).
 * The caller is responsible for writing to localStorage — this service
 * only handles the cloud part.
 *
 * In dev mode (SDK unavailable), all cloud operations are no-ops —
 * localStorage works as before.
 */

import type { Profile } from "../config/profile";
import type { GameSettings } from "../config/gameSettings";

const DEBOUNCE_MS = 3000;

type CloudGetData = (keys?: readonly string[]) => Promise<Record<string, unknown>>;
type CloudSetData = (data: Record<string, unknown>, flush?: boolean) => Promise<void>;

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

let initialized = false;
let cloudSetData: CloudSetData | null = null;
let pendingProfile: string | null = null;
let pendingSettings: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const CloudSaveService = {
  /**
   * Initialize: load cloud data, merge with local, write merged result
   * back to localStorage so scenes read the correct data.
   *
   * Merge strategy: compare `lastPlayedAt` timestamps. Newer wins.
   * If cloud has no data (first launch), local wins.
   * If cloud data is corrupt/unparseable, local wins.
   */
  async init(
    storage: StorageLike,
    cloudGet: CloudGetData,
    cloudSet: CloudSetData,
  ): Promise<void> {
    cloudSetData = cloudSet;

    let localWinsAfterMerge = false;

    try {
      const cloud = await cloudGet(["profile", "settings"]);

      // --- Merge profile ---
      // Bug 2 fix: safe-parse local profile in its own try/catch so a
      // corrupt localStorage doesn't kill the entire init.
      const localProfileRaw = storage.getItem?.("arena-slaps:profile") ?? null;
      let localProfile: Profile | null = null;
      if (localProfileRaw) {
        try {
          localProfile = JSON.parse(localProfileRaw) as Profile;
        } catch {
          console.warn("[CloudSave] Local profile is corrupt — will use cloud if available");
        }
      }

      const cloudProfileRaw = cloud.profile as string | undefined;

      if (cloudProfileRaw) {
        try {
          const cloudProfile = JSON.parse(cloudProfileRaw) as Profile;
          // Bug 1 fix: if local is null (new device) or cloud is newer,
          // load from cloud.
          if (
            !localProfile ||
            (typeof cloudProfile.lastPlayedAt === "number" &&
              cloudProfile.lastPlayedAt > (localProfile.lastPlayedAt ?? 0))
          ) {
            storage.setItem?.("arena-slaps:profile", cloudProfileRaw);
            console.log("[CloudSave] Cloud profile is newer or local is empty — loaded from cloud");
          } else {
            console.log("[CloudSave] Local profile is newer — keeping local");
            // Bug 9 fix: local is newer → schedule a cloud push so the
            // cloud gets updated with the latest local data.
            localWinsAfterMerge = true;
          }
        } catch {
          console.warn("[CloudSave] Cloud profile is corrupt — keeping local");
        }
      }

      // --- Merge settings ---
      const cloudSettingsRaw = cloud.settings as string | undefined;
      if (cloudSettingsRaw) {
        try {
          JSON.parse(cloudSettingsRaw); // validate
          storage.setItem?.("arena-slaps:settings", cloudSettingsRaw);
          console.log("[CloudSave] Loaded settings from cloud");
        } catch {
          console.warn("[CloudSave] Cloud settings corrupt — keeping local");
        }
      }
    } catch {
      console.warn("[CloudSave] Init failed — operating in local-only mode");
    }

    initialized = true;

    // Bug 9 fix: if local profile won the merge, push it to cloud now
    // so the cloud is up-to-date. Without this, the cloud only gets
    // updated on the next saveProfile call.
    if (localWinsAfterMerge) {
      const localRaw = storage.getItem?.("arena-slaps:profile");
      if (localRaw) {
        pendingProfile = localRaw;
        scheduleFlush();
      }
    }
  },

  /**
   * Schedule a debounced cloud write for the profile. The caller must
   * have already written to localStorage.
   */
  saveProfile(profile: Profile): void {
    if (!initialized || !cloudSetData) return;
    pendingProfile = JSON.stringify(profile);
    scheduleFlush();
  },

  /**
   * Schedule a debounced cloud write for settings. The caller must
   * have already written to localStorage.
   */
  saveSettings(settings: GameSettings): void {
    if (!initialized || !cloudSetData) return;
    pendingSettings = JSON.stringify(settings);
    scheduleFlush();
  },

  /**
   * Force-flush pending cloud writes immediately. Call on tab hide /
   * beforeunload / scene shutdown.
   */
  async flush(): Promise<void> {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await doFlush(true);
  },

  /** Reset to uninitialized state (for tests). */
  reset(): void {
    initialized = false;
    cloudSetData = null;
    pendingProfile = null;
    pendingSettings = null;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  },

  get isInitialized(): boolean {
    return initialized;
  },
};

function scheduleFlush(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void doFlush(false);
  }, DEBOUNCE_MS);
}

async function doFlush(forceFlush = false): Promise<void> {
  if (!cloudSetData) return;
  if (!pendingProfile && !pendingSettings) return;

  // Bug 3 fix: capture the data but DON'T clear pending until the
  // cloud write succeeds. If it fails, the data stays pending and
  // will be retried on the next flush or debounce tick.
  const data: Record<string, unknown> = {};
  if (pendingProfile) {
    data.profile = pendingProfile;
  }
  if (pendingSettings) {
    data.settings = pendingSettings;
  }

  try {
    await cloudSetData(data, forceFlush);
    // Success — clear pending.
    pendingProfile = null;
    pendingSettings = null;
    console.log("[CloudSave] Flushed to cloud");
  } catch {
    console.warn("[CloudSave] Flush failed — pending data retained for retry");
  }
}
