# Desktop Canvas Input Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent browser text selection and the default context menu during desktop interaction with the game canvas.

**Architecture:** A Phaser top-level config flag installs a `contextmenu` handler on the canvas only. CSS explicitly prevents selection and WebKit touch-callout behavior on the canvas; it does not add global JavaScript handlers.

**Tech Stack:** TypeScript, Phaser 3.90, Vitest, CSS, Vite 5.

## Global Constraints

- Set only `disableContextMenu: true` in Phaser config; do not add global context-menu listeners.
- Preserve the existing Canvas renderer, gameplay inputs, and mobile behavior.
- Apply selection prevention only to `canvas`.

---

### Task 1: Protect the desktop game canvas

**Files:**
- Modify: `src/game/gameConfig.ts:13-36`
- Modify: `src/game/createGame.test.ts:44-66`
- Modify: `src/styles.css:22-25`

**Interfaces:**
- Consumes: Phaser's `GameConfig.disableContextMenu` boolean.
- Produces: `gameConfig.disableContextMenu === true` and a non-selectable canvas.

- [ ] **Step 1: Write the failing configuration test**

In `src/game/createGame.test.ts`, add this test after the scale-mode test:

```ts
it("disables the browser context menu on the game canvas", () => {
  expect(gameConfig.disableContextMenu).toBe(true);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- src/game/createGame.test.ts`

Expected: FAIL because `gameConfig.disableContextMenu` is `undefined`.

- [ ] **Step 3: Add the minimal Phaser and CSS protection**

Add this property directly after `backgroundColor` in `src/game/gameConfig.ts`:

```ts
disableContextMenu: true,
```

Replace the `canvas` rule in `src/styles.css` with:

```css
canvas {
  display: block;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd test -- src/game/createGame.test.ts`

Expected: PASS with four passing `gameConfig` tests.

- [ ] **Step 5: Run complete verification**

Run: `npm.cmd test; npm.cmd run typecheck; npm.cmd run build`

Expected: test suite and production build pass. If type checking reports pre-existing errors outside these files, record their paths and do not modify them in this task.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/game/gameConfig.ts src/game/createGame.test.ts src/styles.css
git commit -m "fix: prevent desktop canvas context menu"
```

## Self-review

- Spec coverage: Task 1 covers the Phaser context-menu configuration, canvas selection protection, and regression test.
- Placeholder scan: no incomplete instructions remain.
- Type consistency: the test imports the existing `gameConfig` object, whose `disableContextMenu` property is added in the same task.
