import { defineConfig } from "vite";

// Yandex Games uploads the build into a versioned subdirectory on
// app-<id>.games.s3.yandex.net (e.g.
// /544972/53l6e65o7rgiorip4a3mkuk39i0vuvs8/index.html). Vite's default
// `base: '/'` emits absolute asset paths (/assets/index-*.js) which
// resolve to the S3 bucket root, not the versioned subdirectory →
// HTTP 404 on every JS/CSS chunk.
//
// Setting `base: './'` makes Vite emit RELATIVE asset paths
// (./assets/index-*.js) so they resolve against the current document
// URL — which is the versioned subdirectory on Yandex. This is the
// standard fix for any platform that hosts the build in a subfolder
// (Yandex Games, itch.io embeds, GitHub Pages project sites, etc.).
export default defineConfig({
  base: "./",
});
