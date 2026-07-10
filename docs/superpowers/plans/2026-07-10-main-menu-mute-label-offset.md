# Main Menu Mute Label Offset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять текст общей кнопки звука во всех меню на 4 px без изменения рамки и зоны клика.

**Architecture:** `createTopRightMuteButton` использует `textOffsetY = -4` по умолчанию и применяет его только к координате текстовой подписи. Все сцены получают одинаковое смещение через общий компонент; явный параметр остаётся доступен для переопределения.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

## Global Constraints

- Смещение текста во всех сценах: ровно `-4` px.
- Рамка и область клика остаются на прежнем месте.
- Все сцены используют общую координату текста `y = 16` при стандартном отступе `20`.
- Смещение одинаково для RU/EN и состояний «Звук»/«Заглушено».

---

### Task 1: Настраиваемое вертикальное смещение подписи

**Files:**
- Modify: `src/game/ui/TopRightMuteButton.test.ts`
- Modify: `src/game/ui/TopRightMuteButton.ts`
- Modify: `src/game/scenes/MainMenuScene.ts`

**Interfaces:**
- Consumes: `createTopRightMuteButton(scene, state, onChange, options?: MuteButtonOptions)`.
- Produces: необязательное поле `textOffsetY?: number` в четвёртом аргументе; отсутствие поля эквивалентно `0`.

- [ ] **Step 1: Write the failing test**

Добавить в `TopRightMuteButton.test.ts`:

```ts
it("applies an optional vertical offset only to the text label", () => {
  const scene = makeScene(1280);
  createTopRightMuteButton(scene, { sfxMuted: true, musicMuted: true }, () => {});

  expect(scene.texts[0].y).toBe(16);
  expect(drawNeonPanelMock).toHaveBeenCalledWith(scene, 1106, 12, 148, 42);
});
```

В существующем тесте положения заменить ожидание стандартной координаты с `20` на `16`. Добавить отдельную проверку `{ textOffsetY: 0 }`, которая ожидает `y = 20`, чтобы подтвердить возможность явного переопределения.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/game/ui/TopRightMuteButton.test.ts`

Expected: FAIL — координата текста остаётся `20`, либо TypeScript сообщает об отсутствующем `textOffsetY`.

- [ ] **Step 3: Write minimal implementation**

В типе четвёртого аргумента `createTopRightMuteButton` добавить:

```ts
textOffsetY?: number;
```

Получить значение по умолчанию и применить только к тексту:

```ts
const textOffsetY = options?.textOffsetY ?? -4;

const button = scene.add.text(
  width - margin,
  margin + textOffsetY,
  isMasterMuted(state) ? mutedLabel : soundLabel,
  textStyle,
);
```

В `MainMenuScene.ts` удалить частную настройку, оставив локализованные подписи:

```ts
{
  soundLabel: i18n.t("mute.sound"),
  mutedLabel: i18n.t("mute.muted"),
}
```

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
npm.cmd test -- src/game/ui/TopRightMuteButton.test.ts
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: тест компонента проходит, весь набор тестов проходит, production-сборка завершается с кодом `0`, `git diff --check` не сообщает ошибок.

- [ ] **Step 5: Commit**

```powershell
git add -- src/game/ui/TopRightMuteButton.test.ts src/game/ui/TopRightMuteButton.ts src/game/scenes/MainMenuScene.ts
git commit -m "fix: raise main menu mute label"
```
