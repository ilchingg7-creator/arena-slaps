# Arena Slaps Promo Pack For Yandex Games

This folder contains publication promo assets for Arena Slaps.

## Files

- `icon-512.png` -> game icon, 512x512 PNG
- `cover-800x470.png` -> cover, 800x470 PNG
- `showcase-cover-1560x520.png` -> showcase cover, 1560x520 PNG
- `screenshots/screenshot-01-main-menu.png` -> main menu screenshot, 1920x1080 PNG
- `screenshots/screenshot-02-battle.png` -> battle screenshot, 1920x1080 PNG
- `screenshots/screenshot-03-powerups.png` -> power-up screenshot, 1920x1080 PNG
- `screenshots/screenshot-04-results-or-progression.png` -> results/progression screenshot, 1920x1080 PNG
- `video-horizontal.mp4` -> horizontal gameplay video, 16:9 MP4, 20-28 seconds, up to 100 MB

## Regenerate Images

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File marketing/yandex-games/generate-promo.ps1
```

The generated image style is Modern Neon Arcade: dark cyber arena, high-contrast fighters, slap burst, ring-out energy, power-up chips, and large readable Arena Slaps branding.

## Verify Promo Assets

Run:

```bash
npm run verify:promo
```

The script checks PNG dimensions and safe file names. If `video-horizontal.mp4` exists and `ffprobe` is installed, it also checks video ratio, duration, and file size.

## Record `video-horizontal.mp4` With OBS

Use this manual path when automated browser capture or ffmpeg is unavailable in the environment.

1. Run the game locally:

```bash
npm run dev
```

2. Open the Vite URL in a browser and set the browser viewport to 1920x1080.
3. In OBS, create a scene with `Window Capture` or `Browser Source` pointed at the local game.
4. Set OBS canvas and output resolution to `1920x1080`.
5. Set recording format to `mp4`, video encoder to H.264, and bitrate around `12000-18000 Kbps`.
6. Record a 20-28 second clip with this structure:
   - 0-3s: main menu or Arena Slaps logo
   - 3-10s: battle start and character movement
   - 10-18s: slap hits, power-up pickup, combo moment
   - 18-24s: ring-out, victory, or result screen
   - 24-28s: final frame with Arena Slaps title
7. Export or move the file to:

```text
marketing/yandex-games/video-horizontal.mp4
```

8. Re-run:

```bash
npm run verify:promo
```

Keep the final MP4 under 100 MB.
