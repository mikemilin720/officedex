# OfficeDex X UI Macro Launch Video Design

Date: 2026-07-18

Status: Approved creative design

Primary channel: X/Twitter

Primary language: English

## 1. Objective

Replace the current 30-second OfficeDex social cut with a tighter 20–26 second launch film that proves the new editable-PPT workflow immediately.

The central promise is:

> OfficeDex turns one prompt into a visible plan and a real presentation that remains directly editable.

The film must feel like a product launch clip rather than a screen recording with title cards. It must remain understandable when autoplay is muted, while music and restrained UI sound effects provide rhythm when audio is enabled.

## 2. Audience And Success Criteria

Primary audience:

- English-speaking knowledge workers, founders, operators, and developers who create presentations for work.
- X users encountering OfficeDex for the first time in an autoplaying feed.

Success criteria:

- The first meaningful claim appears within 0.5 seconds.
- A viewer understands “prompt → visible plan → editable deck” within 10 seconds.
- Direct canvas editing is visibly proven, not only described.
- AI-assisted editing is shown as a second editing mode, not confused with direct editing.
- Every important line is readable at normal mobile X playback size.
- The story works without audio.
- The final cut has music and restrained sound effects, but no narration.
- Final duration is between 20 and 26 seconds.

## 3. Current-Cut Audit

Audited asset:

`marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4`

The website copy is currently synced to:

`officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4`

Measured properties:

- Duration: 30.03 seconds.
- Dimensions: 1920×1080.
- Codec: H.264, `yuv420p`.
- Container frame rate: 30 fps; measured average frame rate is approximately 18.7 fps because the source contains duplicated/static frames.
- Audio: no audio stream.
- FFmpeg decode: passes.
- Black-frame detection: passes.
- Reference-skill technical checker: 82/100, with a hard freeze warning.

Creative findings:

- The current build is a seven-segment FFmpeg concat: static opening, long full-window product recordings, and static CTA.
- The opening remains unchanged for approximately four seconds.
- Multiple product states remain nearly unchanged for 1–3 seconds.
- The full OfficeDex window is frequently too dense for X playback; the viewer must search for the relevant action.
- The cut proves AI-assisted editing but does not clearly prove the breakthrough direct-click canvas editing behavior.
- The five-second button-style CTA consumes time while presenting a button that cannot be clicked inside the video.

## 4. Creative Direction

Selected direction: **UI Macro Launch Film**.

The real OfficeDex interface remains the primary visual carrier. The new cut uses:

- giant kinetic typography for category reframing and memory lines;
- tightly cropped UI macro shots for product proof;
- fast match cuts between planning stages;
- selection outlines, cursor actions, and caret movement for direct-edit proof;
- a brief before/after match cut for AI editing;
- a short brand lockup instead of a simulated download button.

The visual system continues the existing Paper & Ink product identity:

- warm paper: `#FCFAF2`;
- primary ink: `#05101A`;
- dark launch-film background: `#06131B`;
- teal interaction accent: `#16C9A2`;
- logo purple only for brand details and restrained motion accents.

Avoid generic neon-blue AI styling, decorative dashboards, mascots, stock footage, fake product UI, and cinematic effects that obscure product proof.

## 5. Storyboard

Target duration: 24 seconds at 30 fps.

| Time | Purpose | On-screen text | Visual proof | Motion | Audio |
| --- | --- | --- | --- | --- | --- |
| 0.0–1.6s | Hook | `AI presentations shouldn’t be a one-shot gamble.` | Kinetic type on dark ink background | Three hard text hits; teal accent lands on `one-shot gamble` | Low impact, two type hits, short riser |
| 1.6–4.2s | Product reveal | `One prompt. A visible plan.` | Composer action into Vibe canvas | Fast zoom/match cut; crop away navigation noise | Cursor click, short whoosh, beat begins |
| 4.2–8.0s | Visible control | `Plan. Review. Approve.` | Story Beats, Chapters, approval state | Three approximately one-second evidence cuts | Three restrained clicks on beat |
| 8.0–12.0s | Generated result | `A real deck. Still editable.` | Brief generation signal, then PPTist canvas | Progress flash into full-frame slide macro | Soft progress ticks, completion tone |
| 12.0–17.8s | Breakthrough proof | `Click in. Edit directly.` | Click text element, selection/caret, edit several words, commit | Macro crop follows pointer and caret; no full desktop hold | Click, light key taps, confirm tick |
| 17.8–21.2s | AI-edit payoff | No paragraph; small `BEFORE` / `AFTER` labels | Existing horizontal-to-vertical roadmap change | Request flash, apply hit, before/after match cut | Swipe, apply hit, bright completion tone |
| 21.2–24.0s | Brand close | `FROM PROMPT TO EDITABLE PPTX.` / `OFFICEDEX · OPEN SOURCE` | Clean brand lockup | Subtle scale and accent-line resolve | Music resolves without an oversized boom |

## 6. Asset Plan

Reuse from the current production:

- planning and approval captures;
- finished PPTist deck capture;
- AI edit request and before/after roadmap result;
- OfficeDex logo and Paper & Ink palette;
- existing opening and CTA graphics as source material only, not as long static scenes.

