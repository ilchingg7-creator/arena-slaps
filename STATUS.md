# Arena Slaps — Status

**Version:** v1.8.0
**Last updated:** 2026-06-26
**Build:** `5.17s` · **Tests:** `1020/1020 passed (60 files)` · **tsc:** clean · **Bundle:** `370.65 KB gzip`

---

## Recent work (latest first)

### v1.8.0 — UX polish + bot balance + P2 dodge + ProgressScene (2026-06-26)

Major UX and balance iteration across 12 commits.

**ShopScene rewrite:**
- Tab-based layout (Items / Packs) — no more overflow on 1280×720.
- Visual previews for each item: headwear PNG, outline stroke, trail
  tinted texture, slap FX PNG, pack count badge.
- Hover tooltip on packs showing full cosmetic list.
- Pack names use product titleKey (not first cosmetic name).
- Buy buttons disabled in dev mode (grey, non-interactive).
- Yandex catalog prices loaded on entry (falls back to defaultPrice).
- Currency: ₽ → **ЯН** (Yandex platform currency).
- Individual titles removed (only available via pack_titles).

**CosmeticsScene improvements:**
- Previews **always visible** (even when locked) at 40% alpha.
- Text no longer overlaps icons (preview shifted up, name shifted down).
- Default category: "color" → "outline" (color was removed).
- Back button text fixed ("Внешний вид" → "Назад").
- P2 cosmetics now **actually applied in battle** (registry → profile
  merge fix — was the most critical cosmetics bug).
- P1 equipped cosmetics filtered by ownership on resolve (Bug 4 fix —
  prevents 2P exploit where paid cosmetics could persist to P1 profile).

**ProgressScene (merged Progression + Achievements):**
- Single scene with two tabs: "Уровни" (level, XP, unlock ladder) +
  "Достижения" (18-achievement grid).
- Tab switching in-place (no scene.restart).
- MainMenu: 6 buttons → **5** (merged Progression + Achievements).
- Levels 9-10: display only title name, no "—" placeholder.

**Trail cosmetic fixed:**
- Switched to manual `emitParticleAt` (Phaser 3.80 emitter.x/y unreliable).
- Particles spawn at actor's feet (+20px below center).
- Direction-aware: moving right → trail on left, moving left → on right.
- Brighter/puffier: scale 1.0, alpha 1.0, lifespan 600ms, quantity 2,
  speed 0-30 random spread.

**Bot balance:**
- Dodge chances nerfed: easy 0.40→0.25, medium 0.75→0.45, hard 0.95→0.55.
- Reaction time increased: easy 350→400ms, medium 200→250ms, hard 100→200ms.
- Slap intervals increased: easy 800→1000ms, medium 500→700ms, hard
  450→600ms. Bot was slapping faster than a human could (automatic
  timer vs manual key press).

**P2 dodge:**
- P2 can now dodge in 2P-local mode (CTRL key).
- Same mechanics as P1: 200ms i-frames, 1.5s cooldown, 2x speed burst.

**Map names:**
- Shortened RU names: "Базовая арена" → "Базовая", etc. No more
  button overflow.

**Cloud Save fixes (from code review):**
- Cloud profile loaded when local is empty (new device — Bug 1).
- Safe-parse local profile (corrupt localStorage — Bug 2).
- Pending data retained on flush failure (Bug 3).
- Local-wins pushes to cloud after init (Bug 9).
- `playerSetData` flush parameter added (Bug 8).

**Commits:** `08c6cfd`, `c6b8f5c`, `1b3c250`, `449eabd`, `815205e`,
`c96c6dd`, `89c219f`, `4fd6311`, `ddc2ebe`, `bdda819`, `a06d557`,
`82ba74a`, `925b6a7`
**Tests:** 1015 → 1017

---

### v1.7.0 — Cloud save + In-App Purchases (2026-06-26)

Two major platform features added in this release:

**Cloud Save (Yandex Player Data):**
- `CloudSaveService` — loads cloud data on init, merges with local using
  `lastPlayedAt` timestamp comparison (newer wins). Handles corrupt data,
  network errors, and empty cloud gracefully.
- `saveProfile` / `saveSettings` now trigger a **debounced (3s) cloud
  write** via dynamic import — no changes to any scene.
- `CloudSaveService.flush()` on tab hide + `beforeunload` — pending
  writes are pushed before the tab closes.
