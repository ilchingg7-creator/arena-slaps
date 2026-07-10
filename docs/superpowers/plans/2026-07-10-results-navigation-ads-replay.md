# Results Navigation Ads and Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move interstitial ads from battle completion to ResultsScene navigation and add replay with identical match data.

**Architecture:** BattleScene enters ResultsScene after its end sting without an ad. ResultsScene centralizes guarded `showFullscreenAd` navigation for menu and replay; replay reads existing `settings` and `nicknames` registry values.

**Tech Stack:** TypeScript, Phaser 3.90, Vitest, Yandex Games SDK.

## Global Constraints

- Ads are requested only after an explicit ResultsScene button action.
- Replay preserves settings and nicknames exactly.
- The SDK close callback is the only transition point after requesting an ad.

---

### Task 1: Move ad timing from battle completion

**Files:** `src/game/scenes/BattleScene.ts`, `src/game/scenes/BattleScene.test.ts`

- [ ] Add a failing test proving battle completion starts `ResultsScene` without calling `YandexSDK.showFullscreenAd`.
- [ ] Replace the delayed `showFullscreenAd(() => this.scene.start("ResultsScene"))` block with the same delayed direct scene transition.
- [ ] Run `npm.cmd test -- src/game/scenes/BattleScene.test.ts` and commit `fix: defer battle ads to results navigation`.

### Task 2: Add guarded ad-backed replay and menu navigation

**Files:** `src/game/scenes/ResultsScene.ts`, `src/game/scenes/ResultsScene.test.ts`, `src/game/config/translations.ts`

- [ ] Add failing tests for menu navigation after ad close and replay payload `{ settings, playerNickname, botNickname, player2Nickname }` after ad close.
- [ ] Add `results.replay` RU/EN translation, a guarded navigation helper, the replay button, and route both buttons plus Enter through it.
- [ ] Run focused ResultsScene tests, then `npm.cmd test` and `npm.cmd run build`; commit `feat: add ad-backed replay from results`.

## Self-review

- The two tasks cover ad timing, both buttons, repeated click guarding, localized copy, and exact replay data.
