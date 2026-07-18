# OfficeDex X UI Macro Launch Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and ship a 20–26 second X-first OfficeDex launch film that proves prompt-to-plan, direct PPT canvas editing, and AI editing with frame-accurate UI macro motion plus an original music/SFX mix.

**Architecture:** Add an isolated Remotion project under `marketing/ppt-launch-video/remotion/`, stage verified real-product media into its `public/` directory, and compose seven data-driven scenes at 1920×1080/30 fps. Keep product code untouched; use Playwright only to capture the missing direct-edit proof, then use FFmpeg scripts for audio generation, final normalization, contact sheets, and delivery gates before promoting the candidate to the existing canonical website filename.

**Tech Stack:** Remotion 4.0.490, React 19.2.7, TypeScript 5.9.3, Vitest 4.1.10, Playwright, FFmpeg/ffprobe, Node.js.

---

## File Structure

### OfficeDex repository

- Create `marketing/ppt-launch-video/remotion/package.json` — isolated render dependencies and scripts.
- Create `marketing/ppt-launch-video/remotion/package-lock.json` — reproducible dependency lock.
- Create `marketing/ppt-launch-video/remotion/tsconfig.json` — strict TypeScript settings.
- Create `marketing/ppt-launch-video/remotion/src/index.ts` — Remotion registration entrypoint.
- Create `marketing/ppt-launch-video/remotion/src/Root.tsx` — composition registration.
- Create `marketing/ppt-launch-video/remotion/src/config.ts` — timeline, copy, palette, and source-media contract.
- Create `marketing/ppt-launch-video/remotion/src/config.test.ts` — total-duration and scene-boundary tests.
- Create `marketing/ppt-launch-video/remotion/src/components.tsx` — shared kinetic type, macro crop, focus mask, and brand primitives.
- Create `marketing/ppt-launch-video/remotion/src/scenes.tsx` — seven approved storyboard scenes.
- Create `marketing/ppt-launch-video/remotion/src/OfficeDexXLaunch.tsx` — sequence assembly and audio timeline.
- Create `marketing/ppt-launch-video/remotion/scripts/stage-assets.mjs` — verify and copy media into `public/`.
- Create `marketing/ppt-launch-video/remotion/scripts/stage-assets.test.mjs` — staging contract tests.
- Create `marketing/ppt-launch-video/scripts/capture-direct-edit.mjs` — record the missing direct-canvas-edit proof from the embedded PPTist build.
- Create `marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh` — generate an original 24-second pulse bed and UI SFX.
- Create `marketing/ppt-launch-video/scripts/build-ui-macro.sh` — install, stage, render, normalize, and validate the candidate.
- Create `marketing/ppt-launch-video/scripts/validate-ui-macro.sh` — delivery checks and contact-sheet generation.
- Create `marketing/ppt-launch-video/audio/generated/` — generated audio outputs, ignored except final approved assets.
- Create `marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm` — real direct-edit capture.
- Modify `marketing/ppt-launch-video/.gitignore` — ignore Remotion cache, staged public media, temporary renders, and intermediate audio.
- Modify `marketing/ppt-launch-video/README.md` — document the UI Macro build and validation workflow.
- Modify `marketing/ppt-launch-video/licenses/music.md` — record that final audio is generated in-repo and contains no third-party source track.
- Modify `marketing/ppt-launch-video/scripts/validate-media.sh` — require audio for the canonical X cut while retaining silent-master checks.
- Replace `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4` only after final approval.

### Website repository

- Replace `officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4` with the validated canonical bytes.
- Verify `officecli-internal/platform/web/site/src/components/OfficeDexDemoVideo.test.tsx` and the production site build without changing the component API.

---

### Task 1: Bootstrap The Isolated Remotion Project

**Files:**
- Create: `marketing/ppt-launch-video/remotion/package.json`
- Create: `marketing/ppt-launch-video/remotion/tsconfig.json`
- Create: `marketing/ppt-launch-video/remotion/src/index.ts`
- Create: `marketing/ppt-launch-video/remotion/src/Root.tsx`
- Modify: `marketing/ppt-launch-video/.gitignore`

- [ ] **Step 1: Add the isolated package manifest**

Create `marketing/ppt-launch-video/remotion/package.json`:

```json
{
  "name": "officedex-ppt-launch-video",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "render:candidate": "remotion render src/index.ts OfficeDexXLaunch ../exports/officedex-ppt-launch-x-ui-macro-24s.raw.mp4 --codec h264 --audio-codec aac --pixel-format yuv420p --crf 18",
    "still": "remotion still src/index.ts OfficeDexXLaunch /tmp/officedex-x-ui-macro-still.png --frame=450",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@remotion/cli": "4.0.490",
    "@remotion/media": "4.0.490",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "remotion": "4.0.490"
  },
  "devDependencies": {
    "@types/node": "22.13.10",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 2: Add strict TypeScript settings**

Create `marketing/ppt-launch-video/remotion/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Register the composition entrypoint**

Create `marketing/ppt-launch-video/remotion/src/index.ts`:

```ts
import {registerRoot} from 'remotion';
import {Root} from './Root';

registerRoot(Root);
```

Create `marketing/ppt-launch-video/remotion/src/Root.tsx` initially as:

```tsx
import {Composition} from 'remotion';
import {OfficeDexXLaunch} from './OfficeDexXLaunch';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './config';

export const Root = () => (
  <Composition
    id="OfficeDexXLaunch"
    component={OfficeDexXLaunch}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
```

The imports intentionally fail until Tasks 2 and 6 add the timeline and composition.

- [ ] **Step 4: Ignore only generated Remotion artifacts**

Append to `marketing/ppt-launch-video/.gitignore`:

```gitignore
remotion/node_modules/
remotion/public/assets/
exports/*.raw.mp4
audio/generated/*.tmp.*
```

