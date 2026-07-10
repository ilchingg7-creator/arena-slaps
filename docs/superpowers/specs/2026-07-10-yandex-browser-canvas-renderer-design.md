# Canvas renderer for Yandex Browser stability

## Goal

Prevent Arena Slaps from losing its rendered images after repeated page reloads in Yandex Browser.

## Root cause

`Phaser.AUTO` selects the WebGL renderer. In the Yandex Games embed, repeated reloads can leave WebGL unable to create a valid framebuffer (`Framebuffer status: Incomplete Attachment`). Assets still load, but Phaser cannot draw them.

## Chosen approach

Force `Phaser.CANVAS` when creating the game. The current game features are Canvas-compatible: the outline cosmetic deliberately uses a geometric fallback instead of WebGL post-processing.

## Changes

1. Add a focused test asserting that the game is configured with the Canvas renderer.
2. Replace `Phaser.AUTO` with `Phaser.CANVAS` in `createGame`.
3. Add a `preview` package script so the declared Yandex audit serve command can run.

## Verification

Run the focused test, full test suite, type check, and production build. The Yandex audit will be rerun where the local browser harness is available; it cannot reproduce the Yandex Browser GPU condition locally.

## Non-goals

No asset-path changes, WebGL recovery mechanism, gameplay changes, or visual redesign.
