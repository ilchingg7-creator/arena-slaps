# Modern Neon Arcade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Arena Slaps into a unified Cyber Fight Club visual style without changing battle logic, progression, achievements, or asset-loading architecture.

**Architecture:** Introduce one shared neon design system first, then migrate reusable UI primitives and scene chrome to that system before refreshing scene-specific art and battle overlays. Keep all bitmap replacements wired through the existing sprite manifest and existing map/power-up config contracts so scene behavior and preload flow stay stable.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, manifest-driven assets under `src/game/assets` and `public/sprites`

## Global Constraints

- Scope: Visual/UI/art-only redesign. No gameplay logic, combat rules, progression, achievements, or economy changes.
- The redesign must unify all scenes under one visual language.
- The redesign must preserve TypeScript, Vite, Phaser 3 compatibility and existing behavior.
- All new assets must continue to flow through the existing manifest-driven asset pipeline.
- Must preserve existing tests and pass `npm run build`.
- Must preserve existing tests and pass `npm run test`.
- Must not change gameplay rules.
- Must not change combat system behavior.
- Must not change progression calculations.
- Must not change achievements logic.
- Must not change profile/state persistence semantics.

---

## File Structure

Planned file responsibilities before implementation:

- Create: `src/game/ui/neonTheme.ts`
  - Shared visual tokens: colors, typography presets, panel radii, border widths, glow/shadow helpers, HUD constants.
- Create: `src/game/ui/neonPrimitives.ts`
  - Reusable panel/backplate/divider helpers for scenes and overlays.
- Create: `src/game/ui/neonTheme.test.ts`
  - Token regression coverage for exported palette and style helpers.
- Modify: `src/game/ui/StyledButton.ts`
  - Rebuild button chrome and states on top of shared tokens.
- Modify: `src/game/ui/Background.ts`
  - Add reusable overlay/decor-layer support while preserving existing `createBackground()` contract.
- Modify: `src/game/ui/TopRightMuteButton.ts`
  - Restyle mute control to match new chrome.
- Modify: `src/game/ui/VolumeSlider.ts`
  - Restyle slider track/handle/fill to match neon system without changing dragging behavior.
- Modify: `src/game/ui/PauseMenu.ts`
  - Replace dimmer-only look with system overlay panel while preserving callbacks and persistence behavior.
- Modify: `src/game/ui/*.test.ts`
  - Update visual helper tests to assert the new shared-style behavior.
- Modify: `src/game/scenes/MainMenuScene.ts`
  - New menu composition, new logo placement, updated button layout.
- Modify: `src/game/scenes/BattleScene.ts`
  - New arena presentation, HUD chrome, power-up framing, hit/ring-out polish layers.
- Modify: `src/game/scenes/ProfileScene.ts`
  - Replace row-by-row text presentation with neon panel layout.
- Modify: `src/game/scenes/ProgressionScene.ts`
  - Replace raw text ladder look with unified panel/HUD styling.
- Modify: `src/game/scenes/AchievementsScene.ts`
  - Replace emoji-grid look with neon achievement card grid.
- Modify: `src/game/scenes/ResultsScene.ts`
  - Replace simple summary screen with post-match broadcast panel.
- Modify: `src/game/scenes/AudioSettingsScene.ts`
  - Restyle sliders, mute toggles, and rows around the shared panel system.
- Modify: `src/game/scenes/ProgressScene.ts`
  - Bring combined levels/achievements scene into the shared style.
- Modify: `src/game/scenes/BattleSetupScene.ts`
  - Align setup screen row controls and map picker with the new UI system.
- Modify: `src/game/scenes/CosmeticsScene.ts`
  - Align tabs, cells, preview, and back button with the same design language.
- Modify: `src/game/scenes/ShopScene.ts`
  - Align tabs, item cards, price buttons, and pack tooltips with the same design language.
- Modify: `src/game/assets/spriteManifest.ts`
  - Keep keys stable, update fallback colors if needed, register any truly new UI sprite keys.
- Modify: `src/game/assets/spriteManifest.test.ts`
  - Cover any new UI sprite registrations.
- Modify: `public/sprites/*.png`
  - Replace menu, logo, arena, platform, power-up, and UI icon bitmap assets in-place where semantics match.