- [ ] **Step 5: Install through the project-mandated proxy**

Run:

```bash
cd marketing/ppt-launch-video/remotion
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
npm_config_proxy=http://127.0.0.1:7890 \
npm_config_https_proxy=http://127.0.0.1:7890 \
npm install
```

Expected: `package-lock.json` is created and all pinned Remotion packages resolve to `4.0.490`.

- [ ] **Step 6: Commit the scaffold**

```bash
git add marketing/ppt-launch-video/.gitignore \
  marketing/ppt-launch-video/remotion/package.json \
  marketing/ppt-launch-video/remotion/package-lock.json \
  marketing/ppt-launch-video/remotion/tsconfig.json \
  marketing/ppt-launch-video/remotion/src/index.ts \
  marketing/ppt-launch-video/remotion/src/Root.tsx
git commit -m "build: scaffold OfficeDex launch video composition"
```

### Task 2: Lock The 24-Second Timeline Contract

**Files:**
- Create: `marketing/ppt-launch-video/remotion/src/config.test.ts`
- Create: `marketing/ppt-launch-video/remotion/src/config.ts`

- [ ] **Step 1: Write the failing timeline tests**

Create `marketing/ppt-launch-video/remotion/src/config.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {FPS, SCENES, TOTAL_FRAMES, sceneEntries} from './config';

describe('OfficeDex X launch timeline', () => {
  it('is exactly 24 seconds at 30 fps', () => {
    expect(FPS).toBe(30);
    expect(TOTAL_FRAMES).toBe(720);
  });

  it('has contiguous, non-overlapping scene ranges', () => {
    const entries = sceneEntries();
    expect(entries[0].from).toBe(0);
    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index].from).toBe(
        entries[index - 1].from + entries[index - 1].duration,
      );
    }
    const last = entries.at(-1)!;
    expect(last.from + last.duration).toBe(TOTAL_FRAMES);
  });

  it('allocates the approved direct-edit proof 174 frames', () => {
    expect(SCENES.directEdit.duration).toBe(174);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd marketing/ppt-launch-video/remotion
npm test -- src/config.test.ts
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Implement the exact timeline and visual constants**

Create `marketing/ppt-launch-video/remotion/src/config.ts`:

```ts
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 720;

export const COLORS = {
  paper: '#FCFAF2',
  ink: '#05101A',
  dark: '#06131B',
  body: '#1A2530',
  teal: '#16C9A2',
  purple: '#6D50D6',
  white: '#FFFFFF',
} as const;

export const SCENES = {
  hook: {duration: 48},
  promptToPlan: {duration: 78},
  approve: {duration: 114},
  deckReveal: {duration: 120},
  directEdit: {duration: 174},
  aiEdit: {duration: 102},
  brand: {duration: 84},
} as const;

export type SceneName = keyof typeof SCENES;

export const sceneEntries = () => {
  let from = 0;
  return (Object.entries(SCENES) as [SceneName, {duration: number}][]).map(
    ([name, scene]) => {
      const entry = {name, from, duration: scene.duration};
      from += scene.duration;
      return entry;
    },
  );
};

export const COPY = {
  hook: ['AI PRESENTATIONS', 'SHOULDN’T BE A', 'ONE-SHOT GAMBLE.'],
  prompt: ['ONE PROMPT.', 'A VISIBLE PLAN.'],
  approve: ['PLAN.', 'REVIEW.', 'APPROVE.'],
  deck: ['A REAL DECK.', 'STILL EDITABLE.'],
  directEdit: ['CLICK IN.', 'EDIT DIRECTLY.'],
  brand: ['FROM PROMPT TO', 'EDITABLE PPTX.'],
} as const;

export const MEDIA = {
  cleanMaster: 'media/source-clean.mp4',
  directEdit: 'media/direct-edit.webm',
  music: 'audio/music-bed.wav',
  typeHit: 'audio/type-hit.wav',
  click: 'audio/click.wav',
  whoosh: 'audio/whoosh.wav',
  complete: 'audio/complete.wav',
} as const;
```

- [ ] **Step 4: Run tests and typecheck**

```bash
cd marketing/ppt-launch-video/remotion
npm test -- src/config.test.ts
npm run typecheck
```

Expected: timeline tests PASS; typecheck may still fail only on the intentionally missing `OfficeDexXLaunch` until Task 6. If so, temporarily create `src/OfficeDexXLaunch.tsx` with `export const OfficeDexXLaunch = () => null;` and remove that stub in Task 6.

- [ ] **Step 5: Commit the timeline contract**

```bash
git add marketing/ppt-launch-video/remotion/src/config.ts \
  marketing/ppt-launch-video/remotion/src/config.test.ts \
  marketing/ppt-launch-video/remotion/src/OfficeDexXLaunch.tsx
git commit -m "test: lock OfficeDex launch video timeline"
```

### Task 3: Capture The Missing Direct-Canvas-Edit Proof

**Files:**
- Create: `marketing/ppt-launch-video/scripts/capture-direct-edit.mjs`
- Create: `marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm`
- Use fixture: `internal/demoflow/testdata/launch-strategy-demo.officecli.pptx`

- [ ] **Step 1: Add the deterministic capture script**

Create `marketing/ppt-launch-video/scripts/capture-direct-edit.mjs`:

```js
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {chromium} from 'playwright';

const root = process.cwd();
const url = process.env.PPTIST_CAPTURE_URL ||
  'http://127.0.0.1:3100/pptist/?mode=embed&editable=1&pptxPerformance=1&lang=en';
const pptx = path.join(root, 'internal/demoflow/testdata/launch-strategy-demo.officecli.pptx');
const outputDir = path.join(root, 'marketing/ppt-launch-video/raw/direct-edit');
const output = path.join(outputDir, 'officedex-direct-edit-1080p.webm');
const fullRecording = path.join(outputDir, 'officedex-direct-edit-full.webm');

