# Session Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вернуть переключение RU/EN внутри текущей страницы, сохранив приоритет языка браузера после полной перезагрузки.

**Architecture:** `I18nService.save()` сохраняет ручной выбор в непостоянном поле `window.__arenaSlapsSessionLanguage`. `I18nService.load()` использует это поле до определения языка SDK/браузера; при новой загрузке страницы поле отсутствует, поэтому браузер снова имеет приоритет.

**Tech Stack:** TypeScript, Vitest, Phaser 3.

## Global Constraints

- `localStorage` не определяет язык.
- Ручной выбор действует во всех Phaser-сценах текущей страницы.
- Полная перезагрузка страницы возвращает приоритет браузеру/Yandex SDK.
- Поддерживаются только `ru` и `en`.

---

### Task 1: Временный выбор языка текущей страницы

**Files:**
- Modify: `src/game/i18n/I18nService.test.ts`
- Modify: `src/game/i18n/I18nService.ts`

**Interfaces:**
- Consumes: `I18nService.load(storage)` и `service.save(storage)`.
- Produces: поле окна `__arenaSlapsSessionLanguage?: Language`, существующее только до полной перезагрузки.

- [ ] **Step 1: Write the failing tests**

Добавить в `I18nService.test.ts` проверки:

```ts
it("keeps a manual language choice across scene reloads in the same page", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { language: "ru-RU" });
  const { storage } = makeStorage({});
  const service = I18nService.load(storage);

  service.toggle();
  service.save(storage);

  expect(I18nService.load(storage).getLanguage()).toBe("en");
});

it("returns to browser language after the page-scoped choice is cleared", () => {
  const page = {} as { __arenaSlapsSessionLanguage?: string };
  vi.stubGlobal("window", page);
  vi.stubGlobal("navigator", { language: "ru-RU" });
  const { storage } = makeStorage({ "arena-slaps:language": "en" });
  const service = new I18nService("en");
  service.save(storage);
  delete page.__arenaSlapsSessionLanguage;

  expect(I18nService.load(storage).getLanguage()).toBe("ru");
});
```

Заменить два существующих теста `I18nService.save`, ожидающих запись в `localStorage`, на проверку поля `window.__arenaSlapsSessionLanguage` и отсутствия нового значения в объекте `data`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm.cmd test -- src/game/i18n/I18nService.test.ts`

Expected: первый тест FAIL — повторный `load()` возвращает `ru` вместо `en`.

- [ ] **Step 3: Implement the page-scoped override**

В `I18nService.ts` добавить тип окна:

```ts
type LanguageWindow = Window & {
  __arenaSlapsSessionLanguage?: Language;
};
```

В начале `load()` проверить поле:

```ts
if (typeof window !== "undefined") {
  const sessionLanguage = (window as LanguageWindow).__arenaSlapsSessionLanguage;
  if (sessionLanguage === "ru" || sessionLanguage === "en") {
    return new I18nService(sessionLanguage);
  }
}
```

В `save()` оставить аргумент `storage` для совместимости вызовов, но записывать выбор только в память страницы:

```ts
if (typeof window !== "undefined") {
  (window as LanguageWindow).__arenaSlapsSessionLanguage = this.language;
}
void storage;
```

Не использовать `storage.setItem` для выбора языка.

- [ ] **Step 4: Verify focused and complete suites**

Run:

```powershell
npm.cmd test -- src/game/i18n/I18nService.test.ts src/game/ui/LanguageToggle.test.ts
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: все тесты проходят, production-сборка завершается с кодом `0`, `git diff --check` не выводит ошибок.

- [ ] **Step 5: Commit**

```powershell
git add -- docs/superpowers/plans/2026-07-10-session-language-toggle.md src/game/i18n/I18nService.test.ts src/game/i18n/I18nService.ts
git commit -m "fix: preserve manual language during session"
```