- Dev mode: cloud operations are no-ops, localStorage works as before.
- Cross-device: play on device A → open on B → cloud wins → progress
  synced. Play offline on B → open online → local wins → push to cloud.

**In-App Purchases (Yandex IAP):**
- `YandexSDK` extended with `getPayments()`, `iapGetCatalog()`,
  `iapPurchase()`, `iapGetPurchases()` — all with graceful dev fallback.
- `IAPService` — `init()` restores purchases from Yandex →
  `profile.cosmetics.owned`. `purchase()` calls Yandex dialog → adds
  cosmetics → `saveProfile`. `isPurchased()` / `getCatalog()` for UI.
- `IAPManifest` — 27 products: 21 individual cosmetics (19 ЯН each) +
  5 category packs (29-49 ЯН) + 1 Everything Bundle (149 ЯН).
- **21 paid cosmetics** added to `CosmeticsManifest`:
  - 6 headwear: wizard, pirate, space, ninja, viking, tophat
  - 4 trails: fire, rainbow, galaxy, poison
  - 4 slap FX: explosion, confetti, skull, heart
  - 4 outlines: gold, rainbow, neon-pink, neon-green
  - 3 titles: titan, legend+, patrician
- **14 new PNG assets** generated via `scripts/generate_premium_sprites.py`
- **ShopScene** — full-screen shop with two sections (Individual Items +
  Discount Packs), buy buttons, restore purchases, dev mode notice.
- **MainMenuScene** — 6th button "Магазин" (warning variant) added.
- `IAPService.init()` in `main.ts` after `CloudSaveService.init()` —
  restores purchases before the game starts.

**Also in this version:**
- P2 cosmetics now applied in battle (registry → profile merge fix).
- `CosmeticsScene` default category changed from "color" (removed) to
  "outline". Back button text fixed.
- Removed dead `battleStartAt` from anti-camp API (parameter + comments).
- Cleaned up `CosmeticCategory` / `EquippedCosmetics` types (removed
  `color` + `powerUpSkin`).
- `CosmeticCategory` now: outline, trail, slapFx, title, headwear.
- 50 → 64 sprite definitions (14 premium assets registered).

**Commits:** `9aa2573`, `85c52f4`, `610ee60`, `73e9cbb`
**Tests:** 976 → 1015 (+39)

---

### v1.6.0 — Cosmetics overhaul + anti-camp stabilization (2026-06-25)

Major UX iteration addressing 20+ issues across 7 commits. The cosmetics
system went from "barely functional" to "actually playable", and the
anti-camp penalty was stabilized after 5 rounds of fixes.

**Cosmetics (5 categories, 16 items):**
- **Removed** the `color` category entirely — Phaser's `setTint` on PNG
  sprites was unreliable (muddy/ invisible results). The game now
  focuses on clearly visible cosmetics.