await mkdir(outputDir, {recursive: true});
await rm(output, {force: true});
await rm(fullRecording, {force: true});
const videoDir = path.join(outputDir, '.recording');
await rm(videoDir, {recursive: true, force: true});
await mkdir(videoDir, {recursive: true});

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  viewport: {width: 1920, height: 1080},
  recordVideo: {dir: videoDir, size: {width: 1920, height: 1080}},
});
const page = await context.newPage();
await page.addInitScript(() => {
  window.__pptistMessages = [];
  window.addEventListener('message', (event) => {
    if (event.data?.type?.startsWith?.('pptist:')) {
      window.__pptistMessages.push(event.data);
    }
  });
});

await page.goto(url, {waitUntil: 'domcontentloaded'});
await page.waitForFunction(() =>
  window.__pptistMessages?.some((message) => message.type === 'pptist:embed-ready'),
);
const bytes = [...await readFile(pptx)];
await page.evaluate((payload) => {
  const buffer = new Uint8Array(payload).buffer;
  window.postMessage({
    type: 'pptist:load-pptx',
    buffer,
    fileName: 'launch-strategy-demo.pptx',
    animate: false,
    importRunId: 'direct-edit-capture',
  }, '*', [buffer]);
}, bytes);
await page.waitForFunction(() =>
  window.__pptistMessages?.some((message) => message.type === 'pptist:slides-loaded'),
);

const content = page.locator('.editable-element-text .element-content').first();
await content.waitFor({state: 'visible'});
await page.waitForTimeout(650);
await content.click();
await page.waitForTimeout(450);
await content.dblclick();
const editor = page.locator('.editable-element-text .ProseMirror[contenteditable="true"]').first();
await editor.waitFor({state: 'visible'});
await page.waitForTimeout(350);
await editor.fill('Launch proof, refined.');
await page.waitForTimeout(900);

const recorded = page.video();
await context.close();
await browser.close();
const source = await recorded.path();
await rename(source, fullRecording);
const duration = Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', fullRecording,
], {encoding: 'utf8'}).trim());
const start = Math.max(0, duration - 4.5).toFixed(3);
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-ss', start,
  '-i', fullRecording, '-t', '4.5', '-an', '-c:v', 'libvpx-vp9',
  '-crf', '24', '-b:v', '0', output,
], {stdio: 'inherit'});
await rm(fullRecording, {force: true});
await rm(videoDir, {recursive: true, force: true});
console.log(output);
```

- [ ] **Step 2: Rebuild the current embedded PPTist bundle**

Run from the OfficeDex repo root:

```bash
npm run build:pptist
```

Expected: `public/pptist/index.html` references the current rebuilt asset.

- [ ] **Step 3: Start the browser dev server and record the proof**

In one PTY:

```bash
npm run dev:browser
```

In another PTY:

```bash
node marketing/ppt-launch-video/scripts/capture-direct-edit.mjs
```

Expected: the script exits 0 and creates `raw/direct-edit/officedex-direct-edit-1080p.webm`.

- [ ] **Step 4: Verify the capture**

```bash
ffprobe -v error \
  -show_entries format=duration:stream=codec_name,width,height,avg_frame_rate \
  -of json \
  marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm
ffmpeg -v error \
  -i marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm \
  -f null -
```

Expected: 1920×1080 VP8/VP9 WebM, duration between 3 and 8 seconds, decode exit 0. Visually inspect a contact sheet and confirm click, selection/caret, changed text, and committed result all appear.

- [ ] **Step 5: Commit capture tooling and approved proof footage**

```bash
git add marketing/ppt-launch-video/scripts/capture-direct-edit.mjs \
  marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm
git commit -m "feat: capture direct PPT canvas editing proof"
```

### Task 4: Generate Original Music And UI Sound Effects

**Files:**
- Create: `marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh`
- Create: `marketing/ppt-launch-video/audio/generated/music-bed.wav`
- Create: `marketing/ppt-launch-video/audio/generated/type-hit.wav`
- Create: `marketing/ppt-launch-video/audio/generated/click.wav`
- Create: `marketing/ppt-launch-video/audio/generated/whoosh.wav`
- Create: `marketing/ppt-launch-video/audio/generated/complete.wav`
- Modify: `marketing/ppt-launch-video/licenses/music.md`

- [ ] **Step 1: Add a reproducible FFmpeg audio generator**

Create `marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/audio/generated"
mkdir -p "$OUT"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=55:duration=24:sample_rate=48000" \
  -f lavfi -i "sine=frequency=110:duration=24:sample_rate=48000" \
  -f lavfi -i "anoisesrc=color=pink:duration=24:sample_rate=48000" \
  -filter_complex \
  "[0:a]volume='if(lt(mod(t,0.5),0.09),0.24*exp(-32*mod(t,0.5)),0)':eval=frame[kick];
   [1:a]lowpass=f=900,volume=0.035[pad];
   [2:a]highpass=f=5500,lowpass=f=11000,volume='if(lt(mod(t+0.25,0.5),0.035),0.016,0)':eval=frame[hats];
   [kick][pad][hats]amix=inputs=3:normalize=0,
   afade=t=in:st=0:d=0.7,afade=t=out:st=22.5:d=1.5,
   loudnorm=I=-19:LRA=7:TP=-2[a]" \
  -map "[a]" -ar 48000 -c:a pcm_s16le "$OUT/music-bed.wav"

ffmpeg -hide_banner -loglevel error -y -f lavfi \
  -i "sine=frequency=92:duration=0.18:sample_rate=48000" \
  -af "afade=t=out:st=0.03:d=0.15,volume=0.45" "$OUT/type-hit.wav"

