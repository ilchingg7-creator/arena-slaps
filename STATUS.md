# Arena Slaps — Status

**Version:** v1.2.0
**Last updated:** 2026-06-25
**Build:** `4.53s` · **Tests:** `804/804 passed (48 files)` · **tsc:** clean · **Bundle:** `361 KB gzip`

---

## Recent work (latest first)

### v1.2.0 — Bugfixes from code review (2026-06-25)

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

### Scenes (9 total, registered in `gameConfig.ts`)

| # | Scene | Role |
|---|---|---|
| 1 | `BootScene` | Initial setup, hands off to Preload |
| 2 | `PreloadScene` | Asset loading, "Loading..." text |
| 3 | `MainMenuScene` | Title + 5 navigation buttons |
| 4 | `BattleSetupScene` | Mode selection, nickname resolution, dynamic-imports BattleScene + ResultsScene |
| 5 | `AudioSettingsScene` | Volume sliders for SFX + Music, mute toggles |
| 6 | `ProfileScene` | Player nickname, stats, win rate, favorite mode/power-up |
| 7 | `ProgressionScene` | Level + XP bar + unlocks grid |
| 8 | `AchievementsScene` | 18-achievement grid (6×3), unlocked count |
| 9 | `BattleScene` (lazy) + `ResultsScene` (lazy) | Code-split via dynamic import |

### Key systems

- **`processBattleEnd`** — pure helper that runs the end-of-battle
  pipeline. Input: `{profile, result, ctx}`. Output: `{updatedProfile,
  xpGained, levelUp, newlyUnlocked, xpDoubled}`.
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

- **804 tests** across **48 test files**.
- **TDD methodology** — every bugfix and feature goes RED → GREEN:
  - RED: write failing tests that pin the desired behavior.
  - GREEN: implement the minimum code to make tests pass.
- Pure helpers (services, systems) are unit-tested with duck-typed
  stubs; no Phaser runtime needed in tests.
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
├── public/
│   └── sounds/             # .ogg SFX + music
└── src/
    ├── main.ts             # YandexSDK.init, visibilitychange handler
    ├── styles.css          # overscroll-behavior, user-select, touch-action
    └── game/
        ├── gameConfig.ts   # 9 scenes, Scale.RESIZE
        ├── audio/          # IAudioBackend, AudioService, getAudioService
        ├── config/         # battleConfig, profile, progression, achievements, powerUpConfig, mapManifest, translations, responsive
        ├── entities/       # Player, Bot, PowerUp
        ├── systems/        # CombatSystem, PowerUpSystem, DodgeSystem, RingOutFX, RoundSystem, ScoringSystem, BattleResults, BotAI, InputDirection
        ├── services/       # ProfileService, ProgressionService, AchievementService, processBattleEnd
        ├── scenes/         # 9 scenes (BattleScene + ResultsScene lazy-loaded)
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
- **`all_powerups` achievement** requires all 6 power-up types in a
  single battle — currently very unlikely since only one power-up is
  active at a time and the despawn timer is 8s. Could be relaxed to
  "across the player's career" (`powerUpTypesUsed` already tracks
  this) for a more attainable goal.
- **`all_maps` achievement** references 6 maps (`arena-default`,
  `arena-ice`, `arena-lava`, `arena-jungle`, `arena-space`,
  `arena-desert`) but only `arena-default` ships. The manifest has
  placeholders for the other 5 — they need to be authored as PNGs
  before the achievement is reachable.
- **Vite chunk-size warning** — the main bundle is 1.55 MB (361 KB
  gzip). Could be reduced via manual chunk splitting or by moving
  more scenes to dynamic imports.
