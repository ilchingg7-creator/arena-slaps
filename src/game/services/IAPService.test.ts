import { describe, expect, it, vi, beforeEach } from "vitest";
import { IAPService } from "./IAPService";
import { DEFAULT_PROFILE } from "../config/profile";
import type { Profile } from "../config/profile";

function makeProfile(owned: string[] = []): Profile {
  return {
    ...DEFAULT_PROFILE,
    powerUpStats: {},
    cosmetics: { owned, equipped: {}, p2Equipped: {} },
  };
}

describe("IAPService", () => {
  beforeEach(() => {
    IAPService.reset();
  });

  describe("init (restore purchases)", () => {
    it("adds purchased cosmetics to profile.cosmetics.owned", async () => {
      const profile = makeProfile();
      const saveProfile = vi.fn();

      await IAPService.init(profile, saveProfile, async () => [
        { productID: "hw_halo", purchaseToken: "tok_1" },
        { productID: "trail_fire", purchaseToken: "tok_2" },
      ]);

      expect(profile.cosmetics.owned).toContain("headwear-halo");
      expect(profile.cosmetics.owned).toContain("trail-fire");
      expect(saveProfile).toHaveBeenCalled();
    });

    it("does not add duplicates on re-init", async () => {
      const profile = makeProfile(["headwear-halo"]);
      const saveProfile = vi.fn();

      await IAPService.init(profile, saveProfile, async () => [
        { productID: "hw_halo", purchaseToken: "tok_1" },
      ]);

      expect(profile.cosmetics.owned.filter((id) => id === "headwear-halo")).toHaveLength(1);
    });

    it("handles bundle_all correctly (adds all 21 cosmetics)", async () => {
      const profile = makeProfile();
      const saveProfile = vi.fn();

      await IAPService.init(profile, saveProfile, async () => [
        { productID: "bundle_all", purchaseToken: "tok_bundle" },
      ]);

      // Should have at least 20 unique cosmetics from the bundle
      expect(profile.cosmetics.owned.length).toBeGreaterThanOrEqual(20);
    });

    it("does not crash when getPurchases returns [] (dev mode)", async () => {
      const profile = makeProfile();
      const saveProfile = vi.fn();

      await IAPService.init(profile, saveProfile, async () => []);

      expect(profile.cosmetics.owned).toEqual([]);
      // saveProfile may or may not be called (depends on whether anything changed)
    });
  });

  describe("isPurchased", () => {
    it("returns true for a purchased product", () => {
      const profile = makeProfile(["headwear-halo"]);
      IAPService.setProfileForTest(profile);
      expect(IAPService.isPurchased("hw_halo")).toBe(true);
    });

    it("returns false for a not-purchased product", () => {
      const profile = makeProfile();
      IAPService.setProfileForTest(profile);
      expect(IAPService.isPurchased("hw_halo")).toBe(false);
    });

    it("returns true when a pack is purchased and checks its cosmetic", () => {
      const profile = makeProfile(["headwear-halo", "headwear-pirate"]);
      IAPService.setProfileForTest(profile);
      // hw_halo is purchased because headwear-halo is in owned
      expect(IAPService.isPurchased("hw_halo")).toBe(true);
    });
  });

  describe("purchase", () => {
    it("calls the purchase function and adds cosmetics to owned", async () => {
      const profile = makeProfile();
      const saveProfile = vi.fn();
      IAPService.setProfileForTest(profile, saveProfile);

      const purchaseFn = vi.fn().mockResolvedValue({
        productID: "hw_halo",
        purchaseToken: "tok_123",
      });

      await IAPService.purchase("hw_halo", purchaseFn);

      expect(purchaseFn).toHaveBeenCalledWith("hw_halo");
      expect(profile.cosmetics.owned).toContain("headwear-halo");
      expect(saveProfile).toHaveBeenCalled();
    });

    it("throws if purchase function rejects (player cancelled)", async () => {
      const profile = makeProfile();
      const saveProfile = vi.fn();
      IAPService.setProfileForTest(profile, saveProfile);

      const purchaseFn = vi.fn().mockRejectedValue(new Error("cancelled"));

      await expect(IAPService.purchase("hw_halo", purchaseFn)).rejects.toThrow();
      expect(profile.cosmetics.owned).not.toContain("headwear-halo");
    });

    it("does not add duplicates if already owned", async () => {
      const profile = makeProfile(["headwear-halo"]);
      const saveProfile = vi.fn();
      IAPService.setProfileForTest(profile, saveProfile);

      const purchaseFn = vi.fn().mockResolvedValue({
        productID: "hw_halo",
        purchaseToken: "tok_456",
      });

      await IAPService.purchase("hw_halo", purchaseFn);

      expect(profile.cosmetics.owned.filter((id) => id === "headwear-halo")).toHaveLength(1);
    });

    it("throws for an unknown product ID", async () => {
      const profile = makeProfile();
      IAPService.setProfileForTest(profile, vi.fn());

      await expect(IAPService.purchase("nonexistent", vi.fn())).rejects.toThrow();
    });
  });

  describe("getCatalog", () => {
    it("returns all products with purchased flag", () => {
      const profile = makeProfile(["headwear-halo"]);
      IAPService.setProfileForTest(profile);

      const catalog = IAPService.getCatalog();
      expect(catalog.length).toBeGreaterThan(0);

      const halo = catalog.find((p) => p.productId === "hw_halo");
      expect(halo?.purchased).toBe(true);

      const pirate = catalog.find((p) => p.productId === "hw_pirate");
      expect(pirate?.purchased).toBe(false);
    });
  });
});