ffmpeg -hide_banner -loglevel error -y -f lavfi \
  -i "sine=frequency=1400:duration=0.08:sample_rate=48000" \
  -af "afade=t=out:st=0.01:d=0.07,volume=0.2" "$OUT/click.wav"

ffmpeg -hide_banner -loglevel error -y -f lavfi \
  -i "anoisesrc=color=white:duration=0.42:sample_rate=48000" \
  -af "highpass=f=900,lowpass=f=7000,afade=t=in:d=0.05,afade=t=out:st=0.18:d=0.24,volume=0.06" \
  "$OUT/whoosh.wav"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=659.25:duration=0.45:sample_rate=48000" \
  -f lavfi -i "sine=frequency=987.77:duration=0.45:sample_rate=48000" \
  -filter_complex "[0:a]volume=0.12[a0];[1:a]volume=0.07[a1];[a0][a1]amix=2,afade=t=out:st=0.18:d=0.27[a]" \
  -map "[a]" "$OUT/complete.wav"
```

- [ ] **Step 2: Generate and verify the audio assets**

```bash
chmod +x marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh
marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh
for file in marketing/ppt-launch-video/audio/generated/*.wav; do
  ffmpeg -v error -i "$file" -f null -
done
```

Expected: five decodable 48 kHz WAV files; `music-bed.wav` is exactly 24 seconds.

- [ ] **Step 3: Record the source and license status**

Replace `marketing/ppt-launch-video/licenses/music.md` with:

```markdown
# Music and audio license record

The OfficeDex UI Macro X cut uses no third-party music, narration, or stock sound effects.

All audio files are generated locally by `scripts/generate-ui-macro-audio.sh` using FFmpeg synthesis filters:

- `audio/generated/music-bed.wav`
- `audio/generated/type-hit.wav`
- `audio/generated/click.wav`
- `audio/generated/whoosh.wav`
- `audio/generated/complete.wav`

No external attribution is required. The generated mix remains subject to the OfficeDex repository license when distributed as part of the project.
```

- [ ] **Step 4: Commit the reproducible audio source and approved WAVs**

```bash
git add marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh \
  marketing/ppt-launch-video/audio/generated/*.wav \
  marketing/ppt-launch-video/licenses/music.md
git commit -m "feat: add original launch video sound design"
```

### Task 5: Add Deterministic Asset Staging

**Files:**
- Create: `marketing/ppt-launch-video/remotion/scripts/stage-assets.test.mjs`
- Create: `marketing/ppt-launch-video/remotion/scripts/stage-assets.mjs`

- [ ] **Step 1: Write the failing staging test**

Create `marketing/ppt-launch-video/remotion/scripts/stage-assets.test.mjs`:

```js
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {stageAssets} from './stage-assets.mjs';

test('stages every required video and audio asset', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'officedex-video-assets-'));
  const source = path.join(root, 'source');
  const target = path.join(root, 'public');
  await mkdir(source, {recursive: true});
  const files = ['source-clean.mp4', 'direct-edit.webm', 'music-bed.wav', 'type-hit.wav', 'click.wav', 'whoosh.wav', 'complete.wav'];
  for (const file of files) await writeFile(path.join(source, file), file);
  await stageAssets({source, target});
  for (const file of files) {
    assert.equal((await readFile(path.join(target, file))).toString(), file);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd marketing/ppt-launch-video/remotion
node --test scripts/stage-assets.test.mjs
```

Expected: FAIL because `stage-assets.mjs` does not exist.

- [ ] **Step 3: Implement strict staging**

Create `marketing/ppt-launch-video/remotion/scripts/stage-assets.mjs` with an exported `stageAssets({source,target})` helper. The CLI mode must map the real project files to stable staged names:

```js
import {copyFile, mkdir, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const required = [
  'source-clean.mp4', 'direct-edit.webm', 'music-bed.wav',
  'type-hit.wav', 'click.wav', 'whoosh.wav', 'complete.wav',
];

export async function stageAssets({source, target}) {
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  for (const name of required) {
    const input = path.join(source, name);
    const info = await stat(input);
    if (!info.isFile() || info.size === 0) throw new Error(`invalid asset: ${input}`);
    await copyFile(input, path.join(target, name));
  }
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const remotionRoot = path.dirname(path.dirname(self));
  const projectRoot = path.dirname(remotionRoot);
  const tempSource = path.join(remotionRoot, '.staging-source');
  await rm(tempSource, {recursive: true, force: true});
  await mkdir(tempSource, {recursive: true});
  const mappings = new Map([
    ['source-clean.mp4', path.join(projectRoot, 'exports/officedex-ppt-launch-clean-1080p.mp4')],
    ['direct-edit.webm', path.join(projectRoot, 'raw/direct-edit/officedex-direct-edit-1080p.webm')],
    ['music-bed.wav', path.join(projectRoot, 'audio/generated/music-bed.wav')],
    ['type-hit.wav', path.join(projectRoot, 'audio/generated/type-hit.wav')],
    ['click.wav', path.join(projectRoot, 'audio/generated/click.wav')],
    ['whoosh.wav', path.join(projectRoot, 'audio/generated/whoosh.wav')],
    ['complete.wav', path.join(projectRoot, 'audio/generated/complete.wav')],
  ]);
  for (const [name, input] of mappings) await copyFile(input, path.join(tempSource, name));
  await stageAssets({source: tempSource, target: path.join(remotionRoot, 'public/assets')});
  await rm(tempSource, {recursive: true, force: true});
}
```

Update `MEDIA` in `src/config.ts` so every path starts with `assets/`.

- [ ] **Step 4: Run the staging tests and real staging**

```bash
cd marketing/ppt-launch-video/remotion
node --test scripts/stage-assets.test.mjs
node scripts/stage-assets.mjs
find public/assets -type f -size 0 -print | grep . && exit 1 || true
```

Expected: test PASS; seven non-empty staged assets.

- [ ] **Step 5: Commit the staging contract**

```bash
git add marketing/ppt-launch-video/remotion/scripts \
  marketing/ppt-launch-video/remotion/src/config.ts
git commit -m "build: stage verified launch video assets"
```

### Task 6: Build Shared Motion Primitives And Approved Scenes

**Files:**
- Create: `marketing/ppt-launch-video/remotion/src/components.tsx`
- Create: `marketing/ppt-launch-video/remotion/src/scenes.tsx`
- Modify: `marketing/ppt-launch-video/remotion/src/OfficeDexXLaunch.tsx`

- [ ] **Step 1: Implement shared primitives**

Create `marketing/ppt-launch-video/remotion/src/components.tsx`:

```tsx
import type {CSSProperties, ReactNode} from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {COLORS} from './config';

export const KineticHeadline: React.FC<{
  lines: readonly string[];
  accentLine?: number;
  align?: 'left' | 'center';
  size?: number;
}> = ({lines, accentLine = -1, align = 'left', size = 112}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{textAlign: align, fontFamily: 'Inter, Arial, sans-serif'}}>
      {lines.map((line, index) => {
        const enter = spring({frame: frame - index * 8, fps, config: {damping: 18, stiffness: 180}});
        const y = interpolate(enter, [0, 1], [48, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={line} style={{
            color: index === accentLine ? COLORS.teal : COLORS.white,
            fontSize: size,
            fontWeight: 900,
            letterSpacing: -5,
            lineHeight: 0.94,
            opacity: enter,
            transform: `translateY(${y}px)`,
          }}>{line}</div>
        );
      })}
    </div>
  );
};

export const UIMacro: React.FC<{
  src: string;
  startFrom: number;
  playbackRate?: number;
  scale: number;
  x: number;
  y: number;
  darken?: number;
}> = ({src, startFrom, playbackRate = 1, scale, x, y, darken = 0}) => (
  <AbsoluteFill style={{overflow: 'hidden', backgroundColor: COLORS.paper}}>
    <OffthreadVideo
      src={staticFile(src)}
      startFrom={startFrom}
      playbackRate={playbackRate}
      muted
      style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${x}px, ${y}px) scale(${scale})`}}
    />
    {darken > 0 ? <AbsoluteFill style={{backgroundColor: `rgba(3, 10, 16, ${darken})`}} /> : null}
  </AbsoluteFill>
);

export const FocusFrame: React.FC<{left: number; top: number; width: number; height: number}> = (props) => (
  <div style={{
    position: 'absolute', left: `${props.left}%`, top: `${props.top}%`,
    width: `${props.width}%`, height: `${props.height}%`, border: `5px solid ${COLORS.teal}`,
    borderRadius: 18, boxShadow: `0 0 0 9999px rgba(3,10,16,.24), 0 0 42px ${COLORS.teal}77`,
  }} />
);

export const CopyOverlay: React.FC<{children: ReactNode; style?: CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', left: 86, top: 82, zIndex: 4, ...style}}>{children}</div>
);

export const BrandLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [0, 40], [0.96, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 75% 25%, #29316f 0%, #091923 38%, #031018 72%)'}}>
      <div style={{opacity, transform: `scale(${scale})`, textAlign: 'center', color: COLORS.white, fontFamily: 'Inter, Arial, sans-serif'}}>
        <div style={{fontSize: 112, lineHeight: 0.95, fontWeight: 900, letterSpacing: -6}}>FROM PROMPT TO<br />EDITABLE PPTX.</div>
        <div style={{marginTop: 34, color: COLORS.teal, fontSize: 24, fontWeight: 800, letterSpacing: 7}}>OFFICEDEX · OPEN SOURCE</div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Typecheck the primitives**

```bash
cd marketing/ppt-launch-video/remotion
npm run typecheck
```

Expected: no component prop or Remotion API errors.

- [ ] **Step 3: Implement all seven scenes in `scenes.tsx`**

Create `marketing/ppt-launch-video/remotion/src/scenes.tsx`:

```tsx
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {BrandLockup, CopyOverlay, FocusFrame, KineticHeadline, UIMacro} from './components';
import {COLORS, COPY, MEDIA} from './config';

const darkCopy = {fontFamily: 'Inter, Arial, sans-serif', fontWeight: 900, fontSize: 86, lineHeight: 0.96, letterSpacing: -4, color: COLORS.white};

export const HookScene: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: COLORS.dark, justifyContent: 'center', paddingLeft: 110}}>
    <KineticHeadline lines={COPY.hook} accentLine={2} size={118} />
  </AbsoluteFill>
);

export const PromptToPlanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const second = frame >= 38;
  return (
    <AbsoluteFill>
      <UIMacro src={MEDIA.cleanMaster} startFrom={210} playbackRate={1.35} scale={1.34} x={-150} y={-16} darken={0.28} />
      <FocusFrame left={49} top={31} width={36} height={31} />
      <CopyOverlay><div style={darkCopy}>{second ? 'A VISIBLE PLAN.' : 'ONE PROMPT.'}</div></CopyOverlay>
    </AbsoluteFill>
  );
};

export const ApproveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const index = Math.min(2, Math.floor(frame / 38));
  const words = COPY.approve;
  const focus = [
    {left: 23, top: 29, width: 22, height: 39},
    {left: 46, top: 27, width: 22, height: 42},
    {left: 66, top: 20, width: 18, height: 30},
  ][index];
  return (
    <AbsoluteFill>
      <UIMacro src={MEDIA.cleanMaster} startFrom={720 + index * 32} playbackRate={1.2} scale={1.28} x={-90} y={0} darken={0.22} />
      <FocusFrame {...focus} />
      <CopyOverlay><div style={darkCopy}>{words[index]}</div></CopyOverlay>
    </AbsoluteFill>
  );
};

export const DeckRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      <UIMacro src={MEDIA.cleanMaster} startFrom={1470} playbackRate={1.4} scale={1.38} x={-205} y={-35} darken={0.26} />
      <div style={{position: 'absolute', left: 0, top: 0, width: `${100 - progress * 100}%`, height: '100%', backgroundColor: COLORS.paper, opacity: 0.92}} />
      <CopyOverlay><div style={darkCopy}>A REAL DECK.<br /><span style={{color: COLORS.teal}}>STILL EDITABLE.</span></div></CopyOverlay>
    </AbsoluteFill>
  );
};

export const DirectEditScene: React.FC = () => {
  const frame = useCurrentFrame();
  const caretOpacity = frame > 64 && frame < 145 ? 1 : 0;
  return (
    <AbsoluteFill>
      <UIMacro src={MEDIA.directEdit} startFrom={0} playbackRate={1} scale={1.17} x={-62} y={-22} darken={0.12} />
      <FocusFrame left={18} top={24} width={64} height={59} />
      <div style={{position: 'absolute', left: '51%', top: '43%', width: 4, height: 56, background: COLORS.teal, opacity: caretOpacity, boxShadow: `0 0 18px ${COLORS.teal}`}} />
      <CopyOverlay><div style={darkCopy}>CLICK IN.<br /><span style={{color: COLORS.teal}}>EDIT DIRECTLY.</span></div></CopyOverlay>
    </AbsoluteFill>
  );
};

const Half: React.FC<{after?: boolean}> = ({after = false}) => (
  <div style={{position: 'relative', overflow: 'hidden', flex: 1}}>
    <UIMacro src={MEDIA.cleanMaster} startFrom={after ? 2190 : 1920} scale={1.42} x={after ? -360 : -70} y={-30} darken={0.05} />
    <div style={{position: 'absolute', top: 28, left: 30, padding: '10px 16px', borderRadius: 8, backgroundColor: after ? COLORS.teal : COLORS.ink, color: COLORS.white, fontFamily: 'Inter, Arial', fontSize: 22, fontWeight: 900, letterSpacing: 3}}>{after ? 'AFTER' : 'BEFORE'}</div>
  </div>
);

export const AIEditPayoffScene: React.FC = () => (
  <AbsoluteFill style={{display: 'flex', flexDirection: 'row', gap: 4, backgroundColor: COLORS.dark}}>
    <Half />
    <Half after />
  </AbsoluteFill>
);

export const BrandScene: React.FC = BrandLockup;
```

- [ ] **Step 4: Replace the stub with sequence assembly and audio**

Implement `OfficeDexXLaunch.tsx`:

```tsx
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {MEDIA, sceneEntries} from './config';
import {
  AIEditPayoffScene, ApproveScene, BrandScene, DeckRevealScene,
  DirectEditScene, HookScene, PromptToPlanScene,
} from './scenes';

const sceneMap = {
  hook: HookScene,
  promptToPlan: PromptToPlanScene,
  approve: ApproveScene,
  deckReveal: DeckRevealScene,
  directEdit: DirectEditScene,
  aiEdit: AIEditPayoffScene,
  brand: BrandScene,
} as const;

export const OfficeDexXLaunch = () => (
  <AbsoluteFill style={{backgroundColor: '#06131B'}}>
    {sceneEntries().map(({name, from, duration}) => {
      const Scene = sceneMap[name];
      return <Sequence key={name} from={from} durationInFrames={duration}><Scene /></Sequence>;
    })}
    <Audio src={staticFile(MEDIA.music)} volume={0.9} />
    <Sequence from={8}><Audio src={staticFile(MEDIA.typeHit)} volume={0.8} /></Sequence>
    <Sequence from={26}><Audio src={staticFile(MEDIA.typeHit)} volume={0.72} /></Sequence>
    <Sequence from={48}><Audio src={staticFile(MEDIA.click)} volume={0.7} /></Sequence>
    <Sequence from={126}><Audio src={staticFile(MEDIA.click)} volume={0.58} /></Sequence>
    <Sequence from={164}><Audio src={staticFile(MEDIA.click)} volume={0.58} /></Sequence>
    <Sequence from={202}><Audio src={staticFile(MEDIA.click)} volume={0.58} /></Sequence>
    <Sequence from={240}><Audio src={staticFile(MEDIA.whoosh)} volume={0.55} /></Sequence>
    <Sequence from={360}><Audio src={staticFile(MEDIA.click)} volume={0.68} /></Sequence>
    <Sequence from={534}><Audio src={staticFile(MEDIA.whoosh)} volume={0.55} /></Sequence>
    <Sequence from={596}><Audio src={staticFile(MEDIA.complete)} volume={0.72} /></Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 5: Render representative stills**

```bash
cd marketing/ppt-launch-video/remotion
npx remotion still src/index.ts OfficeDexXLaunch /tmp/hook.png --frame=30
npx remotion still src/index.ts OfficeDexXLaunch /tmp/plan.png --frame=180
npx remotion still src/index.ts OfficeDexXLaunch /tmp/direct-edit.png --frame=450
npx remotion still src/index.ts OfficeDexXLaunch /tmp/brand.png --frame=680
```

Expected: all four commands exit 0; text stays inside safe margins; product focus is readable without full-window scanning.

- [ ] **Step 6: Run tests and commit the composition**

```bash
cd marketing/ppt-launch-video/remotion
npm test
npm run typecheck
cd ../../..
git add marketing/ppt-launch-video/remotion/src
git commit -m "feat: compose OfficeDex UI macro launch film"
```

### Task 7: Add Reproducible Build And Delivery Gates

**Files:**
- Create: `marketing/ppt-launch-video/scripts/build-ui-macro.sh`
- Create: `marketing/ppt-launch-video/scripts/validate-ui-macro.sh`
- Modify: `marketing/ppt-launch-video/scripts/validate-media.sh`
- Modify: `marketing/ppt-launch-video/README.md`

- [ ] **Step 1: Add `validate-ui-macro.sh`**

Create `marketing/ppt-launch-video/scripts/validate-ui-macro.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
VIDEO="${1:?usage: validate-ui-macro.sh <video.mp4>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTACT="$ROOT/exports/officedex-ppt-launch-x-ui-macro-contact-sheet.jpg"
REPORT="$ROOT/exports/officedex-ppt-launch-x-ui-macro-quality-report.json"
test -s "$VIDEO"

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VIDEO")"
width="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$VIDEO")"
height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$VIDEO")"
fps="$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nw=1:nk=1 "$VIDEO")"
vcodec="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$VIDEO")"
acodec="$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$VIDEO")"

test "$width" = "1920"
test "$height" = "1080"
test "$fps" = "30/1"
test "$vcodec" = "h264"
test "$acodec" = "aac"
awk -v value="$duration" 'BEGIN {exit !(value >= 20 && value <= 26)}'

decode_log="$(mktemp)"
black_log="$(mktemp)"
freeze_log="$(mktemp)"
volume_log="$(mktemp)"
trap 'rm -f "$decode_log" "$black_log" "$freeze_log" "$volume_log"' EXIT

ffmpeg -v error -i "$VIDEO" -f null - 2>"$decode_log"
test ! -s "$decode_log"
ffmpeg -hide_banner -nostats -i "$VIDEO" -vf 'blackdetect=d=0.4:pic_th=0.98' -an -f null - 2>"$black_log"
! grep -q 'black_start:' "$black_log"
ffmpeg -hide_banner -nostats -i "$VIDEO" -vf 'freezedetect=n=-60dB:d=1.0' -an -f null - 2>"$freeze_log"
! grep -q 'freeze_start:' "$freeze_log"
ffmpeg -hide_banner -nostats -i "$VIDEO" -af volumedetect -vn -f null - 2>"$volume_log"
mean="$(sed -n 's/.*mean_volume: \([-0-9.]*\) dB.*/\1/p' "$volume_log" | tail -1)"
max="$(sed -n 's/.*max_volume: \([-0-9.]*\) dB.*/\1/p' "$volume_log" | tail -1)"
test -n "$mean"
test -n "$max"
awk -v value="$mean" 'BEGIN {exit !(value >= -22 && value <= -16)}'
awk -v value="$max" 'BEGIN {exit !(value < -1)}'

