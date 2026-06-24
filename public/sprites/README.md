# Arena Slaps — Sprite Assets

This directory holds every `.png` sprite and sprite atlas shipped with the
game. The pipeline is **manifest-driven**: code never hardcodes filenames.
The single source of truth for which sprites exist, where they live on
disk, and what primitive to fall back to when a sprite is missing is
[`src/game/assets/spriteManifest.ts`](../../src/game/assets/spriteManifest.ts).

> **No PNGs are checked in yet.** The directory currently ships only this
> README and a `.gitkeep`. Every sprite declared in the manifest will fall
> back to a colored primitive (rectangle or circle) until the matching
> `.png` is dropped in here. See [Fallback system](#fallback-system)
> below.

## Pipeline overview

```
spriteManifest.ts        SpriteManager.ts            PreloadScene.ts
  (source of truth)   <--(reads def by key)---       (calls loadAllSprites)
        |                                              |
        v                                              v
  SPRITE_DEFINITIONS  -----> spriteLoader.ts -----> scene.load.image(key, path)
  SPRITE_ATLASES      -----> spriteLoader.ts -----> scene.load.atlas(key, png, json)
```

1. `spriteManifest.ts` declares every sprite (and atlas) the game knows
   about, with a unique `key`, a `path` under this directory, a
   `category`, an optional display `width`/`height`, and a `fallback`
   primitive shape + `fallbackColor` to use when the PNG isn't loaded.
2. `PreloadScene.preload` calls `loadAllSprites(this)` from
   `spriteLoader.ts`, which iterates the manifest and calls
   `this.load.image(key, path)` for each sprite (and `this.load.atlas(...)`
   for each atlas).
3. Scenes construct a `new SpriteManager(this)` once and call
   `spriteManager.createSprite(key, x, y)` (or `createPhysicsSprite`) for
   every game object they want to render from a sprite.
4. `SpriteManager` checks `scene.textures.exists(key)`. If the texture is
   there it returns a `Phaser.GameObjects.Image`. If not (or if
   `forceFallback: true` was passed) it returns a primitive
   (`Rectangle` or `Circle`) using the manifest's `fallbackColor`.

## Current contents

| File                    | Key                  | Path                            | Category   | Fallback   | Fallback color | Notes                                              |
| ----------------------- | -------------------- | ------------------------------- | ---------- | ---------- | -------------- | -------------------------------------------------- |
| *(pending)* `player-idle.png`        | `player-idle`        | `/sprites/player-idle.png`        | character | rectangle  | `#3d405b`      | Player idle pose.                                  |
| *(pending)* `bot-idle.png`           | `bot-idle`           | `/sprites/bot-idle.png`           | character | rectangle  | `#e07a5f`      | Bot idle pose.                                     |
| *(pending)* `powerup-speed.png`      | `powerup-speed`      | `/sprites/powerup-speed.png`      | effect    | circle     | `#81b29a`      | Speed Boost power-up.                              |
| *(pending)* `powerup-knockback.png`  | `powerup-knockback`  | `/sprites/powerup-knockback.png`  | effect    | circle     | `#f2cc8f`      | Heavy Hand power-up.                               |
| *(pending)* `powerup-shield.png`     | `powerup-shield`     | `/sprites/powerup-shield.png`     | effect    | circle     | `#3d405b`      | Shield power-up.                                   |

> "*(pending)*" means the `.png` file has not been dropped in yet — the
> game still runs because the manifest declares a `fallback` primitive for
> each entry.

No sprite atlases are registered yet. When the first animated character is
ready, see [How to add a sprite atlas](#how-to-add-a-sprite-atlas-for-animations).

## Naming convention

- Single sprites: `<category>-<name>.png` — e.g. `player-idle.png`,
  `powerup-speed.png`, `ui-button.png`.
- Atlas pairs: `<name>-atlas.png` + `<name>-atlas.json` — e.g.
  `player-atlas.png` + `player-atlas.json`.
- Keys in the manifest MUST match the basename (without extension) of
  the file they point at.

## How to add a new sprite

1. Add a new entry to `SPRITE_DEFINITIONS` in
   `src/game/assets/spriteManifest.ts`:
   ```ts
   {
     key: "ui-button",
     path: "/sprites/ui-button.png",
     category: "ui",
     fallback: "rectangle",
     fallbackColor: 0x3d405b,
     // optional display dimensions, applied via setDisplaySize when the texture IS loaded:
     // width: 200,
     // height: 60,
   },
   ```
2. Drop the `.png` file into this directory using the filename you used in
   the `path` field.
3. Reference the new key from any scene:
   ```ts
   const sprites = new SpriteManager(this);
   const button = sprites.createSprite("ui-button", 640, 360);
   ```

That's it — `PreloadScene` automatically iterates the manifest and calls
`load.image` for every entry, so the new sprite is loaded with zero
additional wiring. If you skip step 2, the fallback primitive is rendered
using `fallbackColor` — so you can wire up gameplay against the manifest
before the art is ready.

## How to add a sprite atlas (for animations)

Atlases are used when a single texture contains multiple frames (idle,
walk, attack, ...) described by a JSON atlas file exported by tools like
TexturePacker or ShoeBox.

1. Export the atlas from your tool as a PNG + JSON pair (Phaser 3's
   "JSON Hash" or "JSON Array" format).
2. Drop both files into this directory, e.g. `player-atlas.png` and
   `player-atlas.json`.
3. Add a new entry to `SPRITE_ATLASES` in `spriteManifest.ts`:
   ```ts
   {
     key: "player-atlas",
     imagePath: "/sprites/player-atlas.png",
     atlasPath: "/sprites/player-atlas.json",
     category: "character",
   },
   ```
4. In your scene, after `create()`, access the atlas frames by name:
   ```ts
   this.add.sprite(x, y, "player-atlas", "player-idle-01");
   ```

`loadAllSprites` calls `scene.load.atlas(key, imagePath, atlasPath)` for
every entry in `SPRITE_ATLASES`. The optional `SpriteManager` API only
covers single-image sprites today — for animated sprites you'll typically
use `this.add.sprite(...)` directly with the atlas key + frame name.

## Fallback system

`SpriteManager.createSprite(key, x, y)` checks
`scene.textures.exists(key)` and:

- **Texture is loaded** (and `forceFallback` is not set): returns a
  `Phaser.GameObjects.Image`. If the manifest declared `width` and
  `height`, `setDisplaySize(w, h)` is applied.
- **Texture is missing** (or `forceFallback: true` was passed to the
  `SpriteManager` constructor): returns the primitive declared in the
  manifest's `fallback` field:
  - `"rectangle"` -> `scene.add.rectangle(x, y, w, h, fallbackColor)`
    where `w` / `h` default to 36 when the manifest doesn't declare them.
  - `"circle"` -> `scene.add.circle(x, y, radius, fallbackColor)` where
    `radius = (width ?? 36) / 2`.

This means the game is **always playable**, even before any art exists.
Developers see colored primitives that match each sprite's category, and
artists can replace them one at a time without breaking gameplay.

To force the fallback everywhere (useful in tests or on very low-end
devices), construct the manager with `{ forceFallback: true }`.

## How to swap the loader / manager

The loader (`spriteLoader.ts`) and the manager (`SpriteManager.ts`) both
take minimal structural types (`SceneLoaderLike` for the loader; the
methods used on `Phaser.Scene` for the manager) so they're easy to stub
in unit tests without instantiating Phaser. To swap either:

- **Loader**: implement the `SceneLoaderLike` interface (a `image(key, url)`
  method and an `atlas(key, textureURL, atlasURL)` method) and pass your
  implementation to `loadSprites` / `loadAtlases` / `loadAllSprites`.
- **Manager**: `SpriteManager` is a class. Subclass it (or wrap it) and
  override `createSprite` / `createPhysicsSprite` to add behavior like
  pooling, depth sorting, or rendering via a different GameObject type.

The manifest is engine-agnostic, so the same set of sprite keys and paths
works for any backend that can load PNGs by string key.
