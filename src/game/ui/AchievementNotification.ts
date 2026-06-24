/**
 * AchievementNotification — a slide-in popup shown when the player unlocks an
 * achievement.
 *
 * Layout: a dark rounded background rectangle with a large emoji icon on the
 * left and the achievement name in bold white text on the right.
 *
 * Animation contract (per spec):
 *   - Initially hidden (alpha 0, y = -100).
 *   - `show(icon, name)`:
 *       1. Tween y from -100 to 60 + alpha from 0 to 1 over 300ms (slide-in).
 *       2. After 2500ms, tween alpha to 0 + y back to -100 over 500ms
 *          (slide-out).
 *       3. If `show()` is called while a notification is already on screen,
 *          the new one is queued and shown after the current one finishes.
 *   - Depth 200 (above everything except the pause menu).
 *
 * Like {@link ./VolumeSlider.ts VolumeSlider}, this component uses a minimal
 * duck-typed scene shape so it can be unit-tested without loading Phaser.
 */

export type NotificationSceneLike = {
  add: {
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
    ) => NotificationRectangle;
    text: (
      x: number,
      y: number,
      value: string,
      style?: {
        align?: string;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        fontStyle?: string;
        padding?: { x?: number; y?: number };
      },
    ) => NotificationText;
    container: (
      x: number,
      y: number,
      children?: unknown[],
    ) => NotificationContainer;
  };
  tweens: {
    add: (config: TweenConfig) => unknown;
  };
  time?: {
    delayedCall?: (
      ms: number,
      callback: () => void,
    ) => { remove: () => void };
  };
};

export type NotificationRectangle = {
  setOrigin: (x?: number, y?: number) => NotificationRectangle;
  setDepth: (depth: number) => NotificationRectangle;
  width: number;
  height: number;
};

export type NotificationText = {
  setOrigin: (x?: number, y?: number) => NotificationText;
  setDepth: (depth: number) => NotificationText;
  setText: (value: string) => NotificationText;
};

export type NotificationContainer = {
  setDepth: (depth: number) => NotificationContainer;
  setAlpha: (alpha: number) => NotificationContainer;
  setPosition: (x: number, y: number) => NotificationContainer;
  add: (child: unknown) => NotificationContainer;
  destroy: () => void;
  alpha: number;
  x: number;
  y: number;
};

export type TweenConfig = {
  targets: unknown;
  y?: number;
  alpha?: number;
  duration: number;
  delay?: number;
  onComplete?: () => void;
  onStart?: () => void;
};

export type AchievementNotification = {
  /** Show a notification for the given achievement. Queues if one is showing. */
  show: (icon: string, name: string) => void;
  /** Destroy the notification (cancels pending tweens + queue). */
  destroy: () => void;
};

const NOTIFICATION_DEPTH = 200;
const SLIDE_IN_DURATION_MS = 300;
const HOLD_DURATION_MS = 2500;
const SLIDE_OUT_DURATION_MS = 500;
const HIDDEN_Y = -100;
const VISIBLE_Y = 60;
const BG_COLOR = 0x101820;
const BG_WIDTH = 480;
const BG_HEIGHT = 90;
const ICON_FONT_SIZE = "44px";
const NAME_FONT_SIZE = "24px";

/**
 * Build an {@link AchievementNotification} attached to the given scene. The
 * notification starts hidden; the caller invokes `show(icon, name)` when an
 * achievement is unlocked.
 */
export function createAchievementNotification(
  scene: NotificationSceneLike,
): AchievementNotification {
  // Container holds the background + icon + name text. We move the container
  // (rather than its children) so the slide-in/slide-out tweens affect the
  // whole popup atomically.
  const container = scene.add.container(0, HIDDEN_Y);
  container.setAlpha(0);
  container.setDepth(NOTIFICATION_DEPTH);

  const bg = scene.add
    .rectangle(0, 0, BG_WIDTH, BG_HEIGHT, BG_COLOR)
    .setOrigin(0.5, 0.5)
    .setDepth(NOTIFICATION_DEPTH);
  container.add(bg);

  const icon = scene.add
    .text(-BG_WIDTH / 2 + 56, 0, "", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: ICON_FONT_SIZE,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(NOTIFICATION_DEPTH);
  container.add(icon);

  const name = scene.add
    .text(40, 0, "", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: NAME_FONT_SIZE,
      fontStyle: "bold",
      padding: { x: 8, y: 4 },
    })
    .setOrigin(0, 0.5)
    .setDepth(NOTIFICATION_DEPTH);
  container.add(name);

  // Queue of pending (icon, name) pairs shown after the current animation
  // finishes. Each entry corresponds to one show() call made while a
  // notification was already on screen.
  const queue: Array<{ icon: string; name: string }> = [];
  let showing = false;
  let destroyed = false;
  let activeDelayedCall: { remove: () => void } | null = null;

  function playOut(): void {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: HIDDEN_Y,
      duration: SLIDE_OUT_DURATION_MS,
      onComplete: () => {
        showing = false;
        // If there's a queued notification, play it now.
        const next = queue.shift();
        if (next) {
          playShow(next.icon, next.name);
        }
      },
    });
  }

  function playShow(iconText: string, nameText: string): void {
    showing = true;
    icon.setText(iconText);
    name.setText(nameText);
    container.setPosition(0, HIDDEN_Y);
    container.setAlpha(0);

    // Slide-in tween: y -> VISIBLE_Y, alpha -> 1 over 300ms.
    scene.tweens.add({
      targets: container,
      y: VISIBLE_Y,
      alpha: 1,
      duration: SLIDE_IN_DURATION_MS,
      onComplete: () => {
        // Hold for 2500ms then slide out.
        if (scene.time?.delayedCall) {
          activeDelayedCall = scene.time.delayedCall(
            HOLD_DURATION_MS,
            () => {
              activeDelayedCall = null;
              if (destroyed) {
                return;
              }
              playOut();
            },
          );
        } else {
          // No delayedCall available (test environment) — schedule via setTimeout.
          const handle = setTimeout(() => {
            activeDelayedCall = null;
            if (destroyed) {
              return;
            }
            playOut();
          }, HOLD_DURATION_MS);
          activeDelayedCall = {
            remove: () => clearTimeout(handle),
          };
        }
      },
    });
  }

  function show(iconText: string, nameText: string): void {
    if (destroyed) {
      return;
    }
    if (showing) {
      // Queue this entry; it'll be played after the current notification
      // finishes its slide-out.
      queue.push({ icon: iconText, name: nameText });
      return;
    }
    playShow(iconText, nameText);
  }

  function destroy(): void {
    destroyed = true;
    queue.length = 0;
    activeDelayedCall?.remove();
    activeDelayedCall = null;
    container.destroy();
  }

  return { show, destroy };
}
