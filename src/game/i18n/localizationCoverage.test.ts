import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { I18nService } from "./I18nService";

const source = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("localization coverage", () => {
  it("provides Russian and English text for dynamic UI messages", () => {
    const ru = new I18nService("ru");
    const en = new I18nService("en");

    expect(ru.t("common.save" as never)).toBe("Сохранить");
    expect(en.t("common.save" as never)).toBe("Save");
    expect(ru.t("common.cancel" as never)).toBe("Отмена");
    expect(en.t("common.cancel" as never)).toBe("Cancel");
    expect(ru.t("battle.combo" as never)).toBe("Комбо");
    expect(en.t("battle.combo" as never)).toBe("Combo");
    expect(ru.t("shop.items" as never)).toBe("предметов");
    expect(en.t("shop.items" as never)).toBe("items");
    expect(ru.t("common.secondsShort" as never)).toBe("с");
    expect(en.t("common.secondsShort" as never)).toBe("s");
  });

  it("does not bypass i18n in the previously untranslated scenes", () => {
    expect(source("../scenes/ProfileScene.ts")).not.toMatch(/textContent = "(?:Save|Cancel)"/);
    const battleScene = source("../scenes/BattleScene.ts");
    expect(battleScene).not.toContain("`Combo: x${");
    expect(battleScene).not.toContain('resolveNicknames(settings.mode, "Player")');
    expect(source("../scenes/BattleSetupScene.ts")).not.toContain('setText("Load failed');
    expect(source("../scenes/PreloadScene.ts")).not.toContain("timeout — continuing");
    expect(source("../scenes/ShopScene.ts")).not.toContain("} предметов`");
  });

  it("uses the localized Russian game title", () => {
    expect(new I18nService("ru").t("mainmenu.title")).toBe("Арена шлепков");
    expect(new I18nService("en").t("mainmenu.title")).toBe("Arena Slaps");
  });
});
