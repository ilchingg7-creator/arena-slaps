#!/usr/bin/env bash
# Generate short placeholder .ogg sounds for Arena Slaps.
# Each tone uses a distinct frequency so devs can audibly verify which key fires.
# Replace these files with real SFX before shipping — see README.md in this dir.
set -euo pipefail
cd "$(dirname "$0")"

# Short SFX (single tone, brief fade out).
gen() {
  local name="$1"
  local freq="$2"
  local duration="$3"
  local fade="${4:-0.05}"
  ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=${duration}" \
    -af "afade=t=out:st=$(awk "BEGIN{print ${duration}-${fade}}"):d=${fade}" \
    -c:a libvorbis -q:a 3 "${name}.ogg" 2>/dev/null
}

# Longer music track (fade in + fade out so the loop point is gentle).
gen_music() {
  local name="$1"
  local freq="$2"
  local duration="$3"
  local fade_in="$4"
  local fade_out_start="$5"
  local fade_out_dur="$6"
  ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=${duration}" \
    -af "afade=t=in:st=0:d=${fade_in},afade=t=out:st=${fade_out_start}:d=${fade_out_dur}" \
    -c:a libvorbis -q:a 3 "${name}.ogg" 2>/dev/null
}

gen slap-hit         220 0.18 0.06
gen slap-miss        140 0.10 0.04

# 6 slap-hit variants — distinct frequencies (180..260 Hz) and slight
# duration variation so each call to AudioService.playSlapHit() picks
# a random one and the player hears subtle variation.
gen slap-hit-1       200 0.18 0.06
gen slap-hit-2       240 0.18 0.06
gen slap-hit-3       180 0.20 0.06
gen slap-hit-4       260 0.16 0.06
gen slap-hit-5       220 0.22 0.06
gen slap-hit-6       160 0.24 0.06

# 3 slap-miss variants — lower frequencies (110..150 Hz).
gen slap-miss-1      130 0.10 0.04
gen slap-miss-2      110 0.12 0.04
gen slap-miss-3      150 0.08 0.04

gen powerup-collect  660 0.22 0.08
gen ring-out         110 0.30 0.15
gen round-win        880 0.45 0.20
gen round-lose        90 0.45 0.20
gen round-draw       330 0.30 0.12
gen countdown-tick   740 0.08 0.03
gen menu-click       520 0.06 0.02
gen menu-start       990 0.20 0.08

# Music tracks: longer sines with fade in/out for soft looping.
# menu-theme: calm 220Hz, 12 seconds, 1s fade in + 1s fade out.
gen_music menu-theme   220 12 1 11 1
# battle-theme: faster 330Hz, 10 seconds, 0.5s fade in + 0.5s fade out.
gen_music battle-theme 330 10 0.5 9.5 0.5

echo "Generated $(ls *.ogg | wc -l) placeholder .ogg files"
