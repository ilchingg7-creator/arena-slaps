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

