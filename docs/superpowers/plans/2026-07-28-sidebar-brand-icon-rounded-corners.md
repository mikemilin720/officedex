# Sidebar Brand Icon Rounded Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clip the opaque square corners of the OfficeDex sidebar logo so the visible brand icon has its intended rounded outline, then ship the fix in OfficeDex `v0.6.7` with OfficeCLI `0.2.121` bundled.

**Architecture:** Keep the source PNG and system application icons unchanged. Apply clipping only at the `.brand-mark` presentation boundary, with a focused stylesheet regression test, then verify the complete release metadata and packaged build workflow.

**Tech Stack:** React, TypeScript, CSS, Vitest, Wails v2, GitHub Actions

---

## File Structure

- `src/renderer/components/Shell.test.tsx`: regression assertion for the sidebar brand-mark clipping contract.
- `src/renderer/styles/shell.css`: rounded clipping boundary for the 40px sidebar brand mark.
- `package.json`: OfficeDex release version `0.6.7` and OfficeCLI pin `0.2.121`.
- `package-lock.json`: root package metadata synchronized to `0.6.7`.
- `wails.json`: packaged product version synchronized to `0.6.7`.

### Task 1: Add the failing sidebar icon regression test

**Files:**
- Modify: `src/renderer/components/Shell.test.tsx`
- Test: `src/renderer/components/Shell.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test after `uses the OfficeDex PNG app icon for the sidebar brand mark`:

```ts
it("clips the opaque sidebar logo asset to rounded corners", () => {
  const css = readFileSync("src/renderer/styles/shell.css", "utf8");
  const brandMarkRule = css.match(/\.brand-mark\s*\{[^}]*\}/s)?.[0] ?? "";

  expect(brandMarkRule).toMatch(/border-radius:\s*8px;/);
  expect(brandMarkRule).toMatch(/overflow:\s*hidden;/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/renderer/components/Shell.test.tsx -t "clips the opaque sidebar logo asset to rounded corners"
```

Expected: FAIL because `.brand-mark` does not yet contain `border-radius: 8px` or `overflow: hidden`.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/renderer/components/Shell.test.tsx
git commit -m "test: require rounded sidebar brand icon"
```

### Task 2: Apply the minimal rounded clipping style

**Files:**
- Modify: `src/renderer/styles/shell.css`
- Test: `src/renderer/components/Shell.test.tsx`

- [ ] **Step 1: Add clipping to `.brand-mark`**

Change the rule to:

```css
.brand-mark {
  display: grid;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 8px;
  place-items: center;
}
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/components/Shell.test.tsx -t "clips the opaque sidebar logo asset to rounded corners"
```

Expected: the focused test passes.

- [ ] **Step 3: Run the complete Shell test file**

Run:

```bash
npx vitest run src/renderer/components/Shell.test.tsx
```

Expected: all Shell tests pass.

- [ ] **Step 4: Commit the style fix**

```bash
git add src/renderer/styles/shell.css
git commit -m "fix: round sidebar brand icon corners"
```

### Task 3: Verify the rendered sidebar visually

**Files:**
- Verify: `src/renderer/styles/shell.css`
- Verify: `public/officedex-logo.png`

- [ ] **Step 1: Generate Wails bindings and start the browser UI**

Run:

```bash
mkdir -p dist
touch dist/.placeholder
env -u GOROOT wails generate module
npm run dev:browser
```

Expected: Vite serves the OfficeDex renderer at `http://127.0.0.1:3100` or the reported local URL.

- [ ] **Step 2: Inspect the sidebar at desktop width**

Open the renderer and confirm:

- the icon remains 40px square in layout;
- the black opaque pixels outside the rounded outline are not visible;
- the icon remains aligned with the OfficeDex name and connection status;
- no Dock, installer, About screen, or shared PNG asset is changed.

- [ ] **Step 3: Stop the development server**

Stop the Vite process after capturing the visual result.

### Task 4: Complete release metadata and regression verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `wails.json`

- [ ] **Step 1: Verify release metadata values**

Confirm these exact values:

```json
// package.json
{
  "version": "0.6.7",
  "officecliVersion": "0.2.121"
}
```

```json
// package-lock.json root and packages[""]
{
  "version": "0.6.7"
}
```

```json
// wails.json info
{
  "productVersion": "0.6.7"
}
```

- [ ] **Step 2: Run release metadata verification**

Run:

```bash
node scripts/verify-release-version.mjs \
  --expected 0.6.7 \
  --package package.json \
  --wails wails.json \
  --tag v0.6.7
```

Expected: `Verified OfficeDex release version 0.6.7.`

- [ ] **Step 3: Verify the pinned OfficeCLI binary**

Run:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 \
HTTP_PROXY=http://127.0.0.1:7890 \
npm run prefetch:officecli
build/officecli/officecli version
```

Expected: the prefetch log targets `v0.2.121`, both macOS checksums pass, and the binary reports `officecli version 0.2.121`.

- [ ] **Step 4: Run the renderer and script regression suites**

Run:

```bash
npm run test:scripts
npx vitest run
```

Expected: all script and renderer tests pass.

- [ ] **Step 5: Commit release metadata**

```bash
git add package.json package-lock.json wails.json
git commit -m "release: prepare OfficeDex 0.6.7"
```

### Task 5: Merge and publish OfficeDex v0.6.7

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/release.yml`

- [ ] **Step 1: Push the release branch and create a pull request**

```bash
git push -u origin release/officedex-0.6.7
gh pr create \
  --repo officecli/officedex \
  --base main \
  --head release/officedex-0.6.7 \
  --title "release: OfficeDex 0.6.7" \
  --body "Ships the rounded sidebar brand icon and bundles OfficeCLI 0.2.121."
```

- [ ] **Step 2: Track PR CI to success**

Run `gh pr checks --watch` for the created PR.

Expected: embedded PPTist reproduction, TypeScript, script tests, renderer tests, and both Go test modes pass.

- [ ] **Step 3: Merge the pull request**

```bash
pr_number="$(gh pr view --repo officecli/officedex --json number --jq .number)"
gh pr merge "$pr_number" --repo officecli/officedex --merge --delete-branch
```

- [ ] **Step 4: Tag the merged commit**

```bash
git fetch origin main --tags
git tag -a v0.6.7 origin/main -m "OfficeDex v0.6.7"
git push origin v0.6.7
```

- [ ] **Step 5: Track the Release workflow**

Run `gh run watch --repo officecli/officedex <RUN_ID> --exit-status`.

Expected: macOS universal and Windows amd64 jobs prefetch OfficeCLI `0.2.121`, complete packaged Canvas renders, create the signed/notarized artifacts, publish GitHub Release `v0.6.7`, and synchronize `officedex-dist`.

- [ ] **Step 6: Verify latest downloadable artifacts**

Run:

```bash
gh release view v0.6.7 --repo officecli/officedex --json tagName,publishedAt,url,assets
gh api 'repos/officecli/officedex-dist/contents/manifest.json?ref=main' --jq .content \
  | tr -d '\n' | base64 --decode | jq .
```

Expected: `v0.6.7` is the latest release, macOS DMG/ZIP and Windows ZIP exist, and the distribution manifest reports version `0.6.7`.
