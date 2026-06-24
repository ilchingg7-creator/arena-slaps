/**
 * A reusable top-right mute button for any scene.
 *
 * Uses two PNG sprites (mute-sound.png + mute-muted.png) instead of text
 * for better readability against any background. The sprites contain a
 * speaker icon + short label ("SOUND" / "MUTED") that works in both
 * RU and EN languages. The color (green vs red) reinforces the state.
 *
 * The button does NOT own settings — it reads the initial state and calls
 * `onChange` with the new state. The scene is responsible for persisting
 * to localStorage and updating the AudioService.
 *
 * Falls back to a text label if the sprite textures are not loaded.
 */

export type MuteButtonSceneLike = {
  add: {
    text: (
      x: number,
      y: number,
      value: string,
      style?: {
        align?: string;
        backgroundColor?: string;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        padding?: { x?: number; y?: number };
      },
    ) => MuteButtonText;
    image: (x: number, y: number, key: string) => MuteButtonImage;
  };
  scale?: {
    width?: number;
    height?: number;
  };
  textures?: {
    exists: (key: string) => boolean;
  };
};

type MuteButtonText = {
  setOrigin: (x?: number, y?: number) => MuteButtonText;
  setInteractive: (config?: { useHandCursor?: boolean }) => MuteButtonText;
  on: (event: string, handler: () => void) => MuteButtonText;
  setText: (value: string) => MuteButtonText;
  setVisible: (visible: boolean) => MuteButtonText;
};

type MuteButtonImage = {
  setOrigin: (x?: number, y?: number) => MuteButtonImage;
  setInteractive: (config?: { useHandCursor?: boolean }) => MuteButtonImage;
  on: (event: string, handler: () => void) => MuteButtonImage;
  setVisible: (visible: boolean) => MuteButtonImage;
  setTexture: (key: string) => MuteButtonImage;
};

export type MuteButtonState = {
  sfxMuted: boolean;
  musicMuted: boolean;
};

/**
 * Optional labels for the text fallback. When sprites are available, these
 * are ignored. When sprites are missing (e.g. in tests), the button falls
 * back to a text label using these strings.
 */
export type MuteButtonOptions = {
  soundLabel?: string;
  mutedLabel?: string;
};

export type TopRightMuteButton = {
  setState: (state: MuteButtonState) => void;
  isMasterMuted: () => boolean;
};

const DEFAULT_SOUND_LABEL = "🔊 Sound";
const DEFAULT_MUTED_LABEL = "🔇 Muted";

const SPRITE_SOUND = "mute-sound";
const SPRITE_MUTED = "mute-muted";

function isMasterMuted(state: MuteButtonState): boolean {
  return state.sfxMuted && state.musicMuted;
}

export function createTopRightMuteButton(
  scene: MuteButtonSceneLike,
  initialState: MuteButtonState,
  onChange: (next: MuteButtonState) => void,
  options?: MuteButtonOptions,
): TopRightMuteButton {
  const width = scene.scale?.width ?? 1280;
  const margin = 20;
  const soundLabel = options?.soundLabel ?? DEFAULT_SOUND_LABEL;
  const mutedLabel = options?.mutedLabel ?? DEFAULT_MUTED_LABEL;

  let state: MuteButtonState = { ...initialState };

  const spritesAvailable =
    scene.textures?.exists?.(SPRITE_SOUND) === true &&
    scene.textures?.exists?.(SPRITE_MUTED) === true;

  // --- Sprite-based button (preferred) ---
  if (spritesAvailable) {
    const initialKey = isMasterMuted(state) ? SPRITE_MUTED : SPRITE_SOUND;
    const soundImg = scene.add.image(width - margin, margin, SPRITE_SOUND)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    const mutedImg = scene.add.image(width - margin, margin, SPRITE_MUTED)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    const updateVisibility = () => {
      const muted = isMasterMuted(state);
      soundImg.setVisible(!muted);
      mutedImg.setVisible(muted);
    };
    updateVisibility();

    const toggle = () => {
      if (isMasterMuted(state)) {
        state = { sfxMuted: false, musicMuted: false };
      } else {
        state = { sfxMuted: true, musicMuted: true };
      }
      updateVisibility();
      onChange(state);
    };

    soundImg.on("pointerup", toggle);
    mutedImg.on("pointerup", toggle);

    return {
      setState(next: MuteButtonState) {
        state = { ...next };
        updateVisibility();
      },
      isMasterMuted() {
        return isMasterMuted(state);
      },
    };
  }

  // --- Text fallback (tests / missing sprites) ---
  const button = scene.add
    .text(width - margin, margin, isMasterMuted(state) ? mutedLabel : soundLabel, {
      align: "center",
      backgroundColor: isMasterMuted(state) ? "#e07a5f" : "#3d405b",
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "18px",
      padding: { x: 14, y: 8 },
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });

  const toggle = () => {
    if (isMasterMuted(state)) {
      state = { sfxMuted: false, musicMuted: false };
    } else {
      state = { sfxMuted: true, musicMuted: true };
    }
    button.setText(isMasterMuted(state) ? mutedLabel : soundLabel);
    onChange(state);
  };

  button.on("pointerup", toggle);

  return {
    setState(next: MuteButtonState) {
      state = { ...next };
      button.setText(isMasterMuted(state) ? mutedLabel : soundLabel);
    },
    isMasterMuted() {
      return isMasterMuted(state);
    },
  };
}
