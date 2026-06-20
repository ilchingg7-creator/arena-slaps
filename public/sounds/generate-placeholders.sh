#!/usr/bin/env bash
# Generate short placeholder .ogg sounds for Arena Slaps.
# Each tone uses a distinct frequency so devs can audibly verify which key fires.
# Replace these files with real SFX before shipping — see README.md in this dir.
set -euo pipefail
cd "$(dirname "$0")"

gen() {
  local name="$1"
  local freq="$2"
  local duration="$3"
  local fade="${4:-0.05}"
  ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=${duration}" \
    -af "afade=t=out:st=$(awk "BEGIN{print ${duration}-${fade}}"):d=${fade}" \
    -c:a libvorbis -q:a 3 "${name}.ogg" 2>/dev/null
}

gen slap-hit         220 0.18 0.06
gen slap-miss        140 0.10 0.04
gen powerup-collect  660 0.22 0.08
gen ring-out         110 0.30 0.15
gen round-win        880 0.45 0.20
gen round-lose        90 0.45 0.20
gen round-draw       330 0.30 0.12
gen countdown-tick   740 0.08 0.03
gen menu-click       520 0.06 0.02
gen menu-start       990 0.20 0.08

echo "Generated $(ls *.ogg | wc -l) placeholder .ogg files"
