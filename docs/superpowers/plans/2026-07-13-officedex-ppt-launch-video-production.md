# OfficeDex PPT Launch Video Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify an approximately 85-second English OfficeDex PPT launch film, plus 30-second and vertical cutdowns, using a free-first macOS workflow.

**Architecture:** Keep lightweight production documents, scripts, captions, and title-card sources under version control while keeping raw recordings, generated audio, editor libraries, and exported video files local. Build the film from one verified OfficeDex demo run and ten short product captures, then assemble them with two generated title cards in iMovie. Validate the final media with macOS metadata tools before platform review.

**Tech Stack:** OfficeDex desktop app, macOS QuickTime Player, iMovie, macOS `say`, `afconvert`, SVG, Quick Look rendering, `mdls`, shell scripts, YouTube Audio Library or Pixabay Music.

**Audience and Distribution:** The primary audience is prospective overseas users. The 16:9 master must work on the OfficeDex website and X, while the derivative versions support additional social platforms. All public-facing copy, product states, narration, and captions are English.

---

## File Structure

Create the following tracked production kit:

```text
marketing/ppt-launch-video/
├── .gitignore                         # Keeps large or generated media out of git
├── README.md                          # Entry point and production status checklist
├── copy/
│   ├── demo-prompt.txt                # Exact prompt entered in OfficeDex
│   └── narration-en.txt               # Approved English voiceover copy
├── captions/
│   └── master-en.srt                  # Timed English captions for the 85-second master
├── graphics/
│   ├── opening.svg                    # Paper & Ink hook frame
│   └── cta.svg                        # Final Download OfficeDex frame
├── licenses/
│   └── music.md                       # Music source, author, URL, and license evidence
├── runbooks/
│   ├── demo-runbook.md                # Exact product states to prepare and verify
│   ├── recording-checklist.md         # Privacy, window, cursor, and clip checklist
│   └── editing-timeline.md            # iMovie assembly order and timing
└── scripts/
    ├── generate-voice.sh              # Generates the free local timing voice
    ├── render-graphics.sh              # Renders SVG title cards to PNG
    └── validate-media.sh               # Checks required clips and final export metadata
```

Create these local-only directories during production:

```text
marketing/ppt-launch-video/raw/master/
marketing/ppt-launch-video/audio/generated/
marketing/ppt-launch-video/audio/music/
marketing/ppt-launch-video/graphics/rendered/
marketing/ppt-launch-video/exports/
marketing/ppt-launch-video/project-notes/
```

Do not commit raw `.mov` files, generated audio, downloaded music, iMovie libraries, or final exports.

## Task 1: Bootstrap the Production Kit

**Files:**
- Create: `marketing/ppt-launch-video/.gitignore`
- Create: `marketing/ppt-launch-video/README.md`
- Create directories listed in the file structure

- [ ] **Step 1: Create the directory tree**

Run:

```bash
mkdir -p marketing/ppt-launch-video/{copy,captions,graphics/rendered,licenses,runbooks,scripts,raw/master,audio/generated,audio/music,exports,project-notes}
```

Expected: command exits with status 0 and `find marketing/ppt-launch-video -maxdepth 2 -type d | sort` lists every directory.

- [ ] **Step 2: Create the local media ignore rules**

Create `marketing/ppt-launch-video/.gitignore` with exactly:

```gitignore
raw/
audio/generated/
audio/music/
graphics/rendered/
exports/
project-notes/
*.imovielibrary
```

- [ ] **Step 3: Create the production README**

Create `marketing/ppt-launch-video/README.md` with:

```markdown
# OfficeDex PPT Launch Video

Design source: `docs/superpowers/specs/2026-07-13-officedex-ppt-launch-video-design.md`

## Production status

- [ ] Demo run verified
- [ ] Ten product clips recorded
- [ ] Opening and CTA graphics rendered
- [ ] Picture lock approved
- [ ] English narration approved
- [ ] Captions checked
- [ ] Music license recorded
- [ ] 85-second master exported and validated
- [ ] 30-second cutdown exported and validated
- [ ] 9:16 teaser exported and validated
- [ ] Website playback checked
- [ ] Unpublished X draft checked
```

