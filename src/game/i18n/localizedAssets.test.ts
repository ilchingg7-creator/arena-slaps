import { describe, expect, it } from "vitest";
import { localizedAssetKey } from "./localizedAssets";

describe("localizedAssetKey", () => {
  it("uses the Russian sprite variant for Russian", () => {
    expect(localizedAssetKey("menu-bg", "ru")).toBe("menu-bg-ru");
    expect(localizedAssetKey("logo", "ru")).toBe("logo-ru");
  });

  it("keeps the default sprite for English", () => {
    expect(localizedAssetKey("menu-bg", "en")).toBe("menu-bg");
    expect(localizedAssetKey("logo", "en")).toBe("logo");
  });
});