ffmpeg -hide_banner -loglevel error -y -i "$VIDEO" \
  -vf "fps=1/2,scale=360:-1,tile=4x3:padding=8:margin=8:color=black" \
  -frames:v 1 -update 1 "$CONTACT"
test -s "$CONTACT"

node - "$REPORT" "$VIDEO" "$duration" "$width" "$height" "$fps" "$vcodec" "$acodec" "$mean" "$max" <<'NODE'
import {writeFileSync} from 'node:fs';
const [report, video, duration, width, height, fps, vcodec, acodec, mean, max] = process.argv.slice(2);
writeFileSync(report, JSON.stringify({
  video, passed: true, score: 100,
  duration: Number(duration), width: Number(width), height: Number(height), fps,
  videoCodec: vcodec, audioCodec: acodec,
  meanVolumeDb: Number(mean), maxVolumeDb: Number(max),
  decode: 'pass', blackFrames: 'pass', freezes: 'pass', contactSheet: 'pass',
}, null, 2) + '\n');
NODE

echo "duration=$duration dimensions=${width}x${height} fps=$fps video=$vcodec audio=$acodec mean=${mean}dB max=${max}dB"
echo "contact_sheet=$CONTACT"
echo "quality_report=$REPORT"
```

- [ ] **Step 2: Add `build-ui-macro.sh`**

Create an orchestrator that runs, in order:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTION="$ROOT/remotion"
RAW="$ROOT/exports/officedex-ppt-launch-x-ui-macro-24s.raw.mp4"
FINAL="$ROOT/exports/officedex-ppt-launch-x-ui-macro-24s.mp4"

"$ROOT/scripts/generate-ui-macro-audio.sh"
cd "$REMOTION"
node scripts/stage-assets.mjs
npm test
npm run typecheck
npm run render:candidate
cd "$ROOT"
ffmpeg -hide_banner -loglevel error -y -i "$RAW" \
  -map 0:v:0 -map 0:a:0 -c copy -movflags +faststart "$FINAL"
rm -f "$RAW"
"$ROOT/scripts/validate-ui-macro.sh" "$FINAL"
echo "$FINAL"
```

