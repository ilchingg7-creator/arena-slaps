# Yandex URL Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выбирать английский интерфейс при `?lang=en` до завершения инициализации Yandex SDK.

**Architecture:** `I18nService.detectLanguage()` читает `window.location.search` через `URLSearchParams` до проверки `window.__yaSdkLang` и `navigator.language`. Временной ручной выбор остаётся наивысшим приоритетом в `load()`.

**Tech Stack:** TypeScript, Vitest, Phaser 3.

## Global Constraints

- Приоритет: ручной выбор → URL `lang` → SDK → браузер → RU по умолчанию.
- Phaser продолжает запускаться без ожидания SDK.
- `localStorage` не определяет язык.
- Невалидный `lang` передаёт управление существующим резервным источникам.

---

### Task 1: Язык из URL игрового iframe

**Files:**
- Modify: `src/game/i18n/I18nService.test.ts`
- Modify: `src/game/i18n/I18nService.ts`

**Interfaces:**
- Consumes: `window.location.search`, `I18nService.load(storage)`.
- Produces: первоначальный `Language` с учётом Yandex-параметра `lang`.

- [ ] **Step 1: Write failing tests**

Добавить в `I18nService.test.ts`:

```ts
it("uses ?lang=en before Russian browser language", () => {
  vi.stubGlobal("window", { location: { search: "?debug-mode=16&lang=en" } });
  vi.stubGlobal("navigator", { language: "ru-RU" });
  expect(I18nService.load(null).getLanguage()).toBe("en");
});

it("uses ?lang=ru before English browser language", () => {
  vi.stubGlobal("window", { location: { search: "?lang=ru" } });
  vi.stubGlobal("navigator", { language: "en-US" });
  expect(I18nService.load(null).getLanguage()).toBe("ru");
});

it("keeps a manual page choice above the URL language", () => {
  vi.stubGlobal("window", {
    location: { search: "?lang=en" },
    __arenaSlapsSessionLanguage: "ru",
  });
  vi.stubGlobal("navigator", { language: "en-US" });
  expect(I18nService.load(null).getLanguage()).toBe("ru");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm.cmd test -- src/game/i18n/I18nService.test.ts`

Expected: тест `?lang=en` FAIL — возвращается `ru` из `navigator.language`.

- [ ] **Step 3: Implement URL detection**

В начале `detectLanguage()` до SDK добавить:

```ts
if (typeof window !== "undefined") {
  const urlLang = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
  if (urlLang) {
    if (["ru", "be", "uk", "kk", "uz"].includes(urlLang)) return "ru";
    if (urlLang === "en") return "en";
  }
}
```

Существующую проверку `window.__yaSdkLang` оставить следующей.

- [ ] **Step 4: Run verification**

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
git add -- docs/superpowers/plans/2026-07-11-yandex-url-language.md src/game/i18n/I18nService.test.ts src/game/i18n/I18nService.ts
git commit -m "fix: detect Yandex language from URL"
```
