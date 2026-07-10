# Desktop canvas input protection

## Goal

Meet Yandex Games requirement 1.6.2.7 by preventing text selection and the browser context menu while interacting with the Arena Slaps game canvas on desktop.

## Root cause

The game config does not set Phaser's `disableContextMenu` flag. Phaser prevents ordinary mouse down, up, and move defaults, but the `contextmenu` event remains enabled by default. Canvas also lacks explicit desktop selection-prevention CSS.

## Chosen approach

Set `disableContextMenu: true` in the Phaser game configuration. Phaser then attaches a `contextmenu` listener to the canvas that calls `preventDefault()`. Add explicit `user-select` and WebKit selection/touch-callout rules to `canvas` as defence in depth.

## Changes

1. Add a focused game-config test for `disableContextMenu`.
2. Add the configuration flag to `gameConfig`.
3. Add the canvas selection-prevention CSS declarations.

## Verification

Run the focused test, complete test suite, type check, and production build. The exact desktop interaction must be checked manually in the Yandex Games test environment; automated unit tests prove the Phaser configuration is passed to the game.

## Non-goals

No global event listeners, no right-click game control, no gameplay or mobile-input changes.