- [ ] **Step 3: Update the legacy media validator**

Change `check_media()` in `validate-media.sh` to accept a sixth `want_audio` argument. Use:

```bash
if [[ "$want_audio" == "yes" ]]; then
  test -n "$audio_streams"
else
  test -z "$audio_streams"
fi
```

Call the function with `no` for master/clean/vertical and `yes` for the new canonical X cut after promotion. Change the canonical X duration range from `28 32` to `20 26`.

- [ ] **Step 4: Document the new workflow**

Add to `marketing/ppt-launch-video/README.md`:

```markdown
## UI Macro X cut

1. Build the embedded PPTist bundle: `npm run build:pptist`.
2. Start `npm run dev:browser` and record the direct-edit proof with `node marketing/ppt-launch-video/scripts/capture-direct-edit.mjs`.
3. Build the candidate: `marketing/ppt-launch-video/scripts/build-ui-macro.sh`.
4. Review `exports/officedex-ppt-launch-x-ui-macro-contact-sheet.jpg` and the quality report before promoting the candidate.
5. Upload an unpublished X draft and confirm mobile text readability before replacing the canonical asset.
```

- [ ] **Step 5: Run the complete build**

```bash
marketing/ppt-launch-video/scripts/build-ui-macro.sh
```

Expected: candidate MP4, contact sheet, and JSON quality report exist; validator exits 0.

