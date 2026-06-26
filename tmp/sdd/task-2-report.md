# Task 2 Report: Restyle Shared UI Primitives And Overlay Components

## Status

DONE

## Scope Completed

- Created `src/game/ui/neonPrimitives.ts` with shared `drawNeonPanel(...)`.
- Restyled `Background` to keep its existing contract while adding a neon ink overlay when a texture-backed background is used.
- Restyled `TopRightMuteButton` with shared neon chrome without changing its API or toggle behavior.
- Restyled `VolumeSlider` with neon graphics chrome while preserving its existing snapping, drag, and value behavior.
- Restyled `PauseMenu` with a framed neon overlay panel while preserving pause/settings interactions and slider forwarding.
- Updated the owned focused tests to assert the new graphics/panel layers while preserving prior behavior checks.

## TDD Flow

1. Updated the owned test files first to assert the new overlay/panel graphics:
   - `src/game/ui/Background.test.ts`
   - `src/game/ui/TopRightMuteButton.test.ts`
   - `src/game/ui/VolumeSlider.test.ts`
   - `src/game/ui/PauseMenu.test.ts`
2. Ran the focused suite red:
   - `npm test -- src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`
   - Result: failed for the expected reason, because the current implementations did not yet create the new graphics overlays/chrome.
3. Implemented the minimal production changes in the owned files.
4. Re-ran the same focused suite green.

## Verification

- Focused tests:
  - `npm test -- src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`
  - Result: 4 files passed, 81 tests passed.
- Build:
  - `npm run build`
  - Result: passed.

## Notes

- Public APIs and behavior contracts for `createBackground`, `createTopRightMuteButton`, `createVolumeSlider`, and `createPauseMenu` were preserved.
- No gameplay logic, progression, achievements, economy, or persistence semantics were changed.
- The initial sandboxed build attempt failed on filesystem access; the rerun with elevated access succeeded, indicating an environment constraint rather than a code regression.

## Files Changed

- `src/game/ui/neonPrimitives.ts`
- `src/game/ui/Background.ts`
- `src/game/ui/TopRightMuteButton.ts`
- `src/game/ui/VolumeSlider.ts`
- `src/game/ui/PauseMenu.ts`
- `src/game/ui/Background.test.ts`
- `src/game/ui/TopRightMuteButton.test.ts`
- `src/game/ui/VolumeSlider.test.ts`
- `src/game/ui/PauseMenu.test.ts`

## Concerns

- None.

## Fix Wave: Background Contract Preservation

### Issue Fixed

- The texture-backed `createBackground(...)` path returned the image object while keeping the neon overlay as an independent graphics layer.
- That meant common caller mutations on `background.gameObject`, especially `setDepth(...)`, `setAlpha(...)`, and direct `destroy()`, did not propagate to the overlay.

### Root Cause

- The overlay was created beside the returned game object, but was not attached to that object's mutation and destruction lifecycle.

### Fix

- Kept the returned `background.gameObject` contract intact by decorating the texture-backed image object in place rather than replacing it with a wrapper/container.
- Synced these common mutations from the returned object to the overlay:
  - `setDepth(...)`
  - `setAlpha(...)`
  - `destroy()`
- Preserved the overlay's relative depth offset at `primary depth + 1`.
- Kept the fix wave narrow to:
  - `src/game/ui/Background.ts`
  - `src/game/ui/Background.test.ts`

### Focused Regression Coverage Added

- Verified that calling `setDepth(...)` on the returned object also updates the overlay depth.
- Verified that calling `setAlpha(...)` on the returned object also updates the overlay alpha.
- Verified that directly destroying the returned texture-backed object also destroys the overlay.

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/Background.test.ts`
  - Result before fix: 3 failing tests covering overlay depth sync, alpha sync, and direct-destroy lifecycle sync.
- Green:
  - `npm test -- src/game/ui/Background.test.ts`
  - Result after fix: 1 file passed, 12 tests passed.

## Second Fix Wave: Scroll-Factor Contract And Theme Consumption

### Issues Fixed

- Extended the texture-backed `createBackground(...)` contract preservation so overlay scroll factor stays in sync with the returned `background.gameObject`.
- Removed avoidable hardcoded neon literals from remaining Task 2 helpers and routed them through shared Task 1 theme interfaces where practical.

### Root Causes

- `Background` decorated `setDepth(...)`, `setAlpha(...)`, and `destroy()`, but not the documented scroll-factor mutation path.
- Several Task 2 helpers still embedded direct neon values instead of consistently consuming `NEON_COLORS`, `NEON_PANEL`, and `getHudTextStyle()`.

### Fixes

- `src/game/ui/Background.ts`
  - Added texture-overlay sync for `setScrollFactor(...)`.
- `src/game/ui/Background.test.ts`
  - Added regression coverage proving overlay scroll-factor sync.
- `src/game/ui/TopRightMuteButton.ts`
  - Routed neon chrome colors/radii and fallback text styling through shared theme tokens/helpers.
- `src/game/ui/VolumeSlider.ts`
  - Routed slider chrome colors, border widths, radii, and label styling through shared theme tokens/helpers.
- `src/game/ui/PauseMenu.ts`
  - Routed overlay ink color and title/label typography through shared theme tokens/helpers.
- `src/game/ui/PauseMenu.test.ts`
  - Updated the overlay-color assertion to match the shared theme token now consumed by the implementation.

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/Background.test.ts`
  - Result before fix: 1 failing test covering missing scroll-factor sync on the texture overlay path.
- Green:
  - `npm test -- src/game/ui/Background.test.ts src/game/ui/TopRightMuteButton.test.ts src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`
  - Result after fix: 4 files passed, 85 tests passed.

