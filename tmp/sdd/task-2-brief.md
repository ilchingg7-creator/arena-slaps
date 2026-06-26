## Task 2: Restyle Shared UI Primitives And Overlay Components

**Files:**
- Create: `src/game/ui/neonPrimitives.ts`
- Modify: `src/game/ui/Background.ts`
- Modify: `src/game/ui/TopRightMuteButton.ts`
- Modify: `src/game/ui/VolumeSlider.ts`
- Modify: `src/game/ui/PauseMenu.ts`
- Test: `src/game/ui/Background.test.ts`
- Test: `src/game/ui/TopRightMuteButton.test.ts`
- Test: `src/game/ui/VolumeSlider.test.ts`
- Test: `src/game/ui/PauseMenu.test.ts`

**Interfaces:**
- Consumes: `NEON_COLORS`, `NEON_PANEL`, `getHudTextStyle()` from Task 1
- Produces: `drawNeonPanel(scene, x, y, width, height)`, existing `createBackground()`, `createTopRightMuteButton()`, `createVolumeSlider()`, and `createPauseMenu()` contracts with unchanged signatures

- [ ] **Step 1: Write the failing primitive/overlay tests**

```ts
import { describe, expect, it } from "vitest";
import { createBackground } from "./Background";

describe("Background neon overlays", () => {
  it("keeps the original background contract while adding overlay layers", () => {
    const scene = makeBackgroundSceneStub({ hasTexture: true });
    const bg = createBackground(scene as never, { key: "menu-bg" });
    expect(bg.gameObject).toBeDefined();
    expect(scene.add.graphics).toHaveBeenCalled();
  });
});
```

```ts
import { createPauseMenu } from "./PauseMenu";

it("still toggles pause settings visibility while rendering a framed overlay", () => {
  const menu = createPauseMenu(scene as never, config);
  menu.show();
  expect(scene.add.rectangle).toHaveBeenCalled();
  expect(scene.add.graphics).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`

Expected: FAIL because current helpers do not create the new panel/overlay graphics asserted by the updated tests.

- [ ] **Step 3: Add neon primitives and refactor the shared helpers to use them**

```ts
// src/game/ui/neonPrimitives.ts
import { NEON_COLORS, NEON_PANEL } from "./neonTheme";

export function drawNeonPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
  const g = scene.add.graphics();
  g.fillStyle(NEON_COLORS.bgPanel, 0.92);
  g.fillRoundedRect(x, y, width, height, NEON_PANEL.radius);
  g.lineStyle(6, NEON_COLORS.cyan, 0.14);
  g.strokeRoundedRect(x, y, width, height, NEON_PANEL.radius);
  g.lineStyle(NEON_PANEL.borderWidth, NEON_COLORS.cyan, 1);
  g.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, NEON_PANEL.radius - 2);
  return g;
}
```

```ts
// src/game/ui/Background.ts (make excerpt)
import { NEON_COLORS } from "./neonTheme";

if (scene.textures.exists(key)) {
  const img = scene.add.image(centerX, centerY, key);
  img.setDisplaySize(width, height);
  img.setDepth(BG_DEPTH);
  const overlay = scene.add.graphics().setDepth(BG_DEPTH + 1);
  overlay.fillStyle(NEON_COLORS.bgInk, 0.30);
  overlay.fillRect(0, 0, width, height);
  overlay.lineStyle(2, NEON_COLORS.cyan, 0.10);
  overlay.strokeRect(24, 24, width - 48, height - 48);
  return img as unknown as Phaser.GameObjects.GameObject;
}
```

```ts
// src/game/ui/VolumeSlider.ts (style excerpt)
track.fillStyle(0x151b2b, 1);
track.lineStyle(2, 0x20f6ff, 0.9);
fill.fillStyle(0xb7ff3c, 1);
handle.fillStyle(0xf6fbff, 1);
handle.lineStyle(2, 0x20f6ff, 1);
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`

Expected: PASS with helper behavior unchanged and new graphics/panel assertions satisfied.

- [ ] **Step 5: Commit**

```bash
git add src/game/ui/neonPrimitives.ts src/game/ui/Background.ts src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.ts src/game/ui/PauseMenu.test.ts
git commit -m "feat: restyle shared neon ui primitives"
```