- Optional create: `public/sprites/neon-*.png`
  - Only if a new visual role cannot safely reuse an existing semantic key.

## Task 1: Establish The Shared Neon Theme Layer

**Files:**
- Create: `src/game/ui/neonTheme.ts`
- Create: `src/game/ui/neonTheme.test.ts`
- Modify: `src/game/ui/StyledButton.ts`
- Test: `src/game/ui/neonTheme.test.ts`
- Test: `src/game/ui/StyledButton.test.ts`

**Interfaces:**
- Consumes: existing `createStyledButton(scene, config): StyledButton`
- Produces: `NEON_COLORS`, `NEON_PANEL`, `getNeonButtonVariant(variant)`, `getHudTextStyle(kind)` from `src/game/ui/neonTheme.ts`

- [ ] **Step 1: Write the failing token/style tests**

```ts
import { describe, expect, it } from "vitest";
import {
  NEON_COLORS,
  NEON_PANEL,
  getNeonButtonVariant,
  getHudTextStyle,
} from "./neonTheme";

describe("neonTheme", () => {
  it("exports the Cyber Fight Club accent colors", () => {
    expect(NEON_COLORS.bgInk).toBe(0x090b12);
    expect(NEON_COLORS.cyan).toBe(0x20f6ff);
    expect(NEON_COLORS.lime).toBe(0xb7ff3c);
    expect(NEON_COLORS.magenta).toBe(0xff4fd8);
    expect(NEON_COLORS.impact).toBe(0xff5a36);
  });

  it("maps primary buttons to dark chrome plus neon borders", () => {
    expect(getNeonButtonVariant("primary")).toMatchObject({
      body: 0x101522,
      edge: 0x20f6ff,
      glow: 0x20f6ff,
      text: 0xf6fbff,
    });
  });

  it("exports a compact HUD style with readable stroke", () => {
    expect(getHudTextStyle("score")).toMatchObject({
      fontFamily: "Arial",
      fontStyle: "bold",
      strokeThickness: 4,
    });
    expect(NEON_PANEL.radius).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- src/game/ui/neonTheme.test.ts src/game/ui/StyledButton.test.ts`

Expected: FAIL with `Cannot find module './neonTheme'` and/or outdated button color assertions.

- [ ] **Step 3: Add the shared theme module and route StyledButton through it**

```ts
// src/game/ui/neonTheme.ts
import type { ButtonVariant } from "./StyledButton";

export const NEON_COLORS = {
  bgInk: 0x090b12,
  bgPanel: 0x101522,
  bgPanelAlt: 0x151b2b,
  cyan: 0x20f6ff,
  lime: 0xb7ff3c,
  magenta: 0xff4fd8,
  impact: 0xff5a36,
  text: 0xf6fbff,
  textMuted: 0x92a0bb,
} as const;

export const NEON_PANEL = {
  radius: 12,
  borderWidth: 2,
  glowAlpha: 0.18,
} as const;

export function getNeonButtonVariant(variant: ButtonVariant) {
  const common = { body: NEON_COLORS.bgPanel, text: NEON_COLORS.text };
  switch (variant) {
    case "primary":
      return { ...common, edge: NEON_COLORS.cyan, glow: NEON_COLORS.cyan };
    case "success":
      return { ...common, edge: NEON_COLORS.lime, glow: NEON_COLORS.lime };
    case "danger":
      return { ...common, edge: NEON_COLORS.impact, glow: NEON_COLORS.impact };
    case "warning":
      return { ...common, edge: NEON_COLORS.magenta, glow: NEON_COLORS.magenta };
    default:
      return { ...common, edge: 0x6f7a94, glow: 0x6f7a94 };
  }
}

export function getHudTextStyle(kind: "score" | "timer" | "title") {
  return {
    color: "#f6fbff",
    fontFamily: "Arial",
    fontSize: kind === "title" ? "42px" : "24px",
    fontStyle: "bold",
    stroke: "#05070d",
    strokeThickness: kind === "title" ? 5 : 4,
    shadow: { offsetX: 0, offsetY: 0, color: "#20f6ff", blur: 10, fill: false },
  };
}
```