- [ ] **Step 4: Verify ignored media behavior**

Run:

```bash
touch marketing/ppt-launch-video/raw/master/ignore-check.mov
git status --short marketing/ppt-launch-video
rm marketing/ppt-launch-video/raw/master/ignore-check.mov
```

Expected: `.gitignore` and `README.md` appear; `ignore-check.mov` does not appear.

- [ ] **Step 5: Commit the production skeleton**

```bash
git add marketing/ppt-launch-video/.gitignore marketing/ppt-launch-video/README.md
git commit -m "docs: scaffold PPT launch video production kit"
```

## Task 2: Lock the Demo Prompt, Narration, and Captions

**Files:**
- Create: `marketing/ppt-launch-video/copy/demo-prompt.txt`
- Create: `marketing/ppt-launch-video/copy/narration-en.txt`
- Create: `marketing/ppt-launch-video/captions/master-en.srt`

- [ ] **Step 1: Save the exact OfficeDex prompt**

Create `marketing/ppt-launch-video/copy/demo-prompt.txt` with one paragraph:

```text
Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review.
```

- [ ] **Step 2: Save the English narration**

Create `marketing/ppt-launch-video/copy/narration-en.txt` with:

```text
A great presentation shouldn’t be a one-shot gamble.

Tell OfficeDex what you want to communicate—not how to build every slide.

It turns your idea into a story you can see, refine, and approve. Review the story beats. Shape the chapters. Check every slide outline before the deck is built.

Then OfficeDex creates the real presentation, page by page, with visuals, structure, and layout checks along the way.

Preview every slide without leaving your workflow.

And when the first version is ready, keep creating. Select a slide—or even an element—and describe what should change. Review the proposed edit, apply it, and continue until the presentation feels right.

From first thought to final polish, create presentations with control.

Download OfficeDex and create your next deck.
```

- [ ] **Step 3: Create the timed caption file**

Create `marketing/ppt-launch-video/captions/master-en.srt` with:

```srt
1
00:00:01,000 --> 00:00:05,500
A great presentation shouldn’t be
a one-shot gamble.

2
00:00:06,000 --> 00:00:12,500
Tell OfficeDex what you want to communicate—
not how to build every slide.

3
00:00:13,000 --> 00:00:20,000
It turns your idea into a story
you can see, refine, and approve.

4
00:00:20,500 --> 00:00:27,500
Review the story beats. Shape the chapters.
Check every slide outline before the deck is built.

5
00:00:28,000 --> 00:00:36,000
Then OfficeDex creates the real presentation,
page by page,

6
00:00:36,000 --> 00:00:44,500
with visuals, structure, and layout checks
along the way.

7
00:00:51,000 --> 00:00:57,500
Preview every slide
without leaving your workflow.

8
00:00:58,000 --> 00:01:04,000
And when the first version is ready,
keep creating.

9
00:01:04,000 --> 00:01:10,500
Select a slide—or even an element—
and describe what should change.

10
00:01:10,500 --> 00:01:16,500
Review the proposed edit, apply it,
and continue until the presentation feels right.

11
00:01:17,000 --> 00:01:22,000
From first thought to final polish,
create presentations with control.

12
00:01:22,000 --> 00:01:25,000
Download OfficeDex
and create your next deck.
```

- [ ] **Step 4: Check caption structure**

Run:

```bash
rg -c '^[0-9]+$' marketing/ppt-launch-video/captions/master-en.srt
rg -n '^00:' marketing/ppt-launch-video/captions/master-en.srt
```

Expected: twelve numbered caption blocks and twelve timing lines, with the final cue ending at `00:01:25,000`.

- [ ] **Step 5: Commit copy and captions**

```bash
git add marketing/ppt-launch-video/copy marketing/ppt-launch-video/captions
git commit -m "docs: lock PPT launch film copy and captions"
```

## Task 3: Create the Free Local Voice Workflow

**Files:**
- Create: `marketing/ppt-launch-video/scripts/generate-voice.sh`
- Generate locally: `marketing/ppt-launch-video/audio/generated/narration-samantha.aiff`

