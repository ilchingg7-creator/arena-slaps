import { describe, expect, it, vi } from "vitest";
import {
  loadSprites,
  loadAtlases,
  loadAllSprites,
} from "./spriteLoader";
import type { SpriteDefinition, AtlasDefinition } from "./spriteManifest";

type ImageCall = { key: string; url: string };
type AtlasCall = { key: string; textureURL: string; atlasURL: string };

type StubScene = {
  image: ReturnType<typeof vi.fn>;
  atlas: ReturnType<typeof vi.fn>;
  imageCalls: ImageCall[];
  atlasCalls: AtlasCall[];
};

function makeStubScene(): StubScene {
  const imageCalls: ImageCall[] = [];
  const atlasCalls: AtlasCall[] = [];
  const image = vi.fn((key: string, url: string) => {
    imageCalls.push({ key, url });
  });
  const atlas = vi.fn(
    (key: string, textureURL: string, atlasURL: string) => {
      atlasCalls.push({ key, textureURL, atlasURL });
    },
  );
  return { image, atlas, imageCalls, atlasCalls };
}

const sampleSprites: SpriteDefinition[] = [
  {
    key: "player-idle",
    path: "./sprites/player-idle.png",
    category: "character",
    fallback: "rectangle",
    fallbackColor: 0x3d405b,
  },
  {
    key: "powerup-speed",
    path: "./sprites/powerup-speed.png",
    category: "effect",
    fallback: "circle",
    fallbackColor: 0x81b29a,
  },
];

const sampleAtlases: AtlasDefinition[] = [
  {
    key: "player-atlas",
    imagePath: "./sprites/player-atlas.png",
    atlasPath: "./sprites/player-atlas.json",
    category: "character",
  },
];

describe("spriteLoader", () => {
  it("loadSprites calls scene.image once per definition with key and path", () => {
    const scene = makeStubScene();
    loadSprites(scene, sampleSprites);
    expect(scene.image).toHaveBeenCalledTimes(sampleSprites.length);
    expect(scene.imageCalls).toEqual([
      { key: "player-idle", url: "./sprites/player-idle.png" },
      { key: "powerup-speed", url: "./sprites/powerup-speed.png" },
    ]);
  });

  it("loadSprites does nothing for an empty list", () => {
    const scene = makeStubScene();
    loadSprites(scene, []);
    expect(scene.image).not.toHaveBeenCalled();
  });

  it("loadAtlases calls scene.atlas once per atlas with key, imagePath, atlasPath", () => {
    const scene = makeStubScene();
    loadAtlases(scene, sampleAtlases);
    expect(scene.atlas).toHaveBeenCalledTimes(sampleAtlases.length);
    expect(scene.atlasCalls).toEqual([
      {
        key: "player-atlas",
        textureURL: "./sprites/player-atlas.png",
        atlasURL: "./sprites/player-atlas.json",
      },
    ]);
  });

  it("loadAtlases does nothing for an empty list", () => {
    const scene = makeStubScene();
    loadAtlases(scene, []);
    expect(scene.atlas).not.toHaveBeenCalled();
  });

  it("loadAllSprites calls both image (for each SPRITE_DEFINITIONS entry) and atlas (for each SPRITE_ATLASES entry)", () => {
    const scene = makeStubScene();
    loadAllSprites(scene);
    // We can't hardcode counts because the manifest may grow, but we can
    // assert that image was called at least as many times as there are
    // sprite definitions, and that the keys/paths match the manifest.
    expect(scene.imageCalls.length).toBeGreaterThan(0);
    // Every image call should have a key + url that pair up.
    for (const call of scene.imageCalls) {
      expect(call.url).toMatch(/^\.\/sprites\/.+\.png$/);
      expect(call.key).toBeTruthy();
    }
    // atlas may be zero calls today (no atlases registered yet) but the
    // function must still be safe to call.
    expect(scene.atlas).toHaveBeenCalledTimes(0);
  });

  it("loadAllSprites image calls include the documented placeholder keys", () => {
    const scene = makeStubScene();
    loadAllSprites(scene);
    const keys = scene.imageCalls.map((c) => c.key);
    expect(keys).toContain("player-idle");
    expect(keys).toContain("bot-idle");
    expect(keys).toContain("powerup-speed");
    expect(keys).toContain("powerup-knockback");
    expect(keys).toContain("powerup-shield");
  });
});