## Final Fix Wave: VolumeSlider Chrome Cleanup

### Issue Fixed

- `src/game/ui/VolumeSlider.ts` created three Task 2 chrome graphics objects for the track, fill, and handle, but `destroy()` only removed hit-zone listeners and left those graphics alive.

### Root Cause

- The Task 2 visual chrome was added as separate graphics objects with independent lifecycles, but `destroy()` was never extended to tear them down.

### Fix

- Updated `VolumeSlider.destroy()` to:
  - remove hit-zone listeners
  - destroy the track chrome graphics object
  - destroy the fill chrome graphics object
  - destroy the handle chrome graphics object

### Scope

- Kept this wave narrow to:
  - `src/game/ui/VolumeSlider.ts`
  - `src/game/ui/VolumeSlider.test.ts`
- Skipped the optional `TopRightMuteButton` primitive refactor to avoid unnecessary scope expansion.

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/VolumeSlider.test.ts`
  - Result before fix: 1 failing test proving `destroy()` did not tear down the task-added chrome graphics objects.
- Green:
  - `npm test -- src/game/ui/VolumeSlider.test.ts`
  - Result after fix: 1 file passed, 18 tests passed.

## Narrow Fix Wave: VolumeSlider / PauseMenu Destroy Ownership

### Issue Fixed

- Resolved the double-destroy ownership conflict between `VolumeSlider.destroy()` and `PauseMenu.destroy()` for slider-owned chrome graphics.

### Root Cause

- `PauseMenu` tracks slider-created primitives so it can toggle their visibility with the rest of the settings panel.
- After Task 2, `VolumeSlider.destroy()` correctly started destroying its own chrome graphics.
- `PauseMenu.destroy()` still destroyed every tracked primitive after calling `slider.destroy()`, so slider-owned chrome was being destroyed twice.

### Fix

- Added an explicit slider-owned marker in `src/game/ui/VolumeSlider.ts`:
  - `VOLUME_SLIDER_OWNED_KEY = "__volumeSliderOwned"`
- Marked slider-created chrome graphics with that ownership key when they are created.
- Updated `src/game/ui/PauseMenu.ts` so `destroy()` skips tracked primitives marked as slider-owned after delegating to `slider.destroy()`.
- Kept slider-owned chrome visible/toggleable through the existing `settingsPrimitives` tracking path; only teardown ownership changed.

### Focused Regression Coverage

- `src/game/ui/VolumeSlider.test.ts`
  - Verifies slider-created chrome graphics carry the slider-owned marker.
  - Preserves the existing `destroy()` coverage that slider-owned chrome is destroyed by the slider itself.
- `src/game/ui/PauseMenu.test.ts`
  - Verifies `PauseMenu.destroy()` does not double-destroy slider-owned chrome after calling `slider.destroy()`.

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`
  - Result before fix: `PauseMenu` destroy-path failures reproduced the double-destroy conflict, and the slider marker expectation initially failed before the production marker was added.
- Green:
  - `npm test -- src/game/ui/VolumeSlider.test.ts src/game/ui/PauseMenu.test.ts`
  - Result after fix: 2 files passed, 59 tests passed.

## Last Narrow Fix Wave: Background Visibility Contract

### Issue Fixed

- Extended the texture-backed `createBackground(...)` contract preservation so calling `setVisible(...)` on the returned `background.gameObject` also hides/shows the neon overlay.

### Root Cause

- `Background` already mirrored depth, alpha, scroll factor, and destroy through the returned image object, but `setVisible(...)` was still not forwarded to the overlay layer.

### Fix

- Added `setVisible(...)` forwarding in `src/game/ui/Background.ts` for the texture-backed overlay path.
- Added focused regression coverage in `src/game/ui/Background.test.ts` proving overlay visibility stays in sync when callers hide and re-show the returned object.

### Small Cleanup

- Updated the stale `src/game/ui/VolumeSlider.ts` comment so it matches current behavior:
  - the lime fill is rendered by slider-owned chrome graphics
  - the hidden fill rectangle remains only as width/x bookkeeping state

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/Background.test.ts`
  - Result before fix: 1 failing test covering missing overlay visibility sync.
- Green:
  - `npm test -- src/game/ui/Background.test.ts`
  - Result after fix: 1 file passed, 14 tests passed.

## Narrow Fix Wave: TopRightMuteButton Shared Primitive Consumption

### Issue

- `src/game/ui/TopRightMuteButton.ts` still drew mute-button neon chrome locally in `createButtonChrome(...)` instead of consuming the shared Task 2 primitive `drawNeonPanel(...)`.

### Root Cause

- The Task 2 visual restyle for the mute button reused shared colors/text styling, but stopped short of routing the chrome rendering itself through the shared panel primitive.

### Fix

- Removed the local duplicated neon-panel drawing path from `TopRightMuteButton.ts`.
- Switched mute-button chrome creation to `drawNeonPanel(...)` with the same panel footprint, preserving the existing API and interaction behavior.
- Narrowly updated `TopRightMuteButton.test.ts` to verify the shared-primitive path directly by mocking and asserting the `drawNeonPanel(...)` call instead of asserting local graphics drawing internals.

### Focused Test Evidence

- Red:
  - `npm test -- src/game/ui/TopRightMuteButton.test.ts`
  - Result before fix: 1 failing test because the new shared-primitive expectation was not met; `drawNeonPanel(...)` was never called.
- Green:
  - `npm test -- src/game/ui/TopRightMuteButton.test.ts`
  - Result after fix: 1 file passed, 15 tests passed.