```ts
// src/game/ui/StyledButton.ts (render excerpt)
import { NEON_PANEL, getNeonButtonVariant } from "./neonTheme";

function render(currentVariant: ButtonVariant): void {
  const colors = getNeonButtonVariant(currentVariant);
  graphics.clear();
  graphics.fillStyle(colors.body, 1);
  graphics.fillRoundedRect(-halfW, -halfH, bounds.width, bounds.height, NEON_PANEL.radius);
  graphics.lineStyle(6, colors.glow, NEON_PANEL.glowAlpha);
  graphics.strokeRoundedRect(-halfW, -halfH, bounds.width, bounds.height, NEON_PANEL.radius);
  graphics.lineStyle(NEON_PANEL.borderWidth, colors.edge, 1);
  graphics.strokeRoundedRect(-halfW + 3, -halfH + 3, bounds.width - 6, bounds.height - 6, NEON_PANEL.radius - 2);
}
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/game/ui/neonTheme.test.ts src/game/ui/StyledButton.test.ts`

Expected: PASS with the new token module covered and StyledButton tests updated to the shared palette.

- [ ] **Step 5: Commit**

```bash
git add src/game/ui/neonTheme.ts src/game/ui/neonTheme.test.ts src/game/ui/StyledButton.ts src/game/ui/StyledButton.test.ts
git commit -m "feat: add neon theme tokens and button chrome"
```

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

## Task 3: Refresh Manifest-Driven Assets And Their Registration

**Files:**
- Modify: `public/sprites/menu-bg.png`
- Modify: `public/sprites/logo.png`
- Modify: `public/sprites/arena-bg*.png`
- Modify: `public/sprites/arena-platform*.png`
- Modify: `public/sprites/powerup-*.png`
- Modify: `public/sprites/mute-*.png`
- Modify: `public/sprites/music-*.png`
- Modify: `public/sprites/sfx-*.png`
- Modify: `src/game/assets/spriteManifest.ts`
- Test: `src/game/assets/spriteManifest.test.ts`
- Test: `src/game/scenes/PreloadScene.test.ts`

**Interfaces:**
- Consumes: existing sprite keys from scenes and `mapManifest.ts` / `powerUpConfig.ts`
- Produces: the same semantic sprite keys with new neon bitmaps; optional new UI-only keys if registration is unavoidable

- [ ] **Step 1: Update manifest coverage tests before touching assets**

```ts
import { describe, expect, it } from "vitest";
import { getSpriteDefinition } from "./spriteManifest";

describe("spriteManifest neon coverage", () => {
  it("keeps the core menu and arena keys registered", () => {
    expect(getSpriteDefinition("menu-bg").path).toBe("/sprites/menu-bg.png");
    expect(getSpriteDefinition("logo").path).toBe("/sprites/logo.png");
    expect(getSpriteDefinition("arena-bg-neon").path).toBe("/sprites/arena-bg-neon.png");
  });

  it("keeps power-up icon keys stable", () => {
    expect(getSpriteDefinition("powerup-freeze").path).toContain("powerup-freeze");
    expect(getSpriteDefinition("powerup-double-slap").path).toContain("powerup-double-slap");
  });
});
```

- [ ] **Step 2: Run the focused asset-registration tests**

Run: `npm test -- src/game/assets/spriteManifest.test.ts src/game/scenes/PreloadScene.test.ts`

Expected: PASS or FAIL only if the new manifest assertions expose missing registrations before bitmap work begins.

- [ ] **Step 3: Replace the bitmap files in place and adjust manifest fallback colors only where semantics changed**

```ts
// src/game/assets/spriteManifest.ts (fallback excerpt)
{
  key: "menu-bg",
  path: png("menu-bg"),
  category: "background",
  width: 1280,
  height: 720,
  fallback: "rectangle",
  fallbackColor: 0x090b12,
},
{
  key: "logo",
  path: png("logo"),
  category: "ui",
  fallback: "rectangle",
  fallbackColor: 0x20f6ff,
},
{
  key: "powerup-freeze",
  path: png("powerup-freeze"),
  category: "effect",
  fallback: "circle",
  fallbackColor: 0x20f6ff,
},
```

Implementation note for the PNGs:

- replace each existing file with the approved Cyber Fight Club art at the same path when the semantic role is unchanged
- keep dimensions aligned with the current render assumptions
- only add a new sprite key if an existing role cannot safely represent the new art

- [ ] **Step 4: Re-run the focused asset-registration tests**

