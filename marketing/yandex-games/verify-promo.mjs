import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const base = join(root, "marketing", "yandex-games");

const requiredImages = [
  ["icon-512.png", 512, 512],
  ["cover-800x470.png", 800, 470],
  ["showcase-cover-1560x520.png", 1560, 520],
  ["screenshots/screenshot-01-main-menu.png", 1920, 1080],
  ["screenshots/screenshot-02-battle.png", 1920, 1080],
  ["screenshots/screenshot-03-powerups.png", 1920, 1080],
  ["screenshots/screenshot-04-results-or-progression.png", 1920, 1080],
];

function readPngSize(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${path} is not a PNG file`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function assertSafeName(name) {
  if (/[^\x20-\x7e]/.test(name) || /\s/.test(name)) {
    throw new Error(`Unsafe filename: ${name}`);
  }
}

let failures = 0;

for (const [relativePath, width, height] of requiredImages) {
  assertSafeName(relativePath);
  const path = join(base, relativePath);
  if (!existsSync(path)) {
    console.error(`MISSING ${relativePath}`);
    failures++;
    continue;
  }
  const actual = readPngSize(path);
  if (actual.width !== width || actual.height !== height) {
    console.error(`BAD_SIZE ${relativePath}: ${actual.width}x${actual.height}, expected ${width}x${height}`);
    failures++;
  } else {
    console.log(`OK ${relativePath}: ${width}x${height}`);
  }
}

const videoPath = join(base, "video-horizontal.mp4");
if (!existsSync(videoPath)) {
  console.warn("WARN video-horizontal.mp4 is not present. Use README.md OBS instructions, then rerun this check.");
} else {
  assertSafeName("video-horizontal.mp4");
  const sizeMb = statSync(videoPath).size / (1024 * 1024);
  if (sizeMb > 100) {
    console.error(`BAD_VIDEO_SIZE video-horizontal.mp4: ${sizeMb.toFixed(1)} MB, expected <= 100 MB`);
    failures++;
  }
  try {
    const probe = JSON.parse(execFileSync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      videoPath,
    ], { encoding: "utf8" }));
    const stream = probe.streams?.[0];
    const duration = Number.parseFloat(probe.format?.duration ?? "0");
    if (!stream || stream.width / stream.height !== 16 / 9) {
      console.error(`BAD_VIDEO_RATIO video-horizontal.mp4: ${stream?.width ?? "?"}x${stream?.height ?? "?"}`);
      failures++;
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 28) {
      console.error(`BAD_VIDEO_DURATION video-horizontal.mp4: ${duration}s, expected <= 28s`);
      failures++;
    }
    if (failures === 0) {
      console.log(`OK video-horizontal.mp4: ${stream.width}x${stream.height}, ${duration.toFixed(1)}s, ${sizeMb.toFixed(1)} MB`);
    }
  } catch (error) {
    console.warn(`WARN video-horizontal.mp4 exists but ffprobe is unavailable or failed: ${error.message}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