- [ ] **Step 6: Commit build and validation tooling**

```bash
git add marketing/ppt-launch-video/scripts/build-ui-macro.sh \
  marketing/ppt-launch-video/scripts/validate-ui-macro.sh \
  marketing/ppt-launch-video/scripts/validate-media.sh \
  marketing/ppt-launch-video/README.md
git commit -m "build: validate OfficeDex UI macro launch video"
```

### Task 8: Visual And Audio Review Checkpoint

**Files:**
- Review: `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4`
- Review: `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-contact-sheet.jpg`
- Review: `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-quality-report.json`

- [ ] **Step 1: Inspect the contact sheet against the approved storyboard**

Confirm at least these states are distinct: three-line hook, prompt macro, plan macro, approval state, deck reveal, direct selection, caret/text change, AI before/after, brand lockup.

- [ ] **Step 2: Watch the full candidate with sound and muted**

Fail the candidate if either mode cannot communicate prompt → plan → direct edit → AI edit.

- [ ] **Step 3: Check phone-size readability**

Downscale a review copy:

```bash
ffmpeg -y -i marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4 \
  -vf scale=640:-2 -c:v libx264 -crf 20 -c:a aac -b:a 128k \
  /tmp/officedex-x-mobile-review.mp4
```

Watch at native 640-pixel width. Fail if any required copy or selection proof is unreadable.