- [ ] **Step 1: Create the voice-generation script**

Create `marketing/ppt-launch-video/scripts/generate-voice.sh` with:

```bash
#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="$ROOT/copy/narration-en.txt"
OUTPUT_DIR="$ROOT/audio/generated"
OUTPUT="$OUTPUT_DIR/narration-samantha.aiff"

mkdir -p "$OUTPUT_DIR"
test -f "$INPUT"
say -v Samantha -r 150 -f "$INPUT" -o "$OUTPUT"
test -s "$OUTPUT"

echo "$OUTPUT"
afinfo "$OUTPUT" | rg 'estimated duration|sample rate'
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x marketing/ppt-launch-video/scripts/generate-voice.sh
```

Expected: `test -x marketing/ppt-launch-video/scripts/generate-voice.sh` exits 0.

- [ ] **Step 3: Generate the timing voice**

Run:

```bash
marketing/ppt-launch-video/scripts/generate-voice.sh
```

Expected: the script prints the AIFF path, a non-zero estimated duration, and a valid sample rate.

- [ ] **Step 4: Listen to the full voice file**

Run:

```bash
open marketing/ppt-launch-video/audio/generated/narration-samantha.aiff
```

Listen for mispronounced product naming, rushed punctuation, clipped starts, and unnatural em-dash pauses. If `OfficeDex` is mispronounced, change only the spoken copy to `Office Dex` while keeping captions and on-screen branding as `OfficeDex`.

- [ ] **Step 5: Commit the reusable script**

```bash
git add marketing/ppt-launch-video/scripts/generate-voice.sh
git commit -m "chore: add local launch-film voice generator"
```

## Task 4: Prepare and Verify the OfficeDex Demo Run

**Files:**
- Create: `marketing/ppt-launch-video/runbooks/demo-runbook.md`
- Reference: `build/bin/OfficeDex.app`
- Reference: `marketing/ppt-launch-video/copy/demo-prompt.txt`

- [ ] **Step 1: Create the demo runbook**

Create `marketing/ppt-launch-video/runbooks/demo-runbook.md` with these required states:

```markdown
# Demo Runbook

## Workspace preparation

- Use a neutral demo account.
- Switch OfficeDex to English.
- Use a clean project and clean chat list.
- Disable system notifications and close unrelated apps.
- Ensure no API keys, local paths, personal names, or private documents can appear.

## Generation flow

1. Start a new chat.
2. Select PPTX.
3. Paste `copy/demo-prompt.txt` exactly.
4. Generate the Idea and Story Beat stage.
5. Confirm the direction.
6. Generate and confirm Chapters.
7. Generate and inspect per-page Outlines.
8. Confirm the outlines and generate PPTX.
9. Wait for assembly and layout checks to finish.
10. Open the completed deck in the PPTist review layout.

## Edit flow

1. Locate the slide containing the 90-day launch timeline.
2. Select the slide or its main timeline element.
3. Enter: `Make this launch timeline more visual.`
4. Review the proposed changes.
5. Apply the edit.
6. Confirm the local PPTX finishes saving.

## Acceptance

- The deck has a presentable cover and at least four visually distinct content slides.
- The story stages appear in English.
- The timeline edit visibly improves hierarchy or visual structure.
- The generated deck and edited result remain available after reopening the task.
```

- [ ] **Step 2: Launch the existing app build**

Run:

```bash
open build/bin/OfficeDex.app
```

Expected: OfficeDex launches without macOS blocking the app.

- [ ] **Step 3: Complete one full rehearsal without recording**

Follow the runbook from start to finish. Record the actual slide number containing the launch timeline in `marketing/ppt-launch-video/project-notes/demo-state.md`.

- [ ] **Step 4: Verify every advertised state exists**

Confirm visually:

- Idea or initial story direction
- Story Beats
- Chapters
- Per-page Outlines
- PPTX generation progress
- PPTist preview
- AI edit review and apply
- Local save completion

Expected: all eight states are present in the build used for recording. If a label differs, update the runbook and captions to describe the observed behavior without inventing a label.

- [ ] **Step 5: Commit the verified runbook**