Run: `npm test -- src/game/assets/spriteManifest.test.ts src/game/scenes/PreloadScene.test.ts`

Expected: PASS with preload still loading every required sprite key from the manifest.

- [ ] **Step 5: Commit**

```bash
git add public/sprites/menu-bg.png public/sprites/logo.png public/sprites/arena-bg*.png public/sprites/arena-platform*.png public/sprites/powerup-*.png public/sprites/mute-*.png public/sprites/music-*.png public/sprites/sfx-*.png src/game/assets/spriteManifest.ts src/game/assets/spriteManifest.test.ts
git commit -m "feat: refresh neon arcade sprite set"
```

## Task 4: Rebuild Main Menu And Shared Menu-Like Scenes

**Files:**
- Modify: `src/game/scenes/MainMenuScene.ts`
- Modify: `src/game/scenes/BattleSetupScene.ts`
- Modify: `src/game/scenes/ProfileScene.ts`
- Modify: `src/game/scenes/ProgressionScene.ts`
- Modify: `src/game/scenes/ProgressScene.ts`
- Modify: `src/game/scenes/AudioSettingsScene.ts`
- Create: `src/game/scenes/MainMenuScene.test.ts`
- Test: `src/game/scenes/ProfileScene.test.ts`
- Test: `src/game/scenes/ProgressionScene.test.ts`

**Interfaces:**
- Consumes: `createBackground()`, `createStyledButton()`, `drawNeonPanel()`, `getHudTextStyle()`
- Produces: unchanged scene keys and navigation flows with restyled menu compositions

- [ ] **Step 1: Add or update scene tests around the new chrome while preserving navigation behavior**

```ts
import { describe, expect, it, vi } from "vitest";
import { MainMenuScene } from "./MainMenuScene";

describe("MainMenuScene neon layout", () => {
  it("renders the menu background, neon logo, and five navigation buttons", () => {
    const scene = makeSceneStub(new MainMenuScene());
    scene.create();
    expect(scene.add.image).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), "logo");
    expect(scene.add.graphics).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused scene tests to verify the new expectations fail first**

Run: `npm test -- src/game/scenes/MainMenuScene.test.ts src/game/scenes/ProfileScene.test.ts src/game/scenes/ProgressionScene.test.ts`

Expected: FAIL because the new scene-level panel/graphics expectations do not exist yet.

- [ ] **Step 3: Recompose the menu-like scenes around shared neon panels and typography**

```ts
// src/game/scenes/MainMenuScene.ts (layout excerpt)
createBackground(this, { key: "menu-bg" });
drawNeonPanel(this, width * 0.18, height * 0.16, width * 0.64, height * 0.72);

this.add.image(width / 2, height * 0.22, "logo").setOrigin(0.5).setScale(0.42);
this.add.text(width / 2, height * 0.31, i18n.t("mainmenu.tagline"), {
  ...getHudTextStyle("timer"),
  color: "#b7ff3c",
}).setOrigin(0.5);
```

```ts
// src/game/scenes/ProfileScene.ts (row excerpt)
drawNeonPanel(this, width * 0.16, height * 0.18, width * 0.68, height * 0.58);
this.add.text(width * 0.22, rowY, label, getHudTextStyle("timer")).setOrigin(0, 0.5);
this.add.text(width * 0.78, rowY, value, {
  ...getHudTextStyle("timer"),
  color: "#f6fbff",
}).setOrigin(1, 0.5);
```

```ts
// src/game/scenes/AudioSettingsScene.ts (row chrome excerpt)
drawNeonPanel(this, width * 0.18, height * 0.22, width * 0.64, height * 0.48);
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/game/scenes/MainMenuScene.test.ts src/game/scenes/ProfileScene.test.ts src/game/scenes/ProgressionScene.test.ts`

Expected: PASS with navigation behavior preserved and new panel/graphics assertions covered.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/MainMenuScene.ts src/game/scenes/MainMenuScene.test.ts src/game/scenes/BattleSetupScene.ts src/game/scenes/ProfileScene.ts src/game/scenes/ProfileScene.test.ts src/game/scenes/ProgressionScene.ts src/game/scenes/ProgressionScene.test.ts src/game/scenes/ProgressScene.ts src/game/scenes/AudioSettingsScene.ts
git commit -m "feat: restyle menu and profile scenes"
```

