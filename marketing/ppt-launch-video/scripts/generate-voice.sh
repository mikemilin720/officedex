#!/bin/zsh
set -euo pipefail
export PATH="/opt/homebrew/opt/ffmpeg-full/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRT="$ROOT/captions/master-en.srt"
OUTPUT_DIR="$ROOT/audio/generated"
SEGMENT_DIR="$OUTPUT_DIR/segments"
OUTPUT="$OUTPUT_DIR/narration-samantha.wav"
TIMELINE_SECONDS=85

mkdir -p "$SEGMENT_DIR"
rm -f "$SEGMENT_DIR"/*(N) "$OUTPUT"

python3 - "$SRT" "$SEGMENT_DIR/segments.tsv" <<'PY'
from pathlib import Path
import re
import sys

srt = Path(sys.argv[1]).read_text(encoding="utf-8").strip()
out = Path(sys.argv[2])

def millis(value: str) -> int:
    h, m, rest = value.split(":")
    s, ms = rest.split(",")
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms)

rows = []
for block in re.split(r"\n\s*\n", srt):
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    if len(lines) < 3:
        continue
    start, end = [part.strip() for part in lines[1].split("-->")]
    text = " ".join(lines[2:]).replace("OfficeDex", "Office Dex")
    rows.append(f"{millis(start)}\t{millis(end)}\t{text}")
out.write_text("\n".join(rows) + "\n", encoding="utf-8")
PY

inputs=()
filters=()
labels=()
index=0

while IFS=$'\t' read -r start_ms end_ms text; do
  source="$SEGMENT_DIR/source-${index}.aiff"
  fitted="$SEGMENT_DIR/fitted-${index}.wav"
  say -v Samantha -r 150 "$text" -o "$source"

  duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$source")"
  slot_seconds="$(awk -v start="$start_ms" -v end="$end_ms" 'BEGIN { print (end-start-250)/1000 }')"
  tempo="$(awk -v duration="$duration" -v slot="$slot_seconds" 'BEGIN { if (duration > slot) print duration/slot; else print 1 }')"

  ffmpeg -hide_banner -loglevel error -y -i "$source" \
    -af "atempo=$tempo,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo" \
    "$fitted"

  inputs+=( -i "$fitted" )
  filters+=( "[$index:a]adelay=${start_ms}|${start_ms}[a${index}]" )
  labels+=( "[a${index}]" )
  index=$((index + 1))
done < "$SEGMENT_DIR/segments.tsv"

label_chain=""
for label in $labels; do
  label_chain+="$label"
done
filter_chain="${(j:;:)filters};${label_chain}amix=inputs=$index:duration=longest:normalize=0,apad,atrim=0:${TIMELINE_SECONDS},loudnorm=I=-16:TP=-1.5:LRA=11[out]"

ffmpeg -hide_banner -loglevel error -y \
  $inputs \
  -filter_complex "$filter_chain" \
  -map "[out]" -ar 48000 -ac 2 "$OUTPUT"

test -s "$OUTPUT"
echo "$OUTPUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT"