```bash
git add marketing/ppt-launch-video/runbooks/demo-runbook.md
git commit -m "docs: add verified PPT launch demo runbook"
```

## Task 5: Create Paper & Ink Title Cards

**Files:**
- Create: `marketing/ppt-launch-video/graphics/opening.svg`
- Create: `marketing/ppt-launch-video/graphics/cta.svg`
- Create: `marketing/ppt-launch-video/scripts/render-graphics.sh`
- Reference: `build/appicon.png`

- [ ] **Step 1: Create the opening SVG**

Create `marketing/ppt-launch-video/graphics/opening.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#1A2530" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="#FCFAF2"/>
  <text x="150" y="150" fill="#74777C" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="4">OFFICEDEX · PRESENTATIONS WITH CONTROL</text>
  <text x="150" y="390" fill="#05101A" font-family="Inter, Arial, sans-serif" font-size="108" font-weight="800" letter-spacing="-5">A great presentation</text>
  <text x="150" y="525" fill="#05101A" font-family="Inter, Arial, sans-serif" font-size="108" font-weight="800" letter-spacing="-5">shouldn’t be a</text>
  <rect x="140" y="590" width="1050" height="150" rx="18" fill="#05101A"/>
  <text x="185" y="700" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="108" font-weight="800" letter-spacing="-5">one-shot gamble.</text>
  <image x="1410" y="625" width="330" height="330" xlink:href="../../../build/appicon.png" filter="url(#shadow)"/>
</svg>
```

- [ ] **Step 2: Create the CTA SVG**

Create `marketing/ppt-launch-video/graphics/cta.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="#05101A"/>
  <image x="835" y="125" width="250" height="250" xlink:href="../../../build/appicon.png" filter="url(#shadow)"/>
  <text x="960" y="535" fill="#FFFFFF" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="88" font-weight="800" letter-spacing="-4">Create presentations with control.</text>
  <rect x="665" y="645" width="590" height="112" rx="22" fill="#FFFFFF"/>
  <text x="960" y="718" fill="#05101A" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="750">Download OfficeDex  →</text>
  <text x="960" y="900" fill="#9FECFC" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="600" letter-spacing="3">FROM FIRST THOUGHT TO FINAL POLISH</text>
</svg>
```

Do not add an unverified domain name; the website player or surrounding page supplies the actual link.

- [ ] **Step 3: Create the render script**

Create `marketing/ppt-launch-video/scripts/render-graphics.sh` with:

```bash
#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT/graphics"
OUTPUT_DIR="$SOURCE_DIR/rendered"

mkdir -p "$OUTPUT_DIR"

for source in "$SOURCE_DIR/opening.svg" "$SOURCE_DIR/cta.svg"; do
  name="${source:t:r}"
  rm -f "$OUTPUT_DIR/$name.svg.png"
  qlmanage -t -s 1920 -o "$OUTPUT_DIR" "$source" >/dev/null
  mv "$OUTPUT_DIR/$name.svg.png" "$OUTPUT_DIR/$name.png"
  test -s "$OUTPUT_DIR/$name.png"
done

sips -g pixelWidth -g pixelHeight "$OUTPUT_DIR/opening.png" "$OUTPUT_DIR/cta.png"
```

- [ ] **Step 4: Render and visually inspect both cards**

Run:

```bash
chmod +x marketing/ppt-launch-video/scripts/render-graphics.sh
marketing/ppt-launch-video/scripts/render-graphics.sh
open marketing/ppt-launch-video/graphics/rendered/opening.png
open marketing/ppt-launch-video/graphics/rendered/cta.png
```

Expected: both images render at 1920×1080, the text stays inside safe margins, and the app icon is sharp.

- [ ] **Step 5: Commit the graphics sources and render script**

```bash
git add marketing/ppt-launch-video/graphics/opening.svg marketing/ppt-launch-video/graphics/cta.svg marketing/ppt-launch-video/scripts/render-graphics.sh
git commit -m "feat: add Paper and Ink launch-film title cards"
```

## Task 6: Record the Ten Product Clips