## Task 5: Rebuild BattleScene Presentation Without Touching Mechanics

**Files:**
- Modify: `src/game/scenes/BattleScene.ts`
- Modify: `src/game/config/mapManifest.ts`
- Modify: `src/game/config/powerUpConfig.ts`
- Test: `src/game/scenes/BattleScene.test.ts`
- Test: `src/game/config/mapManifest.test.ts`
- Test: `src/game/config/powerUpConfig.test.ts`

**Interfaces:**
- Consumes: existing battle runtime, map keys, power-up definitions, and `createBackground()`
- Produces: unchanged battle-scene API and runtime logic with new HUD/backplate/effect composition helpers

- [ ] **Step 1: Extend battle tests to lock the visual-only contract**

```ts
it("renders the active map background and neon HUD panel without changing the score text contract", () => {
  const scene = makeBattleSceneStub();
  scene.create();
  expect(scene.add.image).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.stringMatching(/^arena-bg/));
  expect(scene.add.graphics).toHaveBeenCalled();
  expect(scene.runtime?.scoreText.setText).toBeDefined();
});
```

```ts
it("keeps map keys and power-up effect keys stable", () => {
  expect(getMapByKey("arena-neon")?.bgKey).toBe("arena-bg-neon");
  expect(getPowerUpDefinition("freeze").key).toBe("freeze");
});
```

- [ ] **Step 2: Run the focused battle/config tests to verify they fail**

Run: `npm test -- src/game/scenes/BattleScene.test.ts src/game/config/mapManifest.test.ts src/game/config/powerUpConfig.test.ts`

Expected: FAIL on the new HUD/panel assertions while map/power-up semantic key tests continue to pass.

- [ ] **Step 3: Layer the battle arena, HUD, and power-up visuals on the shared neon system**

```ts
// src/game/scenes/BattleScene.ts (HUD excerpt)
const hudBackplate = drawNeonPanel(this, 24, 20, width - 48, 92);
hudBackplate.setDepth(10);

runtime.scoreText = this.add.text(width / 2, 48, "", {
  ...getHudTextStyle("score"),
  color: "#f6fbff",
}).setOrigin(0.5).setDepth(11);

runtime.timerText = this.add.text(width - 96, 48, "", {
  ...getHudTextStyle("timer"),
  color: "#b7ff3c",
}).setOrigin(0.5).setDepth(11);
```

```ts
// src/game/scenes/BattleScene.ts (power-up icon framing excerpt)
const chip = this.add.graphics().setDepth(9);
chip.fillStyle(0x101522, 0.9);
chip.fillRoundedRect(x - 26, y - 26, 52, 52, 10);
chip.lineStyle(2, 0x20f6ff, 1);
chip.strokeRoundedRect(x - 26, y - 26, 52, 52, 10);
```

```ts
// src/game/config/powerUpConfig.ts (color excerpt only; keys unchanged)
color: 0xb7ff3c
color: 0xff5a36
color: 0x20f6ff
```

Constraint while implementing:

- do not alter `applySlap`, `handleRingOut`, round state, dodge behavior, bot behavior, or progression writes
- any helper extracted from `BattleScene.ts` must remain visual-only

- [ ] **Step 4: Run the focused battle/config tests to verify they pass**

Run: `npm test -- src/game/scenes/BattleScene.test.ts src/game/config/mapManifest.test.ts src/game/config/powerUpConfig.test.ts`

Expected: PASS with identical battle mechanics and updated presentation coverage.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/BattleScene.ts src/game/scenes/BattleScene.test.ts src/game/config/mapManifest.ts src/game/config/mapManifest.test.ts src/game/config/powerUpConfig.ts src/game/config/powerUpConfig.test.ts
git commit -m "feat: restyle battle scene and arena visuals"
```

## Task 6: Restyle Results, Achievements, Cosmetics, And Shop Surfaces

**Files:**
- Modify: `src/game/scenes/ResultsScene.ts`
- Modify: `src/game/scenes/AchievementsScene.ts`
- Modify: `src/game/scenes/CosmeticsScene.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Test: `src/game/scenes/AchievementsScene.test.ts`
- Create: `src/game/scenes/ResultsScene.test.ts`
- Create: `src/game/scenes/CosmeticsScene.test.ts`
- Create: `src/game/scenes/ShopScene.test.ts`