- **Removed** `powerUpSkin` category — both entries had no visual effect.
- **Added** 2 new headwear: **Halo** (L5, golden ring) and **Helmet**
  (L7, grey knight's visor). 6 headwear total.
- **Removed** duplicate `outline-none` (identical to `outline-white`).
- **5 active categories:** outline (2), trail (2), slapFx (2), title (7),
  headwear (6 + 1 2P-free).
- **2P-local mode:** ALL cosmetics available to BOTH players regardless
  of progression. 1P-vs-bot: progression-gated (free cosmetics unlock by
  level; 2p-free cosmetics are 2P-exclusive; paid reserved for future
  Yandex IAP).

**CosmeticsScene rewrite:**
- Replaced ALL `scene.restart()` calls with lightweight `refreshGrid()`
  — only the grid cells are destroyed + re-created, not the entire scene.
- Added re-entrancy guard (`refreshInProgress` flag) to prevent Phaser
  object leaks during rapid clicking.
- Added live preview (headwear sprite + title text) at the top.
- `init()` preserves target + selectedCategory across restarts.
- P2 cosmetics are **transient** (Phaser registry, not localStorage).
- Grid cells for headwear show actual PNG previews (not text).

**CosmeticVisuals (BattleScene):**
- **Outline:** now tracked inside `CosmeticVisuals.update()` every frame
  (was a static rect left behind when the actor moved).
- **Trail:** fixed Phaser 3.80 particle emitter API — `pause()/resume()`
  with local flag instead of `stop()/start()`. Particles spawn at feet
  (`followOffset { y: 16 }`), `speed=0` so they stay where emitted.
- **Slap FX:** unified via `runtime.slapP1()` / `runtime.slapP2()`
  helpers — both keyboard and tap paths now play the FX.
- **Title:** rendered below nickname in HUD. Offset -50px, origin
  `(0.5, 1)` — grows upward, doesn't overlap the sprite.

**Anti-camp penalty (5 rounds of fixes):**
- Grace 5s, ramp 4s, floor 0.4x (reverted from 8/5/0.5 which was too
  soft, then from 5/4/0.4 which was correct).
- **Removed ALL dependency on `battleStartAt`** — fresh actors
  (`lastSlapAt = -Infinity`) are ALWAYS full speed, regardless of how
  much time has passed. This was the root cause of the persistent
  "slow start after long menu idle" bug: Phaser's `this.time.now` doesn't
  reset when the scene is reused, making `battleStartAt` stale.
- `resetActor()` now accepts `now` and sets `lastSlapAt = now` on
  respawn — 5s grace after each ringout.
- Anti-camp activates ONLY after the first successful slap + 5s of
  inactivity. A camper who never engages isn't slowed (acceptable —
  they're not a threat).
- Removed the `slowed` tint from `getActorEffectTint` — it was
  overriding the cosmetic base tint, making the player's chosen color
  invisible. Speed reduction alone is sufficient feedback.

**Speed tuning:**
- Player speed: 260 → 320.
- Bot speeds: easy 160→200, medium 200→250, hard 240→300.

**Other fixes in this version:**
- Music now stops on tab hide (reads AudioService from `game.registry`
  directly, not `scenes[0]` which could be undefined).
- Music resumes the correct track (menu-theme vs battle-theme) on
  tab return, not always menu-theme.
- `package.json` — added `"typecheck": "tsc --noEmit"` script.
- ProfileService — `favoriteMode` now uses accurate mode counts
  derived from `p2GamesPlayed` (was attributing all prior games to
  favoriteMode).
- Settings migration validates `mode` / `botDifficulty` against
  option lists (was blindly casting).
- Level reward (title) now included in `BattleEndOutput.levelUp` and
  shown in ResultsScene via `formatResultsSummary`.

**Commits:** `db861df`, `4ac4307`, `c958d7a`, `3133d85`, `60b6e60`,
`7381bad`, `560a140`, `ca2d96e`
**Tests:** 970 → 976

---

### v1.5.0 — Cosmetic visual application + anti-camp + progression fix (2026-06-25)

Three features in this release:

1. **Cosmetic visual application (the big one)**
   - All 7 cosmetic categories now render visually in BattleScene:
     - **Color** — applied via `createPlayer(colorOverride)` (was in v1.4.0)
     - **Outline** — duplicate stroke rectangle behind the actor
     - **Trail** — Phaser particle emitter, emits while moving (>100 px²/s)
     - **Slap FX** — one-shot image + scale-up/fade-out tween on hit
     - **Title** — appended below nickname in HUD label (e.g. "Alice\nRookie")
     - **Power-up skin** — reserved (no visual change yet)
     - **Headwear** — overlay image (cap / crown / horns / party-hat)
   - 8 new PNG assets generated via `scripts/generate_cosmetic_sprites.py`
   - New `CosmeticVisuals` module manages per-actor visuals (create /
     update / playSlapFx / destroy)
   - Outline applied via renderer-agnostic duplicate rectangle (no
     post-pipeline dependency — works on Canvas fallback too)
   - Trail emitter pulses on movement, stops when idle
   - Slap FX auto-destroys after 300ms tween
   - All visuals destroyed on scene shutdown (no leaks)

2. **Anti-camp movement penalty (v1.4.1)**
   - Actors who haven't landed a slap in 5s start slowing down
   - Linear ramp from 1.0x to 0.4x speed over 4s (5s-9s window)
   - Clamped at 0.4x (never fully stopped)
   - Resets instantly on next successful slap
   - Stacks multiplicatively with Boost power-up
   - Visual tint: muted blue-grey (0x6b7a8f) at lowest priority
   - Tunable constants in `battleConfig.antiCamp`

3. **Progression Variant B (v1.4.0)**
   - Fixed fake `arena-default` unlock on level 3 (map was always available)
   - Removed redundant `all-maps` unlock on level 10 (all maps already
     unlocked by level 8)
   - Shifted 5 non-default maps down: levels 3, 5, 6, 7, 8 (was 5-9)
   - Level 9 gets new `veteran` title
   - Each level 1-10 has at least one unlock or reward

**Commits:** `06a776f`, `3ccd979`, `ae63a6e`, `b2abd72`
**Tests:** 840 → 970 (+130)

---

### v1.4.0 — Cosmetics system + picker UI (2026-06-25)

Full cosmetics system with 7 categories and a dedicated picker scene.

- **CosmeticsManifest** — 28 cosmetics across 7 categories (color,
  outline, trail, slapFx, title, powerUpSkin, headwear)
- **Sources:** free (level-gated), 2p-free (2P-local only), paid
  (reserved for future Yandex IAP)
- **2P-local free rule:** both players can pick ANY cosmetic (including
  paid) for free, for that session only
- **Profile extension:** `cosmetics.{owned, equipped, p2Equipped}` with
  migration + resetProfileStats preservation
- **resolveCosmetics** — pure helper converting equipped ids to concrete
  values (color hex, trail texture, headwear sprite+offsetY, etc.)
- **CosmeticsPickerState** — pure state machine for the picker UI
  (buildPickerModel, equipCosmetic with toggle behavior)
- **CosmeticsScene** — full-screen picker overlay with category tabs,
  P1/P2 target toggle, grid of cells with lock indicators
- **BattleSetupScene** — new "Внешний вид" button opens CosmeticsScene
- **30+ new translation keys** for cosmetics UI + per-cosmetic names

**Commit:** `06a776f`
**Tests:** 891 → 970 (+79)

---

### v1.3.0 — 5 bugfixes from second code review (2026-06-25)

Five bugs identified during a second code-review pass, all fixed via TDD
(RED → GREEN):

1. **`LoadingAPI.ready()` was never called**
   - `main.ts` listened for `game.events.once("ready", ...)` but
     `PreloadScene.create()` never emitted the event — it just called
     `this.scene.start("MainMenuScene")`. On the Yandex platform this
     meant the loader never received the "game is playable" signal
     (Rule 1.19.2), potentially hanging the Yandex loading overlay.
   - Fix: `PreloadScene.create()` and the 8-second timeout fallback
     both emit `"ready"` on `this.game.events` before transitioning.

2. **2P-local broke profile / achievements / results (3 sub-issues)**
   - **2a:** `processBattleEnd` early-returned for 2P-local, so
     `p2GamesPlayed` never incremented — `social` achievement was
     unreachable.
   - **2b:** BattleScene still called `processBattleEnd` for 2P and
     stashed a non-null `BattleEndOutput` (with `xpGained: 0`) in the
     registry.
   - **2c:** `formatResultsSummary` then showed `XP: +0` and
     `Level: 1` after a 2P battle — misleading.
   - Fix: added a new `"neutral"` outcome to `GameResult` /
     `BattleContext`. In 2P mode, `processBattleEnd` now records
     stats via `recordGameResult({ outcome: "neutral" })` (increments
     `totalGames` + `mapsPlayed` + `p2GamesPlayed` but NOT
     wins/losses/streaks/ringOuts), runs `checkBattleEnd` with
     `ctx.outcome = "neutral"` so 1P-specific achievements don't fire,
     and `formatResultsSummary` skips XP/Level lines for 2P mode.
     `social`, `all_maps`, and `veteran` are now reachable via 2P.

3. **`ALL_POWERUP_TYPES` had 3 phantom keys**
   - Array had `"double_slap"`, `"mega_sprint"`, `"anti_gravity"` —
     none exist as `PowerUpEffect` keys. Real keys: `speed`,
     `knockback`, `shield`, `mega-knockback`, `freeze`, `double-slap`.
   - `all_powerups` achievement was mathematically unreachable.
   - Fix: array now mirrors `POWERUP_DEFINITIONS` exactly.

4. **`ALL_MAPS` had 5 phantom keys**
   - Array had `"arena-lava"`, `"arena-jungle"`, `"arena-space"`,
     `"arena-desert"` — none exist in `MAPS`. Real keys:
     `arena-default`, `arena-neon`, `arena-cosmic`, `arena-volcano`,
     `arena-ice`, `arena-grass`.
   - `all_maps` achievement was mathematically unreachable.
   - STATUS.md previously claimed "only arena-default ships" — that
     was also stale; 6 maps actually ship.
   - Fix: array now mirrors `MAPS` exactly.

5. **Yandex SDK language not wired**
   - `I18nService.detectLanguage()` reads `window.__yaSdkLang` but
     `YandexSDK.init()` never wrote it. On prod, the Yandex platform's
     language setting was always ignored — the game fell back to
     `navigator.language`. A player with an English browser but a
     Russian Yandex account would see EN instead of RU.
   - Fix: `YandexSDK.init()` now calls `getLanguage()` after
     `YaGames.init()` resolves and writes the result to
     `window.__yaSdkLang`.

6. **Rewarded XP didn't recalculate level-up / achievements**
   - ResultsScene's ×2 XP callback called
     `ProgressionService.applyXp` directly and ignored the returned
     `levelUp` object. If the rewarded XP crossed level 5 or 10:
     - The `level_5` / `level_10` achievements were NOT unlocked
       (`AchievementService.checkLevel` was never called).
     - The "Level up!" banner didn't show (battleEnd.levelUp.leveledUp
       stayed `false` from the original battle).
     - `newlyUnlocked` was not updated, so achievement notifications
       didn't fire.
   - Fix: extracted a pure `applyRewardedXp` helper that runs
     `applyXp` + `checkLevel`, merges new level-achievements with the
     original `newlyUnlocked`, and returns an updated
     `BattleEndOutput` with `xpDoubled: true`. ResultsScene now uses
     this helper instead of calling `applyXp` directly.

