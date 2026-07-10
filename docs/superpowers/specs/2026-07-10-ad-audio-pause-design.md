# Ad audio pause

## Goal

Meet Yandex Games requirement 4.7 by stopping game audio while any fullscreen or rewarded ad is visible.

## Design

Extend the SDK ad wrappers with optional open callbacks and forward the platform `onOpen` event. Every ResultsScene ad call stops the shared AudioService on open. Navigation after an interstitial starts the destination scene, which starts its normal music; rewarded-ad close restores menu music only when no transition occurs and music is not muted.

## Scope

Cover interstitial navigation and the optional rewarded XP video. Preserve dev and cooldown callbacks.

## Verification

Unit-test callback forwarding and audio stop/restore behavior; manually verify both formats in Yandex Games.