**Files:**
- Create locally: `marketing/ppt-launch-video/raw/master/*.mov`
- Create: `marketing/ppt-launch-video/runbooks/recording-checklist.md`

- [ ] **Step 1: Create the recording checklist**

Create `marketing/ppt-launch-video/runbooks/recording-checklist.md` with:

```markdown
# Recording Checklist

## Before every clip

- OfficeDex language is English.
- Window size and display scaling match the first clip.
- No notification banners, private chats, local paths, keys, or account details are visible.
- Cursor starts outside the area of interest.
- Record two seconds before the first action and two seconds after the final state.
- Move slowly and pause briefly before clicking.

## Clip names

- `03-new-task.mov`
- `04-enter-prompt.mov`
- `05-idea-story.mov`
- `06-chapters.mov`
- `07-slide-outlines.mov`
- `08-generate-deck.mov`
- `09-build-and-qa.mov`
- `10-pptist-preview.mov`
- `11-ai-edit.mov`
- `12-result.mov`
```

- [ ] **Step 2: Configure the Mac for recording**

Perform these UI actions:

1. Turn on Do Not Disturb.
2. Close Mail, Messages, Slack, browsers with private tabs, and unrelated terminal windows.
3. Set OfficeDex to a repeatable 16:9-friendly window size with the full composer and PPT workspace visible.
4. Keep the 3440×1440 external display unused unless the capture stays on it for every clip; prefer the built-in Retina display for consistency.
5. Open QuickTime Player → File → New Screen Recording.
6. Record the OfficeDex window or a fixed region, not the entire multi-display desktop.

- [ ] **Step 3: Record clips 03–07**

Record one action per file following the approved timing map. Save each file immediately with the exact checklist name under `raw/master/`.

- [ ] **Step 4: Record clips 08–12**

Use the prepared verified task for generation, preview, editing, and final-result clips. Time compression happens later in iMovie; do not rush cursor movement during capture.

- [ ] **Step 5: Verify the clip set**

Run:

```bash
find marketing/ppt-launch-video/raw/master -maxdepth 1 -type f -name '*.mov' -print | sort
```

Expected: exactly the ten filenames from `recording-checklist.md`.

- [ ] **Step 6: Inspect every clip before editing**

Open each `.mov` in QuickTime Player. Reject and re-record any clip containing private data, a notification, an accidental hover menu, a jump in window size, a failed feature state, or a rushed cursor.

- [ ] **Step 7: Commit the checklist only**

```bash
git add marketing/ppt-launch-video/runbooks/recording-checklist.md
git commit -m "docs: add launch-film recording checklist"
```

## Task 7: Assemble the 85-Second Picture Lock in iMovie

**Files:**
- Create: `marketing/ppt-launch-video/runbooks/editing-timeline.md`
- Use locally: title-card PNGs, ten product clips, and the generated narration

- [ ] **Step 1: Create the editing timeline**

Create `marketing/ppt-launch-video/runbooks/editing-timeline.md` with:

```markdown
# iMovie Editing Timeline

| Timeline | Source | Edit instruction |
| --- | --- | --- |
| 00:00–00:03 | `opening.png` | Slow 102% push-in; no cursor. |
| 00:03–00:06 | `opening.png` | Hold the hook; cut on the first music accent. |
| 00:06–00:12 | `03-new-task.mov` | Show clean workspace, PPTX selection, composer focus. |
| 00:12–00:15 | `04-enter-prompt.mov` | Speed up typing or use a clean paste; keep Generate click at the end. |
| 00:15–00:22 | `05-idea-story.mov` | Focus on appearing nodes and one approval action. |
| 00:22–00:29 | `06-chapters.mov` | Pan across representative chapter branches. |
| 00:29–00:35 | `07-slide-outlines.mov` | Move from chapter to per-page detail. |
| 00:35–00:43 | `08-generate-deck.mov` | Keep the confirm action and generation start. |
| 00:43–00:51 | `09-build-and-qa.mov` | Use speed ramps or jump cuts to compress waiting honestly. |
| 00:51–01:04 | `10-pptist-preview.mov` | Show four representative slides with calm pacing. |
| 01:04–01:18 | `11-ai-edit.mov` | Show selection, prompt, review, Apply, and visible change. |
| 01:18–01:22 | `12-result.mov` | Show improved timeline and deck overview. |
| 01:22–01:25 | `cta.png` | Hold Download OfficeDex CTA for three seconds. |
```