**Commits:** `5d1d183`
**Tests:** 804 → 840 (+36)

**New files:**
- `src/game/scenes/PreloadScene.test.ts` — Bug 1 regression tests
- `src/game/services/applyRewardedXp.ts` + `.test.ts` — Bug 7 helper
- `src/game/yandex/SDK.test.ts` — Bug 5 regression tests

---

### v1.2.0 — Bugfixes from first code review (2026-06-25)

Three bugs identified during code review, fixed via TDD (RED → GREEN):

1. **Power-up despawn time-base mismatch**
   - `spawnPowerUp` stamped `spawnedAt = Date.now()` internally, while
     `shouldDespawnPowerUp` / `isInDespawnWarning` / `shouldBlink` used
     the caller's `now` (Phaser's `this.time.now`). In backgrounded tabs
     `Date.now()` keeps ticking while Phaser freezes — power-ups either
     despawned too early or never despawned.
   - Fix: `spawnPowerUp` now accepts an optional `now` parameter; both
     `BattleScene` call sites pass `this.time.now`.

2. **Combo tier-2 multiplier was 2.5 (spec says 3.0)**
   - `CombatSystem.ts` JSDoc promised "3.0 when comboStacks === 5
     (mega-launch)" but the constant was `COMBO_MULT_TIER2 = 2.5`.
   - Fix: bumped to `3.0`. Knockback at 5 stacks: `560 × 3.0 = 1680`
     (was 1400). Tests updated.