**Interfaces:**
- Consumes: shared theme helpers and existing scene data sources
- Produces: unchanged scene keys and data flow with consistent panel/card/tabs treatment

- [ ] **Step 1: Add the missing scene tests around the post-match and collection surfaces**

```ts
import { ResultsScene } from "./ResultsScene";

it("renders a neon results panel and still shows the back-to-menu control", () => {
  const scene = makeSceneStub(new ResultsScene());
  scene.create();
  expect(scene.add.graphics).toHaveBeenCalled();
  expect(scene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(String), expect.objectContaining({
    fontStyle: expect.stringMatching(/bold|normal/),
  }));
});
```

- [ ] **Step 2: Run the focused collection/results tests to verify they fail**

Run: `npm test -- src/game/scenes/AchievementsScene.test.ts src/game/scenes/ResultsScene.test.ts src/game/scenes/CosmeticsScene.test.ts src/game/scenes/ShopScene.test.ts`

Expected: FAIL because the new test files and/or the new panel/card assertions do not exist yet.

- [ ] **Step 3: Rebuild these scenes around shared neon panels, cards, and tabs**

```ts
// src/game/scenes/ResultsScene.ts (panel excerpt)
drawNeonPanel(this, width * 0.16, height * 0.14, width * 0.68, height * 0.62);
```

```ts
// src/game/scenes/AchievementsScene.ts (card excerpt)
const card = drawNeonPanel(this, x - 52, y - 46, 104, 112);
card.setAlpha(isUnlocked ? 1 : 0.45);
```

```ts
// src/game/scenes/ShopScene.ts (cell excerpt)
const bg = drawNeonPanel(this, x, y, cellW, cellH);
bg.setAlpha(isPurchased ? 1 : 0.92);
```

Implementation constraints:

- results XP, rewarded-ad behavior, achievement queueing, cosmetics equip semantics, and shop purchase flow must remain unchanged
- only the scene chrome, typography, card framing, and icon/asset presentation may change

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/game/scenes/AchievementsScene.test.ts src/game/scenes/ResultsScene.test.ts src/game/scenes/CosmeticsScene.test.ts src/game/scenes/ShopScene.test.ts`

Expected: PASS with the existing business flows intact and the new visual structure covered.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/ResultsScene.ts src/game/scenes/ResultsScene.test.ts src/game/scenes/AchievementsScene.ts src/game/scenes/AchievementsScene.test.ts src/game/scenes/CosmeticsScene.ts src/game/scenes/CosmeticsScene.test.ts src/game/scenes/ShopScene.ts src/game/scenes/ShopScene.test.ts
git commit -m "feat: restyle results and collection scenes"
```

## Task 7: Full Verification And Visual Regression Sweep

**Files:**
- Modify: any touched files from Tasks 1-6 only if verification exposes visual wiring regressions
- Test: full repo test suite

**Interfaces:**
- Consumes: all prior tasks
- Produces: a verified working branch with build/test evidence and no missing-asset regressions

- [ ] **Step 1: Run the targeted UI and scene suite**

Run: `npm test -- src/game/ui/neonTheme.test.ts src/game/ui/StyledButton.test.ts src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts src/game/assets/spriteManifest.test.ts src/game/scenes/MainMenuScene.test.ts src/game/scenes/ProfileScene.test.ts src/game/scenes/ProgressionScene.test.ts src/game/scenes/AchievementsScene.test.ts src/game/scenes/ResultsScene.test.ts src/game/scenes/BattleScene.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`

Expected: `vitest run --environment node` completes with all tests passing.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite build completes successfully and emits the production bundle without TypeScript/import errors.

- [ ] **Step 4: Fix only regressions that violate the spec or constraints, then rerun the exact failed command**

Regression rules while fixing failures:

- if a scene references a newly added sprite key, add that key to `src/game/assets/spriteManifest.ts` and rerun the exact failing preload/build/test command
- if a visual helper test fails because the public chrome contract intentionally changed, update that test and rerun only that test file first
- do not change gameplay, progression, achievement, or persistence logic to silence a visual regression

- [ ] **Step 5: Commit**

```bash
git add src/game public/sprites docs/superpowers/plans/2026-06-26-modern-neon-arcade.md
git commit -m "chore: verify modern neon arcade redesign"
```