- [ ] **Step 2: Create the iMovie project**

Open iMovie and create a new Movie project named `OfficeDex PPT Launch 85s`.

- [ ] **Step 3: Import media**

Import:

- `graphics/rendered/opening.png`
- `graphics/rendered/cta.png`
- all ten `raw/master/*.mov` clips
- `audio/generated/narration-samantha.aiff`

Expected: all thirteen media items appear in the project media browser.

- [ ] **Step 4: Build the timeline in approved order**

Place the two graphics and ten clips according to `editing-timeline.md`. Trim each clip to the listed in/out times. Use hard cuts for product-state changes and short dissolves only where time or context jumps.

- [ ] **Step 5: Add restrained product focus**

Use iMovie crop/Ken Burns only when it improves readability. Keep moves slow and end every move on the feature being discussed. Do not use a new zoom on every clip.

- [ ] **Step 6: Add the timing voice**

Place `narration-samantha.aiff` under the complete timeline. Adjust picture timing around pauses; do not speed the voice above the approved 150 words-per-minute target.

- [ ] **Step 7: Reach picture lock**

Play the film from beginning to end three times:

1. With sound, checking pacing.
2. Muted, checking whether the story remains understandable.
3. At half the iMovie viewer size, checking whether UI focus is still clear.

Expected: total duration remains between 75 and 90 seconds, all product claims have visible evidence, and no required stage is skipped.

- [ ] **Step 8: Commit the editing runbook**

```bash
git add marketing/ppt-launch-video/runbooks/editing-timeline.md
git commit -m "docs: add iMovie launch-film timeline"
```

## Task 8: Add Final Voice, Captions, Music, and Sound

**Files:**
- Update if timing changes: `marketing/ppt-launch-video/captions/master-en.srt`
- Create: `marketing/ppt-launch-video/licenses/music.md`
- Use locally: narration and licensed music

- [ ] **Step 1: Approve or replace the timing voice**

Listen to the voice against picture lock. If Samantha sounds natural enough, keep it. Otherwise generate a warm female English voice using a free service quota and save the downloaded file under `audio/generated/`, while preserving identical narration text.

- [ ] **Step 2: Add captions manually in iMovie**

Use `captions/master-en.srt` as the timing source. Add one caption title per cue, maximum two lines, white or ink-black depending on the underlying frame, with a subtle contrasting background when necessary.

- [ ] **Step 3: Select a free commercially usable music track**

Open YouTube Audio Library and filter to `Genre: Ambient`, `Mood: Calm`, `Attribution: Not required`, and a duration between two and four minutes. Preview results from top to bottom and select the first track that has no vocals, no dramatic trailer impacts, and no dominant melody that competes with narration. Download the track to `audio/music/` and save a screenshot of the track row and license state under the local-only `project-notes/` directory.

- [ ] **Step 4: Record the license evidence**

Create `marketing/ppt-launch-video/licenses/music.md` only after the track is selected. Copy the exact title, artist, source URL, download date, displayed license terms, attribution state, downloaded filename, and local evidence-screenshot filename from the YouTube Audio Library page. Do not paraphrase the license text. Before committing, run `rg -n '\[|\]|pending value|replace me' marketing/ppt-launch-video/licenses/music.md`; the command must return no output.

- [ ] **Step 5: Mix the audio**

Set narration as the dominant track. Start music quietly, raise it slightly during generation and preview montages, lower it under every narration phrase, and let it resolve cleanly on the CTA. Add only a few UI sounds where they clarify an action.

- [ ] **Step 6: Recheck caption timing after audio lock**

Update `master-en.srt` so every cue matches the final narration and edit. No cue may extend past `00:01:25,000` unless the approved master duration changes within the 75–90 second range.

- [ ] **Step 7: Commit license and final caption timing**

