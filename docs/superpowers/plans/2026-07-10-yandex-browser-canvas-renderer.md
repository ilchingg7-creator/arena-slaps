# Yandex Browser Canvas Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the game rendered after repeated Yandex Browser reloads by avoiding its unstable WebGL framebuffer path.

**Architecture:** `createGame` will explicitly request Phaser's Canvas renderer instead of letting `Phaser.AUTO` select WebGL. The existing game UI and cosmetic-outline implementation are Canvas-compatible. The package manifest will expose the preview command required by the Yandex audit manifest.

**Tech Stack:** TypeScript, Phaser 3.90, Vite 5, Vitest.

## Global Constraints

- Use `Phaser.CANVAS`; do not add a WebGL recovery or restart path.
- Preserve responsive scale settings and all gameplay behavior.
- Do not change asset URLs or sprite manifests.
- The preview command must be `vite preview` and must work through `npm.cmd run preview` on Windows.

---

### Task 1: Force the Canvas renderer and restore audit preview support

**Files:**
- Modify: `src/game/createGame.ts:4-10`
- Modify: `src/game/createGame.test.ts:7-27, 38-51`
- Modify: `package.json:5-13`

**Interfaces:**
- Consumes: `Phaser.CANVAS`, the Phaser renderer type constant.
- Produces: `createGame(mount: HTMLElement): Phaser.Game` whose `Phaser.Game` constructor receives `type: Phaser.CANVAS`.

- [ ] **Step 1: Write the failing renderer test**

In `src/game/createGame.test.ts`, add `const gameConfigs: unknown[] = [];` before `vi.mock`. Extend the Phaser mock with `CANVAS: 1` and this constructor:

```ts
class Game {
  constructor(config: unknown) {
    gameConfigs.push(config);
  }
}
```

Expose `Game` on the mock's default export, import `createGame` from `./createGame`, then add this test after the scale-mode test:

```ts
it("uses Canvas to avoid unstable WebGL framebuffers in Yandex Browser", () => {
  createGame({} as HTMLElement);

  expect(gameConfigs).toHaveLength(1);
  expect(gameConfigs[0]).toMatchObject({ type: Phaser.CANVAS });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- src/game/createGame.test.ts`

Expected: FAIL because `createGame` passes `Phaser.AUTO`, not `Phaser.CANVAS`, to the `Phaser.Game` constructor.

- [ ] **Step 3: Configure Phaser with Canvas and add preview support**

Replace `src/game/createGame.ts` with:

```ts
import Phaser from "phaser";
import { gameConfig } from "./gameConfig";

export function createGame(mount: HTMLElement) {
  return new Phaser.Game({
    ...gameConfig,
    // Yandex Browser can leave WebGL framebuffers incomplete after repeated
    // reloads. Canvas has no framebuffer allocation and is fully supported
    // by this game's render path.
    type: Phaser.CANVAS,
    parent: mount,
  });
}
```

In `package.json`, add the following script directly after `"dev": "vite",`:

```json
"preview": "vite preview",
```

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd test -- src/game/createGame.test.ts`

Expected: PASS with three passing `gameConfig` tests.

- [ ] **Step 5: Run complete verification**

Run: `npm.cmd test; npm.cmd run typecheck; npm.cmd run build; npm.cmd run preview -- --host 127.0.0.1`

Expected: tests, type check, and production build pass; preview prints a local URL and stays running until stopped.

- [ ] **Step 6: Commit the implementation**

```bash
git add package.json src/game/createGame.ts src/game/createGame.test.ts
git commit -m "fix: use Canvas renderer in Yandex Browser"
```

## Self-review

- Spec coverage: Task 1 covers Canvas rendering, the focused regression test, and the declared audit preview command.
- Placeholder scan: no incomplete tasks or unspecified code remain.
- Type consistency: the test captures the config passed to `Phaser.Game`, which is exactly where `createGame` selects the renderer.