3. **×2 XP exploit + incomplete double**
   - **3a (exploit):** The local `doubledXP` flag was reset on
     `scene.restart()` — player could press ×2 XP infinitely.
   - **3b (incomplete):** Granted only base XP (win=100/loss=30/draw=50)
     as a "double approximation", ignoring ring-outs (×20) and power-ups
     (×10).
   - Fix: added `xpDoubled: boolean` to `BattleEndOutput`; ResultsScene
     reads it from the Phaser registry (survives `scene.restart()`),
     hides the button when set, and grants `battleEnd.xpGained` (the
     real first portion) as the second portion — true ×2.

**Commits:** `b8aa6f6`
**Tests:** 799 → 804 (+5)

---

### v1.1.0 — End-of-battle pipeline + achievements wiring (2026-06-25)

Three integration bugs surfaced by QA:

1. **Achievements button missing** — `MainMenuScene` had only 4 buttons
   (Start / Profile / Progression / Audio). Added a 5th "Достижения"
   button; repositioned all five to fit (0.40 / 0.515 / 0.63 / 0.745 /
   0.86) and moved the feedback email to 0.955.

2. **XP / level / achievements not displayed** — `BattleScene` awarded
   XP via `console.log` only; `ResultsScene` showed only the score.
   Created a pure `processBattleEnd` helper that orchestrates
   `ProfileService` → `ProgressionService` → `AchievementService` in
   one call. Result is stashed in the Phaser registry under
   `lastBattleEnd`. `ResultsScene` reads it via `formatResultsSummary`
   and renders: XP gained, current level, level-up + new unlocks, and
   one line per newly-unlocked achievement.