```bash
git add marketing/ppt-launch-video/licenses/music.md marketing/ppt-launch-video/captions/master-en.srt
git commit -m "docs: record launch-film audio and caption timing"
```

## Task 9: Export and Validate the Master

**Files:**
- Create: `marketing/ppt-launch-video/scripts/validate-media.sh`
- Create locally: `marketing/ppt-launch-video/exports/officedex-ppt-launch-master-1080p.mp4`
- Create locally: `marketing/ppt-launch-video/exports/officedex-ppt-launch-clean-1080p.mp4`

- [ ] **Step 1: Create the media validator**

Create `marketing/ppt-launch-video/scripts/validate-media.sh` with:

```bash
#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/exports/officedex-ppt-launch-master-1080p.mp4"
CLEAN="$ROOT/exports/officedex-ppt-launch-clean-1080p.mp4"
RAW_DIR="$ROOT/raw/master"

required=(
  03-new-task.mov
  04-enter-prompt.mov
  05-idea-story.mov
  06-chapters.mov
  07-slide-outlines.mov
  08-generate-deck.mov
  09-build-and-qa.mov
  10-pptist-preview.mov
  11-ai-edit.mov
  12-result.mov
)

for file in $required; do
  test -s "$RAW_DIR/$file" || { echo "Missing clip: $file" >&2; exit 1; }
done

test -s "$MASTER" || { echo "Missing master export" >&2; exit 1; }
test -s "$CLEAN" || { echo "Missing clean export" >&2; exit 1; }

duration="$(mdls -raw -name kMDItemDurationSeconds "$MASTER")"
width="$(mdls -raw -name kMDItemPixelWidth "$MASTER")"
height="$(mdls -raw -name kMDItemPixelHeight "$MASTER")"
clean_duration="$(mdls -raw -name kMDItemDurationSeconds "$CLEAN")"
clean_width="$(mdls -raw -name kMDItemPixelWidth "$CLEAN")"
clean_height="$(mdls -raw -name kMDItemPixelHeight "$CLEAN")"

awk -v value="$duration" 'BEGIN { exit !(value >= 75 && value <= 90) }'
awk -v value="$clean_duration" 'BEGIN { exit !(value >= 75 && value <= 90) }'
test "$width" = "1920"
test "$height" = "1080"
test "$clean_width" = "1920"
test "$clean_height" = "1080"

echo "master_duration_seconds=$duration"
echo "master_dimensions=${width}x${height}"
echo "clean_duration_seconds=$clean_duration"
echo "clean_dimensions=${clean_width}x${clean_height}"
echo "required_clips=${#required[@]}"
```

- [ ] **Step 2: Export from iMovie**

Use Share → File with:

- Format: Video and Audio
- Resolution: 1080p
- Quality: High
- Compress: Better Quality
- Filename: `officedex-ppt-launch-master-1080p.mp4`
- Destination: `marketing/ppt-launch-video/exports/`

- [ ] **Step 3: Export the clean localization master**

Duplicate the approved iMovie project as `OfficeDex PPT Launch Clean 85s`. Mute the music and decorative sound-effect tracks while preserving narration and captions. Export with the same 1080p settings as `officedex-ppt-launch-clean-1080p.mp4` into `marketing/ppt-launch-video/exports/`.

- [ ] **Step 4: Run automated metadata validation**

Run:

```bash
chmod +x marketing/ppt-launch-video/scripts/validate-media.sh
marketing/ppt-launch-video/scripts/validate-media.sh
```

Expected: the script prints numeric master and clean durations between 75 and 90 seconds, `master_dimensions=1920x1080`, `clean_dimensions=1920x1080`, and `required_clips=10`, then exits with status 0.

- [ ] **Step 5: Run the full visual QA checklist**

Check the exported MP4 in QuickTime Player, not only in iMovie:

- Product claims match visible current behavior.
- Paper & Ink colors remain correct.
- No private information is visible.
- Captions are synchronized and readable.
- Narration remains louder than music.
- No clipping, frozen cursor, accidental hover, or dropped frame appears.
- The CTA remains readable for at least 2.5 seconds.
- Muted playback still communicates the complete journey.

- [ ] **Step 6: Commit the validator**

