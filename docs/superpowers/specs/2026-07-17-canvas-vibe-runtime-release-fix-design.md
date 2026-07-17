# OfficeDex Canvas Vibe Runtime Release Fix Design

## Problem

OfficeDex `v0.6.0` renders the Canvas Node workspace only after receiving a
`task.vibe_tree` event. The desktop client sends `generation_mode=plan`, but the
release package bundles OfficeCLI `0.2.117`, whose agent bridge neither parses
that field nor emits `task.vibe_tree` or `task.vibe_slide`. Go JSON decoding
silently ignores the unknown field, so the request falls back to the legacy
interactive `mode=best` plan flow and remains in the conversation interface.

The Canvas/Vibe implementation currently exists only in the dirty
`officecli-internal` checkout. It was exercised locally with a locally built
runtime, while the OfficeDex release workflow fetched the older published
runtime. Existing renderer tests simulate Vibe events and therefore did not
detect the release-package mismatch.

## Goal

Publish OfficeDex `v0.6.1` with a formally released OfficeCLI runtime that
supports the staged PPTX Vibe Tree protocol, and add release gates that prevent
future OfficeDex packages from advertising Canvas behavior while bundling an
incompatible runtime.

## Scope

The fix includes:

- isolating the minimum complete Vibe Tree implementation from the current
  `officecli-internal` work;
- adding OfficeCLI protocol and staged-flow regression tests;
- publishing the next OfficeCLI patch release, expected to be `0.2.118`;
- pinning OfficeDex to that exact runtime version;
- adding an OfficeDex release contract check against the fetched binary;
- building and validating macOS and Windows OfficeDex packages; and
- publishing OfficeDex `v0.6.1` after all gates pass.

The fix does not redesign the Canvas UI, synthesize Canvas nodes in the
renderer, or change non-PPTX document generation behavior.

## Considered Approaches

### 1. Publish the real OfficeCLI Vibe runtime and pin OfficeDex to it

This is the selected approach. It preserves the existing ownership boundary:
OfficeCLI owns staged generation and events, while OfficeDex owns presentation
and interaction. It also produces reproducible release artifacts and allows
the runtime to be tested independently.

### 2. Bundle an unpublished local OfficeCLI snapshot

This would make OfficeDex work quickly but would leave no immutable runtime
version for Windows/macOS parity, updates, or incident reproduction. It is
rejected because the same mismatch could recur on the next build.

### 3. Reconstruct Canvas nodes from the legacy `task.plan` event

This would avoid an OfficeCLI release, but it would duplicate staged-flow state
in the renderer and could not provide the real node confirmation and
regeneration semantics. It is rejected because it creates two incompatible
PPTX workflows.

## Architecture

### OfficeCLI runtime

The agent bridge will accept `generation_mode` in `office.generate` requests and
carry it into `GenerateJob`. An interactive PPTX request enters the Vibe flow
only when all of these conditions hold:

- document type is `pptx`;
- OfficeCLI execution mode is `best`;
- `generation_mode` is `plan`; and
- an interactive prompter is available.

The Vibe flow emits versioned bridge events through the existing event stream:

- `task.vibe_tree` for every staged tree snapshot;
- `task.vibe_slide` when a render backend produces editable PPTist slide data;
- existing `task.question`, `task.progress`, `task.output`, `task.completed`,
  `task.failed`, and `task.cancelled` events for lifecycle compatibility.

The implementation must remain dormant for DOCX, XLSX, report, image, GIF,
non-interactive PPTX, and PPTX requests without `generation_mode=plan`.

### OfficeDex desktop client

OfficeDex continues to send both `mode=best` and `generation_mode=plan`. No
Canvas UI fallback is added. The renderer remains event-driven: `task.vibe_tree`
populates `DesktopTask.vibeTree`, which activates `LivingTreeCockpit`.

The pinned `officecliVersion` becomes an explicit compatibility contract. The
release build must download that version and verify the bundled binary before
packaging.

### Release compatibility check

A small release script will start the fetched OfficeCLI agent bridge, issue its
initialization request, and assert that:

- `office.generate` advertises `generation_mode`;
- the event capability list advertises `task.vibe_tree`; and
- the runtime reports the expected version.

The contract check runs after `prefetch:officecli` and before Wails packaging on
both release platforms. A mismatch fails the release instead of producing an
OfficeDex package with a nonfunctional Canvas path.

## Data Flow

1. OfficeDex submits a PPTX generation request with `mode=best`,
   `generation_mode=plan`, and `interactive=true`.
2. OfficeCLI parses `generation_mode` into `GenerateJob.GenerationMode`.
3. The bridge selects the staged Vibe Tree flow.
4. OfficeCLI emits `task.vibe_tree` with stage, tree, actions, and confirmation
   metadata.
5. OfficeDex stores the snapshot in `DesktopTask.vibeTree` and switches from the
   conversation layout to Canvas Node mode.
6. User confirmations return through the existing task response channel.
7. OfficeCLI emits later tree snapshots, optional slide events, and the final
   artifact lifecycle events.
8. OfficeDex keeps the completed PPTX in the Canvas/PPTist review workspace.

## Error Handling

- An unsupported `generation_mode` remains a validation error at the OfficeDex
  bridge boundary.
- If the Vibe flow fails, OfficeCLI emits the existing structured `task.failed`
  event; OfficeDex must not fabricate a partial Canvas snapshot.
- Cancellation continues through the existing `task.cancelled` path.
- Release packaging fails immediately when the fetched runtime does not expose
  the required protocol capabilities or reports the wrong version.
- No silent fallback from requested Canvas/Vibe mode to the legacy plan flow is
  permitted in a release package.

## Testing Strategy

### OfficeCLI tests

- Verify JSON decoding preserves `generation_mode=plan`.
- Verify the `GenerateJob` receives that value.
- Verify only eligible interactive PPTX jobs enter the Vibe flow.
- Verify a deterministic test prompt emits `task.vibe_tree` and completes the
  staged lifecycle.
- Verify non-PPTX and legacy requests retain their existing behavior.

### OfficeDex tests

- Keep renderer tests proving `task.vibe_tree` activates Canvas mode.
- Add a release-script test using a fake bridge process for missing capability,
  wrong version, malformed response, and success cases.
- Run the contract script against the real fetched OfficeCLI binary.
- Run the real PPTX generation E2E against the locally packaged application and
  assert that the Canvas selector becomes visible before completion.

### Package verification

- Inspect the macOS ZIP and Windows ZIP to confirm the bundled OfficeCLI version.
- Run the runtime contract check against the binary extracted from each final
  archive.
- Preserve the existing checks for universal architecture, signing,
  notarization, checksums, licenses, and dist manifest synchronization.

## Release Sequence

1. Create an isolated OfficeCLI worktree from `origin/main` so the existing
   dirty checkout remains untouched.
2. Port only the Vibe protocol, staged-flow, and required renderer changes into
   that worktree using test-first commits.
3. Run focused and full OfficeCLI verification, then publish the next patch
   version to `officecli-dist`.
4. Update OfficeDex `officecliVersion` and add the release contract gate using
   test-first commits.
5. Run OfficeDex lint, renderer tests, Go tests, script tests, real E2E, local
   packaging, and archive-level runtime verification.
6. Set OfficeDex to `0.6.1`, commit and push, create tag `v0.6.1`, and trigger the
   existing release workflow.
7. Confirm GitHub Release assets, checksums, bundled runtime versions, and
   `officedex-dist/manifest.json` after publication.

## Acceptance Criteria

- A new PPTX generation in OfficeDex `v0.6.1` receives `task.vibe_tree` and
  enters Canvas Node mode.
- Node confirmation and downstream generation work through the existing bridge
  response protocol.
- The completed deck remains in the Canvas/PPTist review workspace and can be
  edited and saved.
- macOS and Windows packages contain the same formally released OfficeCLI patch
  version with the required protocol capabilities.
- The release workflow fails if a future pinned runtime lacks
  `generation_mode` or `task.vibe_tree` support.
- OfficeDex `v0.6.1` is published successfully and the dist manifest references
  its verified assets.