New required capture:

- One 4–6 second 1920×1080, 30 fps clip showing direct canvas editing in the current OfficeDex build.
- The clip must show a visible click target, selected element state or selection handles, text caret, a short text change, and the committed result.
- Use an English-only, non-sensitive demo workspace with stable window dimensions and deliberate cursor motion.
- Confirm the behavior works in the packaged build before recording.

Optional asset upgrades:

- one clean prompt/composer macro capture if the current footage cannot support a readable crop;
- one short stage-approval capture if the current cursor path is distracting;
- generated waveform, scanline, or light-sweep textures only as secondary motion accents.

## 7. Audio Design

Selected route: music plus UI sound effects, no narration.

Music direction:

- modern electronic/ambient pulse around 116–124 BPM;
- clear transient structure for cuts without sounding like a gaming trailer;
- restrained low end and no dominant melody competing with on-screen copy;
- commercially compatible license documented in `marketing/ppt-launch-video/licenses/music.md`.

Sound effects:

- one opening impact;
- two typography hits;
- cursor clicks for real actions only;
- short whooshes for macro transitions;
- restrained key taps during direct text editing;
- one apply hit and one completion tone.

Mix target:

- final web mix around -16 to -14 LUFS;
- true peak at or below -1.5 dBTP;
- coarse `volumedetect` mean between approximately -22 and -16 dB;
- coarse maximum below -1 dB;
- no sound effect may imply a product action that is not visible.

## 8. Implementation Architecture

Use a small, isolated frame-accurate composition under:

`marketing/ppt-launch-video/remotion/`

Recommended implementation stack:

- Remotion DOM for timeline, kinetic typography, UI crops, focus masks, cursor overlays, and audio timing;
- existing real MP4/WebM captures as product evidence;
- SVG/PNG brand assets already in `marketing/ppt-launch-video/graphics/`;
- FFmpeg for final codec normalization, contact sheet generation, loudness measurement, decode checks, black/freeze detection, and X-ready export.

The new composition must not replace or refactor OfficeDex product code. It is an isolated marketing-video build.

Suggested scene boundaries:

- `HookScene`
- `PromptToPlanScene`
- `ApproveScene`
- `DeckRevealScene`
- `DirectEditScene`
- `AIEditPayoffScene`
- `BrandLockupScene`

All timing, text, colors, and source paths should be data-driven from a single composition configuration so later cutdowns can reuse the same source without duplicating scene logic.

## 9. Delivery And Integration

Candidate output:

`marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4`

After approval and QA, replace the canonical social asset:

`marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4`

Then sync the validated bytes to:

`officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4`

Keeping the canonical filename avoids unnecessary website component and test changes. The previous cut should remain recoverable through Git history; no duplicate backup binary is required in the repository.

Deliver alongside the final video:

- final contact sheet;
- quality report JSON;
- audio source/license record;
- exact source files and captures used;
- explicit list of any remaining draft-quality assets.

## 10. Quality Gates

The candidate is not final until all of the following pass:

- FFmpeg decodes the entire MP4 without errors.
- Video is 1920×1080 H.264, `yuv420p`, 30 fps, with `+faststart`.
- Duration is between 20 and 26 seconds.
- An AAC audio stream is present.
- Loudness and peak targets in this design are met.
- No unintended black interval is detected.
- No unintended frozen interval longer than one second is detected; every longer hold must include visible motion.
- Contact sheet shows at least nine meaningfully distinct visual states.
- Direct canvas editing is legible and visibly successful.
- AI edit before/after states are distinguishable without reading chat text.
- The first and final claims remain readable on a phone-sized X preview.
- The file is tested in an unpublished X draft before replacing the public asset.
- The reference-driven quality checker scores at least 90/100 with no hard failures.

## 11. Risks And Mitigations

- **UI text becomes unreadable after cropping:** use macro crops and recompose only the necessary real UI region instead of scaling the entire window.
- **Current capture duplicates too many frames:** use motion generated by the composition and recapture the direct-edit proof at stable 30 fps.
- **Music license is unclear:** do not ship the track; choose a clearly licensed replacement and record its source.
- **Direct edit is not visibly obvious:** require selection/caret/change/result in one continuous proof shot.
- **Effects overpower the product:** use one primary carrier, real UI macro, and keep light sweeps/scanlines secondary.
- **X compression softens UI:** use large copy, high local contrast, conservative fine detail, and test an unpublished upload.
- **External reference repository has no declared license:** learn only its workflow and quality criteria; do not copy its code, sample video, graphics, music, or other assets into OfficeDex.

## 12. Scope Boundary

Included:

- one redesigned 16:9 X launch clip;
- one direct-edit recapture;
- music and restrained sound effects;
- reusable frame-accurate marketing composition;
- technical and visual QA;
- final sync to the existing website media path after approval.

Excluded:

- product UI changes;
- voiceover or synthetic voice work;
- a new 85-second master film;
- vertical or square cutdowns;
- paid-media variants;
- localization beyond English;
- copying assets or source code from the external reference repository.
