# Immediate PPT Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save user and AI conversation changes to the generated PPTX immediately while serializing exports and coalescing changes that arrive during an active save.

**Architecture:** Embedded PPTist will publish the lightweight dirty event immediately while retaining its 500 ms coalescing for full-slide update payloads. OfficeDex will replace its 2-second debounce with a single-flight autosave coordinator that owns one active export/write and one pending follow-up flag.

**Tech Stack:** React, TypeScript, Vue 3, Vitest, Testing Library, PPTist iframe protocol, OfficeDex desktop bridge

---

## File Structure

- Modify `src/renderer/components/PptistEmbedPanel.tsx`: replace timer debounce with the immediate single-flight autosave coordinator.
- Modify `src/renderer/components/PptistEmbedPanel.test.tsx`: prove immediate AI/user saves, serialization, coalesced follow-up saves, and preserved timeout behavior.
- Modify `../PPTist/src/App.vue`: emit the dirty event immediately and keep the full slide payload coalesced.
- Modify `public/pptist/**`: rebuild and sync the local PPTist embed bundle after the source change.

### Task 1: Lock Down Immediate and Serialized Host Autosave

**Files:**
- Modify: `src/renderer/components/PptistEmbedPanel.test.tsx`
- Test: `src/renderer/components/PptistEmbedPanel.test.tsx`

- [ ] **Step 1: Replace the delayed-save expectation with an immediate-save test**

Update the existing autosave test so that immediately after a successful `pptist:edit-run-completed` event it finds one `pptist:export-pptx` message with `targetFilePath: artifact.filePath`, without advancing timers. Dispatch the matching export result and assert `officecli.savePptx` receives the bytes and target path.

- [ ] **Step 2: Add a failing serialization and coalescing test**

Use a deferred first `officecli.savePptx` promise. Dispatch a dirty event and assert one export starts immediately. Return its bytes so the native write remains active, dispatch multiple additional dirty events, and assert no second export starts. Resolve the first native write and assert exactly one second export starts. Return and save the second export, then assert no third export starts.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
```

Expected: the immediate-save assertion fails because the host still waits 2 seconds, and the coalescing assertion fails because no single-flight coordinator exists.

### Task 2: Implement the Host Autosave Coordinator

**Files:**
- Modify: `src/renderer/components/PptistEmbedPanel.tsx`
- Test: `src/renderer/components/PptistEmbedPanel.test.tsx`

- [ ] **Step 1: Replace debounce refs with autosave state refs**

Remove `AUTOSAVE_DEBOUNCE_MS` and `autosaveTimerRef`. Add refs for `autosaveInFlightRef`, `autosavePendingRef`, `activeAutosaveRequestIdRef`, and `requestAutosaveRef`.

- [ ] **Step 2: Add guarded cycle completion**

Implement a callback equivalent to:

```ts
const finishAutosaveCycle = useCallback((requestId: string) => {
  if (activeAutosaveRequestIdRef.current !== requestId) return;
  activeAutosaveRequestIdRef.current = null;
  autosaveInFlightRef.current = false;
  if (!autosavePendingRef.current) return;
  autosavePendingRef.current = false;
  requestAutosaveRef.current();
}, []);
```

- [ ] **Step 3: Start an autosave immediately or coalesce it**

Replace `scheduleAutosave` with `requestAutosave`. It must report `dirty`, set `autosavePendingRef` and return when a save is active, otherwise report `saving`, create the export request immediately, set the active request ID, and post `pptist:export-pptx` with the artifact file path. Its export timeout must call both `failAutosave` and `finishAutosaveCycle(requestId)`.

- [ ] **Step 4: Finish the active cycle only after native writing settles**

In `pptist:export-result`, identify the active autosave request by request ID. Keep it active while `officecli.savePptx` runs. On success report `saved` and finish the cycle; on failure report `failed` and finish the cycle. Ignore a stale autosave result whose request ID no longer matches the active cycle.

In `pptist:export-error`, fail and finish the matching active cycle. Preserve the separate `exportPptxBytes` request path.

- [ ] **Step 5: Route both edit sources through the coordinator**

Use `requestAutosave()` for `pptist:dirty-changed` and successful AI edit completion/fallback. Assign `requestAutosaveRef.current = requestAutosave` so cycle completion can immediately launch a pending save.

- [ ] **Step 6: Clean up coordinator state on unmount**

Clear the pending and in-flight flags and active request ID during unmount. Existing export timeout cleanup remains responsible for cancelling timers.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
```

Expected: all component tests pass, including immediate save and single-flight follow-up behavior.

### Task 3: Emit User-Edit Dirty Events Immediately

**Files:**
- Modify: `src/renderer/components/PptistEmbedPanel.test.tsx`
- Modify: `../PPTist/src/App.vue`
- Test: `src/renderer/components/PptistEmbedPanel.test.tsx`

- [ ] **Step 1: Add a failing PPTist source contract test**

Read `../PPTist/src/App.vue`, isolate the `// Notify parent when user edits a slide` watcher, and assert that `pptist:dirty-changed` appears before `editNotifyTimer = setTimeout`. Also assert that the timer body still posts `pptist:slide-updated` but does not post `pptist:dirty-changed`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
```

Expected: the new source contract fails because the dirty event is currently inside the 500 ms timer.

- [ ] **Step 3: Move only the lightweight dirty event outside the timer**

In the existing watcher callback, keep all current programmatic-update and signature guards, then post:

```ts
window.parent?.postMessage({ type: 'pptist:dirty-changed', dirty: true }, '*')
```

before resetting and creating `editNotifyTimer`. Leave the cloned `pptist:slide-updated` payload inside the 500 ms timer and remove the duplicate dirty post from that timer.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
```

Expected: all focused tests pass.

### Task 4: Verify and Refresh the Embedded Bundle

**Files:**
- Modify: `public/pptist/**`
- Verify: `src/renderer/components/PptistEmbedPanel.tsx`
- Verify: `../PPTist/src/App.vue`

- [ ] **Step 1: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: TypeScript exits with code 0.

- [ ] **Step 2: Run the complete component test file**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Build and sync the local PPTist embed**

Run with the project proxy defaults:

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890 bash scripts/build-local-app.sh
```

Expected: PPTist builds successfully and its refreshed `dist` is copied to `public/pptist`.

- [ ] **Step 4: Re-run tests and TypeScript validation after bundle sync**

Run:

```bash
npm test -- src/renderer/components/PptistEmbedPanel.test.tsx --run
npm run lint
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the requested autosave implementation, tests, plan/spec documentation, and refreshed embed bundle are attributable to this task among the pre-existing workspace changes.
