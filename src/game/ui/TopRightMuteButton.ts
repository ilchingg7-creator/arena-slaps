/**
 * A reusable top-right mute button for any scene.
 *
 * Renders a text label at the top-right corner of the screen that toggles
 * both SFX and Music mute when clicked. The label shows "🔇 Muted" when
 * both are muted, "🔊 Sound" otherwise.
 *
 * The button does NOT own settings — it reads the initial state and calls
 * `onChange` with the new state. The scene is responsible for persisting
 * to localStorage and updating the AudioService.
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
  };
  scale?: {
    width?: number;
    height?: number;
  };
};

type MuteButtonText = {
  setOrigin: (x?: number, y?: number) => MuteButtonText;
  setInteractive: (config?: { useHandCursor?: boolean }) => MuteButtonText;
  on: (event: string, handler: () => void) => MuteButtonText;
  setText: (value: string) => MuteButtonText;
};

export type MuteButtonState = {
  sfxMuted: boolean;
  musicMuted: boolean;
};

export type TopRightMuteButton = {
  setState: (state: MuteButtonState) => void;
  isMasterMuted: () => boolean;
};

function labelFor(state: MuteButtonState): string {
  const masterMuted = state.sfxMuted && state.musicMuted;
  return masterMuted ? "🔇 Muted" : "🔊 Sound";
}

function backgroundColorFor(state: MuteButtonState): string {
  const masterMuted = state.sfxMuted && state.musicMuted;
  return masterMuted ? "#e07a5f" : "#3d405b";
}

export function createTopRightMuteButton(
  scene: MuteButtonSceneLike,
  initialState: MuteButtonState,
  onChange: (next: MuteButtonState) => void,
): TopRightMuteButton {
  const width = scene.scale?.width ?? 1280;
  const margin = 20;

  let state: MuteButtonState = { ...initialState };

  const button = scene.add
    .text(width - margin, margin, labelFor(state), {
      align: "center",
      backgroundColor: backgroundColorFor(state),
      color: "#f4f1de",
      fontFamily: "Arial",
      fontSize: "18px",
      padding: { x: 14, y: 8 },
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });

  const toggle = () => {
    const masterMuted = state.sfxMuted && state.musicMuted;
    if (masterMuted) {
      // Unmute both
      state = { sfxMuted: false, musicMuted: false };
    } else {
      // Mute both
      state = { sfxMuted: true, musicMuted: true };
    }
    button.setText(labelFor(state));
    // Re-set style by recreating the visual — Phaser text objects don't
    // support changing backgroundColor after creation, so we accept the
    // initial color. The label text change is sufficient to indicate state.
    onChange(state);
  };

  button.on("pointerup", toggle);

  return {
    setState(next: MuteButtonState) {
      state = { ...next };
      button.setText(labelFor(state));
    },
    isMasterMuted() {
      return state.sfxMuted && state.musicMuted;
    },
  };
}