3. **Achievement notifications never fired** — `AchievementService`
   existed but was never called from the game loop. Wired through
   `processBattleEnd`; `ResultsScene` instantiates
   `AchievementNotification` and calls `.show(icon, name)` for each
   `newlyUnlocked` (queued internally if multiple).

**Side fixes:**
- `ProfileService.recordGameResult` now updates `currentWinStreak`,
  `maxWinStreak`, `powerUpTypesUsed`, `mapsPlayed`, `p2GamesPlayed`.
- Constructor deep-copies arrays (was a hidden state-leak bug — tests
  were mutating `DEFAULT_PROFILE`).
- BattleScene tracks `maxComboReached`, `dodgesThisBattle`,
  `ringOutsSufferedThisBattle`, `battleStartAt` for the combo / dodge /
  survivor / speed_demon achievement conditions.
- 5 new translation keys: `results.xp` / `level` / `levelUp` /
  `newUnlocks` / `achievementUnlocked`.

**Commits:** `5fe80c9`
**Tests:** 770 → 799 (+29)

---

### v1.0.0 — 18 achievements + responsive scaling + Yandex compliance (2026-06-24)

- **18 achievements** in 5 categories (combat / collection / milestone /
  progression / fun). `AchievementService` (pure, immutable) +
  `AchievementsScene` (grid UI) + `AchievementNotification` (slide-in
  popup with queue).
- **Progression system** — 10 levels with XP thresholds and unlocks
  (bots / maps / titles). `ProgressionService.applyXp` returns
  `{profile, levelUp}` with `newUnlocks`.
- **Profile v2** — 6 new fields: `xp`, `level`, `achievements`,
  `currentWinStreak`, `maxWinStreak`, `powerUpTypesUsed`, `mapsPlayed`,
  `p2GamesPlayed`. Migration-safe (`migrateProfile` walks each field).
- **6 power-up types** — `speed`, `knockback`, `shield`, `mega-knockback`,
  `freeze`, `double-slap`. Each with its own PNG sprite and i18n label.
- **Animated sprites** — `player-idle` / `player-walk` / `player-slap` /
  `player-fall` for both P1 and opponent; effect tints for power-ups.
- **Pause menu** — soft-pause (`isPaused` flag) so input stays active;
  inline volume sliders forward global pointer events.
- **RU/EN localization** — `I18nService` with 160+ keys, auto-detect
  from `navigator.language`, persisted preference overrides.
- **Yandex Games SDK** — `/sdk.js`, `LoadingAPI.ready()`, interstitial
  (2-min cooldown) + rewarded ads, visibility handler pauses audio.
- **Responsive design** — `Scale.RESIZE` + `computeArenaDimensions`
  computes arena from viewport; `computeUIScale` 0.5–1.3.
- **500 bot nicknames** manifest + `resolveNicknames` helper.
- **Combat improvements** — combo system (×1.5 at 3 stacks, ×3.0 at 5),
  dodge i-frames (200ms, 1.5s cooldown), comeback (Rage buff at gap ≥3).
- **Yandex compliance** — feedback email `seme4kak@yandex.ru`,
  `user-select: none`, `overscroll-behavior: none`, `touch-action: none`,
  no debug features in production builds.

**Commits:** `f467d17`, `3ea9a0a`, `03939e4`, `9101457`, `db989d3`,
`5139e99`, `f55b380`, `06d441c`, `8fe70f6`, `0b9ad57`, `589ae93`

---

## Architecture

### Scenes (10 initial + 2 lazy = 12 total)

| # | Scene | Role |
|---|---|---|
| 1 | `BootScene` | Initial setup, hands off to Preload |
| 2 | `PreloadScene` | Asset loading, "Loading..." text, emits `ready` |
| 3 | `MainMenuScene` | Title + 5 navigation buttons |
| 4 | `BattleSetupScene` | Mode selection, nickname resolution, "Внешний вид" button |
| 5 | `AudioSettingsScene` | Volume sliders for SFX + Music, mute toggles |
| 6 | `ProfileScene` | Player nickname, stats, win rate, favorite mode/power-up |
| 7 | `ProgressScene` | Levels + Achievements (tabbed, replaces 2 old scenes) |
| 8 | `CosmeticsScene` | 5-category cosmetic picker (P1/P2 toggle in 2P) |
| 9 | `ShopScene` | IAP shop — 18 items + 6 packs, buy/restore |
| 10 | (lazy) `BattleScene` | Code-split via dynamic import |
| 11 | (lazy) `ResultsScene` | Code-split via dynamic import |
| 12 | `ProgressionScene` + `AchievementsScene` | Dead code (replaced by ProgressScene) |

