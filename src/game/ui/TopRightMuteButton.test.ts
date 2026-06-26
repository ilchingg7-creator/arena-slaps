import { describe, expect, it, vi } from "vitest";

const { drawNeonPanelMock } = vi.hoisted(() => ({
  drawNeonPanelMock: vi.fn(() => ({
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("./neonPrimitives", () => ({
  drawNeonPanel: drawNeonPanelMock,
}));

import {
  createTopRightMuteButton,
  type MuteButtonSceneLike,
  type MuteButtonState,
} from "./TopRightMuteButton";

type FakeText = {
  x: number;
  y: number;
  text: string;
  origin: { x: number; y: number };
  handlers: Map<string, () => void>;
  visible: boolean;
};

type FakeImage = {
  x: number;
  y: number;
  key: string;
  origin: { x: number; y: number };
  visible: boolean;
  handlers: Map<string, () => void>;
};

type FakeGraphics = {
  visible: boolean;
  depth: number;
};

type FakeScene = MuteButtonSceneLike & {
  texts: FakeText[];
  images: FakeImage[];
  graphics: FakeGraphics[];
  click(): void;
  clickImage(index: number): void;
};

function makeScene(width = 1280): FakeScene {
  const texts: FakeText[] = [];
  const images: FakeImage[] = [];
  const graphics: FakeGraphics[] = [];
  const scene: FakeScene = {
    texts,
    images,
    graphics,
    add: {
      graphics() {
        const g: FakeGraphics = {
          visible: true,
          depth: 0,
        };
        graphics.push(g);
        return {
          fillStyle() {
            return this;
          },
          fillRoundedRect() {
            return this;
          },
          lineStyle() {
            return this;
          },
          strokeRoundedRect() {
            return this;
          },
          setDepth(depth: number) {
            g.depth = depth;
            return this;
          },
          setVisible(v: boolean) {
            g.visible = v;
            return this;
          },
        } as unknown as NonNullable<MuteButtonSceneLike["add"]["graphics"]> extends (
          ...args: never[]
        ) => infer R
          ? R
          : never;
      },
      text(x, y, value, _style) {
        const t: FakeText = {
          x,
          y,
          text: value,
          origin: { x: 0.5, y: 0.5 },
          handlers: new Map(),
          visible: true,
        };
        texts.push(t);
        return {
          setOrigin(o?: number, p?: number) {
            t.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return this;
          },
          setInteractive() {
            return this;
          },
          on(event: string, handler: () => void) {
            t.handlers.set(event, handler);
            return this;
          },
          setText(v: string) {
            t.text = v;
            return this;
          },
          setVisible(v: boolean) {
            t.visible = v;
            return this;
          },
        } as unknown as ReturnType<MuteButtonSceneLike["add"]["text"]>;
      },
      image(x: number, y: number, key: string) {
        const img: FakeImage = {
          x,
          y,
          key,
          origin: { x: 0.5, y: 0.5 },
          visible: true,
          handlers: new Map(),
        };
        images.push(img);
        return {
          setOrigin(o?: number, p?: number) {
            img.origin = { x: o ?? 0.5, y: p ?? 0.5 };
            return this;
          },
          setInteractive() {
            return this;
          },
          on(event: string, handler: () => void) {
            img.handlers.set(event, handler);
            return this;
          },
          setVisible(v: boolean) {
            img.visible = v;
            return this;
          },
          setTexture(k: string) {
            img.key = k;
            return this;
          },
        } as unknown as ReturnType<MuteButtonSceneLike["add"]["image"]>;
      },
    },
    scale: { width, height: 720 },
    textures: { exists: () => false },  // text fallback by default
    click() {
      const handler = texts[0]?.handlers.get("pointerup");
      if (handler) handler();
    },
    clickImage(index: number) {
      const handler = images[index]?.handlers.get("pointerup");
      if (handler) handler();
    },
  };
  return scene;
}

describe("TopRightMuteButton", () => {
  it("creates a text button at the top-right corner", () => {
    const scene = makeScene(1280);
    createTopRightMuteButton(scene, { sfxMuted: false, musicMuted: false }, () => {});
    expect(scene.texts).toHaveLength(1);
    expect(drawNeonPanelMock).toHaveBeenCalledTimes(1);
    expect(drawNeonPanelMock).toHaveBeenCalledWith(scene, 1106, 12, 148, 42);
    expect(scene.texts[0].x).toBe(1260); // width - margin(20)
    expect(scene.texts[0].y).toBe(20);
    expect(scene.texts[0].origin).toEqual({ x: 1, y: 0 });
  });

  it("shows '🔊 Sound' when not muted", () => {
    const scene = makeScene();
    createTopRightMuteButton(scene, { sfxMuted: false, musicMuted: false }, () => {});
    expect(scene.texts[0].text).toBe("🔊 Sound");
  });

  it("shows '🔇 Muted' when both are muted", () => {
    const scene = makeScene();
    createTopRightMuteButton(scene, { sfxMuted: true, musicMuted: true }, () => {});
    expect(scene.texts[0].text).toBe("🔇 Muted");
  });

  it("shows '🔊 Sound' when only one is muted", () => {
    const scene = makeScene();
    createTopRightMuteButton(scene, { sfxMuted: true, musicMuted: false }, () => {});
    expect(scene.texts[0].text).toBe("🔊 Sound");
  });

  it("on click, mutes both when currently unmuted", () => {
    const scene = makeScene();
    const changes: MuteButtonState[] = [];
    createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      (next) => changes.push(next),
    );
    scene.click();
    expect(changes).toEqual([{ sfxMuted: true, musicMuted: true }]);
    expect(scene.texts[0].text).toBe("🔇 Muted");
  });

  it("on click, unmutes both when currently muted", () => {
    const scene = makeScene();
    const changes: MuteButtonState[] = [];
    createTopRightMuteButton(
      scene,
      { sfxMuted: true, musicMuted: true },
      (next) => changes.push(next),
    );
    scene.click();
    expect(changes).toEqual([{ sfxMuted: false, musicMuted: false }]);
    expect(scene.texts[0].text).toBe("🔊 Sound");
  });

  it("setState updates the label", () => {
    const scene = makeScene();
    const btn = createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
    );
    btn.setState({ sfxMuted: true, musicMuted: true });
    expect(scene.texts[0].text).toBe("🔇 Muted");
  });

  it("isMasterMuted reflects the current state", () => {
    const scene = makeScene();
    const btn = createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
    );
    expect(btn.isMasterMuted()).toBe(false);
    btn.setState({ sfxMuted: true, musicMuted: true });
    expect(btn.isMasterMuted()).toBe(true);
  });

  it("clicking twice toggles back to unmuted", () => {
    const scene = makeScene();
    const changes: MuteButtonState[] = [];
    createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      (next) => changes.push(next),
    );
    scene.click(); // mute
    scene.click(); // unmute
    expect(changes).toEqual([
      { sfxMuted: true, musicMuted: true },
      { sfxMuted: false, musicMuted: false },
    ]);
    expect(scene.texts[0].text).toBe("🔊 Sound");
  });
});

describe("TopRightMuteButton - i18n labels", () => {
  it("uses the provided soundLabel when not muted", () => {
    const scene = makeScene();
    createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
      { soundLabel: "🔊 Звук", mutedLabel: "🔇 Заглушено" },
    );
    expect(scene.texts[0].text).toBe("🔊 Звук");
  });

  it("uses the provided mutedLabel when both are muted", () => {
    const scene = makeScene();
    createTopRightMuteButton(
      scene,
      { sfxMuted: true, musicMuted: true },
      () => {},
      { soundLabel: "🔊 Звук", mutedLabel: "🔇 Заглушено" },
    );
    expect(scene.texts[0].text).toBe("🔇 Заглушено");
  });

  it("uses the provided labels after a click toggles state", () => {
    const scene = makeScene();
    createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
      { soundLabel: "🔊 Звук", mutedLabel: "🔇 Заглушено" },
    );
    scene.click();
    expect(scene.texts[0].text).toBe("🔇 Заглушено");
    scene.click();
    expect(scene.texts[0].text).toBe("🔊 Звук");
  });

  it("uses the provided labels in setState()", () => {
    const scene = makeScene();
    const btn = createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
      { soundLabel: "🔊 Звук", mutedLabel: "🔇 Заглушено" },
    );
    btn.setState({ sfxMuted: true, musicMuted: true });
    expect(scene.texts[0].text).toBe("🔇 Заглушено");
  });

  it("falls back to default labels when no options provided", () => {
    const scene = makeScene();
    createTopRightMuteButton(
      scene,
      { sfxMuted: false, musicMuted: false },
      () => {},
    );
    expect(scene.texts[0].text).toBe("🔊 Sound");
  });

  it("falls back to default labels when options is undefined", () => {
    const scene = makeScene();
    createTopRightMuteButton(
      scene,
      { sfxMuted: true, musicMuted: true },
      () => {},
      undefined,
    );
    expect(scene.texts[0].text).toBe("🔇 Muted");
  });
});
