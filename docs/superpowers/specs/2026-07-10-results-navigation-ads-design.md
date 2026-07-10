# Results navigation ads and replay

## Goal

Show the interstitial ad only when the player chooses a post-battle destination, and let the player repeat the same match.

## Flow

1. Battle transitions directly to ResultsScene after the end sting; no interstitial is shown.
2. ResultsScene adds a localized `Repeat` button.
3. `Repeat` requests an interstitial, then starts BattleScene with the settings and nickname pair saved for the completed battle.
4. `Back to menu` requests an interstitial, then starts MainMenuScene.
5. While either navigation is pending, further button presses and Enter are ignored.

## Data

The existing Phaser registry already holds the completed battle's `settings` and `nicknames`. Replay passes those values as BattleScene init data, preserving map, mode, difficulty, round duration, winning score, and both displayed nicknames.

## Error handling

`YandexSDK.showFullscreenAd` already invokes the close callback immediately when the SDK is unavailable or the cooldown skips an ad, so navigation still proceeds.

## Verification

Add unit tests for navigation callbacks and replay payload. Run focused and full tests and production build. Manual Yandex verification: finish a battle, verify no automatic ad, then verify both buttons show/skip the ad before navigating.
