#!/bin/zsh
set -euo pipefail
export PATH="/opt/homebrew/opt/ffmpeg-full/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/exports/officedex-ppt-launch-master-1080p.mp4"
CLEAN="$ROOT/exports/officedex-ppt-launch-clean-1080p.mp4"
X_CUT="$ROOT/exports/officedex-ppt-launch-x-30s.mp4"
VERTICAL="$ROOT/exports/officedex-ppt-launch-vertical-20s.mp4"

check_media() {
  local file="$1"
  local min_duration="$2"
  local max_duration="$3"
  local want_width="$4"
  local want_height="$5"
  test -s "$file"
  local duration width height audio_streams
  duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file")"
  width="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$file")"
  height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "$file")"
  audio_streams="$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$file")"
  awk -v value="$duration" -v min="$min_duration" -v max="$max_duration" 'BEGIN { exit !(value >= min && value <= max) }'
  test "$width" = "$want_width"
  test "$height" = "$want_height"
  test -z "$audio_streams"
  echo "${file:t}: duration=${duration}s dimensions=${width}x${height} audio_streams=0"
}

check_media "$MASTER" 75 90 1920 1080
check_media "$CLEAN" 75 90 1920 1080
check_media "$X_CUT" 28 32 1920 1080
check_media "$VERTICAL" 19 21 1080 1920

ffmpeg -v error -i "$MASTER" -f null -
ffmpeg -v error -i "$CLEAN" -f null -
ffmpeg -v error -i "$X_CUT" -f null -
ffmpeg -v error -i "$VERTICAL" -f null -

echo "media validation passed"