- [ ] **Step 4: Upload an unpublished X draft**

Do not publish. Confirm X accepts the file, does not crop the 16:9 frame, and preserves readable text after processing.

- [ ] **Step 5: Obtain user approval**

Present the candidate, contact sheet, duration, audio metrics, and quality report. Continue only after explicit approval.

### Task 9: Promote The Candidate And Sync The Website Asset

**Files:**
- Replace: `marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4`
- Replace: `officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4`

- [ ] **Step 1: Promote byte-for-byte from the approved candidate**

```bash
cp marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4 \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4
cmp marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4 \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4
marketing/ppt-launch-video/scripts/validate-media.sh
```

Expected: `cmp` and media validation exit 0.

- [ ] **Step 2: Commit the OfficeDex source and canonical export**

```bash
git add marketing/ppt-launch-video/.gitignore \
  marketing/ppt-launch-video/README.md \
  marketing/ppt-launch-video/licenses/music.md \
  marketing/ppt-launch-video/remotion \
  marketing/ppt-launch-video/scripts/capture-direct-edit.mjs \
  marketing/ppt-launch-video/scripts/generate-ui-macro-audio.sh \
  marketing/ppt-launch-video/scripts/build-ui-macro.sh \
  marketing/ppt-launch-video/scripts/validate-ui-macro.sh \
  marketing/ppt-launch-video/scripts/validate-media.sh \
  marketing/ppt-launch-video/audio/generated \
  marketing/ppt-launch-video/raw/direct-edit/officedex-direct-edit-1080p.webm \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4 \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-24s.mp4 \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-contact-sheet.jpg \
  marketing/ppt-launch-video/exports/officedex-ppt-launch-x-ui-macro-quality-report.json
git commit -m "feat: ship OfficeDex UI macro X launch film"
```

- [ ] **Step 3: Sync into the website repository**

```bash
cp officedex/marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4 \
  officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4
cmp officedex/marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4 \
  officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4
```

Run from `/Users/luyang/Workspace/shimo/vibe-officing`.

- [ ] **Step 4: Verify website tests and production build through the required npm proxy**

```bash
cd officecli-internal/platform/web/site
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm test -- src/components/OfficeDexDemoVideo.test.tsx
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm run lint
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm run build
cmp public/media/officedex-ppt-launch-x-30s.mp4 dist/media/officedex-ppt-launch-x-30s.mp4
```

Expected: focused test, typecheck, production build, and byte comparison all pass.

- [ ] **Step 5: Commit the website media update separately**

```bash
git add platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4
git commit -m "feat: update OfficeDex homepage launch video"
```

Run this commit from the `officecli-internal` repository root.

### Task 10: Final Verification And Handoff

**Files:**
- Verify all generated and synced artifacts.

- [ ] **Step 1: Re-run OfficeDex video checks from a clean dependency state**

```bash
cd marketing/ppt-launch-video/remotion
rm -rf node_modules
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm ci
npm test
npm run typecheck
cd ../../..
marketing/ppt-launch-video/scripts/validate-media.sh
```

- [ ] **Step 2: Verify public and source bytes match**

```bash
cmp officedex/marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4 \
  officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4
shasum -a 256 \
  officedex/marketing/ppt-launch-video/exports/officedex-ppt-launch-x-30s.mp4 \
  officecli-internal/platform/web/site/public/media/officedex-ppt-launch-x-30s.mp4
```

- [ ] **Step 3: Confirm clean repository boundaries**

```bash
git -C officedex status --short --branch
git -C officecli-internal status --short --branch
```

Expected: only explicitly accepted unrelated user changes remain; no generated Remotion cache or staged-public directory is tracked accidentally.

- [ ] **Step 4: Report final evidence**

Include:

- final source and public video paths;
- contact-sheet and quality-report paths;
- duration, dimensions, video/audio codecs, average frame rate, loudness, and peak;
- direct-edit proof confirmation;
- OfficeDex and website commit hashes;
- exact caveat if the X draft upload was not available for validation.