### Key systems

- **`processBattleEnd`** — pure helper that runs the end-of-battle
  pipeline. Input: `{profile, result, ctx}`. Output: `{updatedProfile,
  xpGained, levelUp, newlyUnlocked, xpDoubled, mode}`. In 2P-local mode
  records stats with `outcome: "neutral"` (no XP, no streaks) so
  `social` / `all_maps` / `veteran` are reachable via 2P play.
- **`applyRewardedXp`** — pure helper for the ×2 XP rewarded-ad bonus.
  Runs `applyXp` + `checkLevel`, merges new level-achievements with the
  original `newlyUnlocked`, and returns an updated `BattleEndOutput`
  with `xpDoubled: true`. Used by ResultsScene so level-ups from
  rewarded XP correctly unlock `level_5` / `level_10` and show the
  "Level up!" banner.
- **`AchievementService`** — pure, immutable. `checkBattleEnd` (16
  battle-based achievements) + `checkLevel` (2 level-based:
  `level_5`, `level_10`). Returns `{updatedProfile, newlyUnlocked}`.
- **`ProgressionService`** — `calculateXp` (base + ringOuts×20 +
  powerUps×10), `applyXp` (returns `{profile, levelUp}` with
  `newUnlocks`), `getProgressToNextLevel`.
- **`ProfileService`** — in-memory wrapper, owns streaks / maps /
  power-up types / p2 counter / mode counts.
- **`AudioService`** — shared singleton via Phaser registry
  (`getAudioService`), survives scene transitions. `IAudioBackend`
  with `PhaserAudioBackend` / `NoopAudioBackend`.
- **`CombatSystem`** — `applySlap` (combo multiplier + dodge i-frames +
  double-slap), `getComboMultiplier` (1.0 / 1.5 / 3.0), `isRingOut`
  (bounding-box edge detection).
- **`PowerUpSystem`** — `spawnPowerUp(now?)`, `tryCollectPowerUp`,
  `shouldDespawnPowerUp`, `despawnPowerUp` (300ms fade). All timers use
  the caller's `now` for time-base consistency.
- **`DodgeSystem`** — `startDodge` (200ms i-frames, 1.5s cooldown),
  `isDodging`, `canDodge`.
- **`RingOutFX`** — camera shake + fall tween + flash; `resetOffender`
  deferred to `onComplete`.
- **`YandexSDK`** — wrapper with graceful fallback. `init`,
  `getLanguage`, `isAvailable`, `showFullscreenAd` (2-min cooldown),
  `showRewardedAd`.
- **`I18nService`** — auto-detect, persisted preference, `t(key)`.

### Asset pipeline

- Manifest-driven: `spriteManifest`, `soundManifest`, `mapManifest`,
  `achievements` — single source of truth, referenced by code + tests.
- All visual assets (backgrounds, platforms, logos, mute buttons, sprite
  states, power-up icons) generated via Python PIL scripts and committed
  as PNGs.
- All sound effects are `.ogg` (Yandex Games format requirement).

---

## Test coverage

- **1020 tests** across **60 test files**.
- **TDD methodology** — every bugfix and feature goes RED → GREEN:
  - RED: write failing tests that pin the desired behavior.
  - GREEN: implement the minimum code to make tests pass.
- Pure helpers (services, systems, cosmetics) are unit-tested with
  duck-typed stubs; no Phaser runtime needed in tests.