```bash
git add marketing/ppt-launch-video/scripts/validate-media.sh
git commit -m "chore: validate PPT launch-film media"
```

## Task 10: Create the X and Vertical Cutdowns

**Files:**
- Create locally: `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4`
- Create locally: `marketing/ppt-launch-video/exports/officedex-ppt-launch-vertical-20s.mp4`

- [ ] **Step 1: Duplicate the approved iMovie project**

Create copies named:

- `OfficeDex PPT Launch X 30s`
- `OfficeDex PPT Launch Vertical 20s`

Do not edit the approved master project.

- [ ] **Step 2: Build the 30-second X cutdown**

Keep:

1. The one-shot-gamble hook.
2. Prompt entry.
3. A fast Idea → Story → Outline montage.
4. PPTist preview.
5. The AI timeline edit.
6. Download OfficeDex CTA.

Remove detailed chapter explanation and most assembly waiting. Keep captions and the Paper & Ink CTA.

- [ ] **Step 3: Export the X cutdown**

Export 1920×1080 H.264 MP4 as `officedex-ppt-launch-x-30s.mp4`. Confirm duration is between 28 and 32 seconds using:

```bash
mdls -raw -name kMDItemDurationSeconds marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4
```

- [ ] **Step 4: Build the 9:16 teaser**

Create a 1080×1920 vertical project. Use large editorial text above or below a cropped OfficeDex interface. Do not shrink the full desktop UI to fit vertically. Keep only the hook, stage montage, AI edit, and CTA.

- [ ] **Step 5: Export and inspect the vertical teaser**

Export as `officedex-ppt-launch-vertical-20s.mp4`. Confirm:

- 1080×1920 dimensions
- 15–20 second duration
- captions readable at phone size
- no critical UI control cropped out
- CTA visible for at least 2.5 seconds

## Task 11: Final Platform Review and Handoff

**Files:**
- Update: `marketing/ppt-launch-video/README.md`
- Reference locally: three exports and clean project assets

- [ ] **Step 1: Review the master on the website placement**

Load the video in the actual or staging website player. Test:

- autoplay muted
- manual unmute
- full-screen playback
- responsive mobile width
- page loading behavior

- [ ] **Step 2: Review an unpublished X draft**

Upload the 85-second master or 30-second cutdown to an unpublished X draft. Check platform compression, caption readability, first-frame quality, and whether the CTA survives the crop.

- [ ] **Step 3: Review on a physical phone**

AirDrop the master and vertical teaser to a phone. Watch once with sound and once muted. Confirm that UI labels and captions are readable without zooming.

- [ ] **Step 4: Preserve the production package**

Keep locally:

- original QuickTime captures
- title-card SVG sources
- final narration file
- music file and license screenshot
- iMovie project/library
- all three approved MP4 exports
- clean master without music when localization is likely

- [ ] **Step 5: Mark the production checklist complete**

Update `marketing/ppt-launch-video/README.md` only for checks that were actually performed. Leave any unverified item unchecked.

- [ ] **Step 6: Run final repository checks and commit status**

Run:

```bash
git diff --check
git status --short marketing/ppt-launch-video
```

Expected: no whitespace errors; only intentionally tracked production documents or scripts appear.

Commit any final tracked checklist update:

```bash
git add marketing/ppt-launch-video/README.md
git commit -m "docs: complete PPT launch-film production handoff"
```

## Completion Criteria

The production is complete only when:

1. The 85-second master passes the automated 75–90 second and 1920×1080 checks.
2. All twelve approved visual beats are present: two title cards and ten real product captures.
3. The multi-stage generation, PPTist preview, and AI edit are visibly demonstrated in the current build.
4. The video is understandable when muted.
5. The warm Paper & Ink palette matches current OfficeDex branding.
6. The English narration, captions, music, and CTA pass the release QA checklist.
7. The website and unpublished X draft have both been reviewed.
8. The 30-second X cutdown and 9:16 teaser have been exported and inspected.
9. A clean 1080p master without music or decorative sound effects has been exported and validated for future localization.
10. No raw recordings, generated audio, music, editor library, or exported MP4 has been committed to git.
