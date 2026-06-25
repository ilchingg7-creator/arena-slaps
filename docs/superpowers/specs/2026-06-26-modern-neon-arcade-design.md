# Arena Slaps: Modern Neon Arcade Visual Redesign

Date: 2026-06-26
Status: Draft approved in conversation, pending file review
Scope: Visual/UI/art-only redesign. No gameplay logic, combat rules, progression, achievements, or economy changes.

## 1. Goal

Rework the entire presentation of Arena Slaps into a unified "Modern Neon Arcade" direction with a specific tone of "Cyber Fight Club".

The redesign must:

- unify all scenes under one visual language
- replace or refresh the main menu, logo, battle presentation, and scene UI
- update arena, HUD, power-up visuals, and feedback effects
- preserve TypeScript, Vite, Phaser 3 compatibility and existing behavior
- keep all new assets wired through the existing manifest-driven asset pipeline
- preserve existing tests and pass:
  - `npm run build`
  - `npm run test`

Out of scope:

- combat balance changes
- round rules or scoring changes
- progression changes
- achievement logic changes
- audio behavior changes beyond visual presentation of settings UI
- monetization or shop rule changes

## 2. Chosen Visual Direction

The chosen direction is `Cyber Fight Club`.

This style uses:

- very dark graphite and ink-heavy backgrounds
- high-contrast neon accents
- aggressive combat-broadcast HUD treatment
- bright electric outlines instead of soft pastel fills
- arcade presentation that feels modern rather than retro-synthwave

The selected logo direction is `wordmark only`.

This means the brand presentation will focus on a large, sharp, readable neon "Arena Slaps" title treatment without a separate emblem.

The selected implementation strategy is `Unified Neon System`.

This means the redesign will be driven by one shared set of design tokens, one family of reusable UI primitives, and one coordinated asset set used consistently across all scenes.

## 3. Visual System

### 3.1 Core palette

The visual system will use a small, controlled palette:

- base background: near-black ink, charcoal, deep graphite
- primary neon: electric cyan
- secondary neon: acid lime
- tertiary accent: hot magenta
- warning/impact accent: orange-red
- neutral panel text: white to cool off-white
- subdued secondary text: steel/cool gray

Intent:

- cyan communicates system/UI structure
- lime communicates active, success, selected, or charged states
- magenta is reserved for premium/energy accents
- orange-red is reserved for impact, danger, ring-out, and strong warnings

### 3.2 Tokens

A shared design-token module will define:

- colors
- typography presets
- button sizes
- panel spacing
- border widths
- corner radii
- glow strengths
- shadow presets
- HUD sizing constants

Every reusable UI component should read from these tokens rather than hard-coding scene-specific values.

### 3.3 Shape language

The UI will move away from soft rounded gradient cards and toward:

- darker panel bodies
- sharper silhouettes
- smaller radii
- double-line or inner+outer neon borders
- selective glow instead of full-surface saturation
- stronger active/pressed states

This keeps readability high while making the project feel more competitive and combat-oriented.

### 3.4 Typography treatment

Phaser-friendly text styling will be used rather than introducing runtime font-loading complexity.

Typography style will rely on:

- strong uppercase or near-uppercase headings where appropriate
- tighter hierarchy between title, panel title, body, helper text, and HUD
- stroke + shadow/glow combinations for readability on dark backgrounds
- a custom text-treatment helper layer where repeated title/HUD styles are needed

The goal is not to change the text system architecture, only to standardize how text looks everywhere.

## 4. Asset Strategy

### 4.1 Asset policy

This redesign allows maximum asset replacement.

The following asset categories may be fully replaced:

- `menu-bg`
- `logo`
- arena background sprites
- arena platform sprites
- power-up sprites/icons
- UI icon sprites where needed for consistency

### 4.2 Integration policy

All new assets must continue to flow through the existing manifest-driven asset pipeline.

That means:

- asset definitions remain registered through the current sprite/sound manifest flow
- scenes continue to refer to manifest keys, not ad hoc direct file paths
- map backgrounds and platforms remain coordinated via `mapManifest`
- power-up visuals remain coordinated with the current power-up configuration pipeline

### 4.3 Safe replacement policy

Prefer replacing existing sprite files or existing manifest keys when the semantics remain the same.

Introduce new manifest keys only when one of these is true:

- the new visual role is genuinely distinct
- the old key name would become misleading
- reuse would create scene coupling or regress readability

This keeps the migration small and minimizes risk to scene code and tests.

## 5. Scene System

### 5.1 MainMenuScene

Main menu becomes the primary brand screen for the new style.

Changes:

- replace background with a darker, layered combat-club scene
- replace current logo with a large neon wordmark
- strengthen hierarchy between title, tagline, primary CTA, and secondary options
- restyle mute/language controls into the same chrome as the rest of the UI
- keep current navigation behavior and scene transitions unchanged

The menu should feel like the entrance to a competitive neon arena rather than a generic arcade screen.

### 5.2 BattleScene

Battle presentation gets the strongest visual refresh while preserving all mechanics.

Changes:

- replace arena backgrounds and platform art with Cyber Fight Club visuals
- make ring-out boundaries easier to read through lighting/contrast
- redesign top HUD to resemble a tournament broadcast overlay
- unify score, timer, combo, and winner states into one visual family
- refresh power-up icon presentation and pickup readability
- upgrade slap-hit and ring-out presentation while keeping the same gameplay timing and outcome logic

The battle should remain mechanically identical but look much more deliberate and premium.

### 5.3 ProfileScene, ProgressionScene, AchievementsScene, ResultsScene, AudioSettingsScene

These scenes will be normalized around a shared panel system.

Changes:

- dark layered backgrounds
- central neon-framed panels
- consistent page titles and section headers
- consistent button chrome
- unified card/list row treatment
- clearer selected/focus/active states

Each scene keeps its current function and data flow, but visually reads as part of the same product.

### 5.4 PauseMenu

Pause menu becomes a combat-system overlay rather than a simple dimmer with buttons.

Changes:

- stronger overlay treatment
- central system-panel composition
- consistent pause, settings, and return controls
- volume controls restyled to match the shared UI tokens

Behavior remains unchanged, including resume/settings/main-menu actions and live slider persistence.

### 5.5 Related scenes

Any adjacent scene that visually shares UI patterns with the target set, especially setup/shop/cosmetics style screens, should be brought into alignment where the change is low-risk and uses the same shared primitives.

This keeps the redesign from stopping awkwardly at scene boundaries.

## 6. Effects and Polish

### 6.1 Battle feedback

Effects should use the same color logic as the rest of the redesign:

- hit feedback: electric and sharp
- ring-out feedback: high-contrast warning/impact treatment
- power-up collection: bright readable confirmation
- active power-up state: clear coded color language

No effect may alter gameplay timing, hit detection, or scoring behavior.

### 6.2 Environmental polish

Where safe and readable, scenes may add lightweight presentation layers such as:

- glows
- vignettes
- panel sheen
- light bars
- scanline or grid hints
- soft atmospheric overlays

These should remain secondary to gameplay readability, especially in battle.

### 6.3 Consistency rule

If an effect, button state, or panel treatment appears in one scene, it should map back to the same token vocabulary in other scenes unless there is a clear readability reason not to.

## 7. Implementation Stages

Implementation will be executed in this order:

1. Design tokens: colors, spacing, borders, shadows, text presets
2. Shared UI primitives/components
3. MainMenuScene refresh
4. BattleScene visual refresh
5. Remaining target scenes
6. Effects and final polish
7. Final verification with build and tests

This order ensures the foundation exists before scene-by-scene application.

## 8. Technical Constraints

Must preserve:

- TypeScript correctness
- Phaser 3 scene flow
- Vite build compatibility
- existing scene and UI test expectations where behavior is unchanged

Must not change:

- gameplay rules
- combat system behavior
- progression calculations
- achievements logic
- profile/state persistence semantics

Where existing tests assert visual helper behavior directly, implementation should update the tests only when the public visual contract intentionally changes and the underlying behavior remains correct.

## 9. Verification Plan

Before claiming completion:

- run `npm run build`
- run `npm run test`
- inspect for manifest wiring regressions
- confirm scenes still boot and navigate without missing asset-key errors

Success criteria:

- all targeted scenes share one coherent Cyber Fight Club style
- battle readability is improved, not reduced
- no gameplay or progression behavior changes
- build passes
- tests pass

## 10. Risks and Mitigations

Risk: visual helpers become duplicated across scenes.

Mitigation:

- centralize repeated styles and drawing behavior in shared UI/token modules

Risk: asset replacement breaks manifest references.

Mitigation:

- preserve key semantics
- add or replace assets only through the current manifest flow

Risk: stronger effects reduce readability in battle.

Mitigation:

- prioritize silhouette clarity, HUD contrast, and ring-out legibility over decorative intensity

Risk: scope creep into non-visual systems.

Mitigation:

- keep implementation bounded to styles, UI, scene presentation, asset usage, and visual feedback only

## 11. Approval Gate

This document defines the approved design target for the implementation plan.

Implementation should not begin until the user reviews this file and confirms that the design is acceptable.