- Scene tests are smoke tests (constructor doesn't throw) — full
  integration is verified manually.

---

## Project structure

```
arena-slaps/
├── index.html              # /sdk.js script tag, viewport meta
├── package.json            # Phaser 3.80, TypeScript 5.5, Vite 5.4, Vitest 2.1
├── vite.config.js
├── tsconfig.json
├── scripts/                # Python PIL sprite generators (cosmetics, etc.)
├── public/
│   ├── sounds/             # .ogg SFX + music
│   └── sprites/            # 48 PNG sprites (characters, effects, headwear, trails, slapFx)
└── src/
    ├── main.ts             # YandexSDK.init, visibilitychange handler
    ├── styles.css          # overscroll-behavior, user-select, touch-action
    └── game/
        ├── gameConfig.ts   # 10 scenes, Scale.RESIZE
        ├── audio/          # IAudioBackend, AudioService, getAudioService
        ├── config/         # battleConfig, profile, progression, achievements, powerUpConfig, mapManifest, translations, responsive, CosmeticsManifest
        ├── cosmetics/      # resolveCosmetics, CosmeticsPickerState, CosmeticVisuals (new)
        ├── entities/       # Player, Bot, PowerUp
        ├── systems/        # CombatSystem, PowerUpSystem, DodgeSystem, AntiCampSystem, RingOutFX, RoundSystem, ScoringSystem, BattleResults, BotAI, InputDirection
        ├── services/       # ProfileService, ProgressionService, AchievementService, processBattleEnd, applyRewardedXp
        ├── scenes/         # 10 scenes (BattleScene + ResultsScene lazy-loaded)
        ├── sprites/        # AnimatedSprite, PowerUpSprite, actorAnimations
        ├── ui/             # StyledButton, VolumeSlider, PauseMenu, AchievementNotification, formatResultsSummary, Background, TopRightMuteButton, LanguageToggle
        ├── i18n/           # I18nService
        └── yandex/         # SDK wrapper
```

---

## Yandex Games compliance

- ✅ `/sdk.js` loaded in `index.html`
- ✅ `LoadingAPI.ready()` called after PreloadScene
- ✅ Interstitial ads at logical pauses (2-min cooldown)
- ✅ Rewarded ads (×2 XP) — optional, only shown in 1P-vs-bot mode
- ✅ Audio pauses on `visibilitychange` (hidden tab)
- ✅ Auto-language detection from SDK
- ✅ Feedback email (`seme4kak@yandex.ru`) in main menu
- ✅ No test/debug features in production builds (debug combos gated
  behind `!YandexSDK.isAvailable()`)
- ✅ `user-select: none`, `overscroll-behavior: none`, `touch-action:
  none` (prevents unwanted scroll/zoom on mobile)

---

## Known limitations / Future work

- **No mobile touch controls.** Touch input was removed because the
  on-screen buttons were visually inconsistent with the neon style. A
  proper touch joystick + slap button could be added later. Keyboard
  + click/tap on the arena works on all platforms.
- **`all_powerups` achievement** is mathematically reachable (all 6
  real power-up types now match `ALL_POWERUP_TYPES`), but in practice
  it's hard — only one power-up is active at a time and the despawn
  timer is 8s. Could be relaxed to "across the player's career"
  (`powerUpTypesUsed` already tracks this) for a more attainable goal.
- **`all_maps` achievement** is reachable — all 6 maps ship
  (`arena-default`, `arena-neon`, `arena-cosmic`, `arena-volcano`,
  `arena-ice`, `arena-grass`) and `ALL_MAPS` matches the manifest.
  Note: 5 of the 6 maps are progression-gated, so the player must
  reach level 8 to unlock all of them (Variant B layout).
- **Cosmetics: color category removed** — the `color` cosmetic
  category was removed because Phaser's `setTint` on PNG sprites
  produced unreliable results (muddy/invisible colors). If color
  customization is desired in the future, it would require
  reskinned PNGs per color (not tinting) or a vector-based sprite
  system.
- **IAP: products must be registered in Yandex Developer Console** —
  the 27 product IDs in `IAPManifest.ts` must be manually registered
  in the Yandex Developer Console (developer.yandex.ru) with matching
  IDs, prices, descriptions (RU/EN), and icons. Until registered,
  `iapGetCatalog()` returns [] and purchases will fail. This is a
  manual step outside the codebase.
- **IAP: no server-side verification** — purchases are verified
  client-side only (via Yandex SDK's signed purchase tokens). For
  production, server-side verification is recommended but not
  required for MVP.
- **Anti-camp: campers who never slap aren't slowed** — fresh actors
  (lastSlapAt = -Infinity) are always full speed. This was a
  deliberate trade-off: depending on `battleStartAt` caused worse UX
  (slow start after long menu idle due to Phaser scene reuse). A
  camper who never engages isn't a real threat anyway.
- **Vite chunk-size warning** — the main bundle is 1.6 MB (370.65 KB
  gzip). Could be reduced via manual chunk splitting or by moving
  more scenes to dynamic imports.
