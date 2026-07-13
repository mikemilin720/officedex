# Immediate PPT Autosave Design

## Goal

Persist every user edit and AI conversation edit to the generated PPTX as soon as the change is reported, without allowing overlapping exports or an older save to overwrite newer content.

## Current Behavior

- Embedded PPTist waits 500 ms after a user edit before notifying OfficeDex that the slide changed and became dirty.
- `PptistEmbedPanel` waits another 2 seconds after a dirty notification or completed AI edit run before exporting the deck.
- Repeated dirty notifications reset the 2-second timer.
- The timer does not explicitly coordinate changes that arrive while an export or native file write is already running.

## Chosen Approach

Use an immediate, single-flight autosave coordinator with one coalesced follow-up save.

When OfficeDex receives a user-edit dirty event or a successful AI edit completion event, it requests an autosave immediately. If no save is running, OfficeDex starts exporting the current PPTist deck at once. If a save is already running, OfficeDex records that another save is required. When the active export and native file write finish, OfficeDex immediately starts one follow-up save if the deck changed during the active save.

This preserves the latest deck state while preventing concurrent PPTX exports and writes.

## Component Responsibilities

### Embedded PPTist

- Emit `pptist:dirty-changed` immediately when the active slide's editable content changes.
- Keep the existing short coalescing delay for the larger `pptist:slide-updated` payload so ordinary typing does not clone and post the full slide on every keystroke.
- Continue suppressing dirty notifications for host-driven loading and other programmatic updates.
- Continue emitting the existing AI edit lifecycle events. The host treats successful edit-run completion as an autosave request.

### OfficeDex `PptistEmbedPanel`

- Replace the 2-second debounce timer with an autosave coordinator.
- Track whether an autosave is currently running.
- Track whether another autosave was requested after the current save began.
- Start export immediately for the first request.
- Coalesce any number of requests during an active save into one follow-up save.
- Consider the save active until both PPTist export and `officecli.savePptx` complete.
- Preserve existing autosave states: `dirty`, `saving`, `saved`, and `failed`.
- Preserve existing export and native-save timeout handling.

## State Flow

1. A user edit or successful AI edit requests autosave.
2. OfficeDex reports `dirty`.
3. If idle, OfficeDex reports `saving` and immediately requests `pptist:export-pptx`.
4. If already saving, OfficeDex records a pending save and does not start another export.
5. PPTist returns the exported bytes; OfficeDex writes them to the artifact's existing file path.
6. On success, OfficeDex reports `saved`.
7. If a pending save exists, OfficeDex immediately starts the next save and clears the pending flag.

## Failure Behavior

- Export timeout and native-write timeout continue to report `failed` and surface the existing error message.
- A failure does not create an automatic retry loop.
- If a new edit arrived during the failed save, the already-recorded follow-up save runs once so the newer state still gets an opportunity to persist.
- If that follow-up also fails and no later edit occurs, autosave remains failed until another edit requests a new save.

## AI Edit Behavior

- A successful `pptist:edit-run-completed` event requests autosave immediately.
- Animated AI text edits may also produce a dirty event. The coordinator safely coalesces duplicate requests and never starts overlapping exports.
- Failed AI edit runs do not trigger autosave unless PPTist separately reports that actual deck content changed.

## Testing

Add focused component tests that prove:

- a dirty event requests export without advancing a debounce timer;
- a successful AI edit run requests export immediately;
- repeated changes during an active save do not start concurrent exports;
- completing the active native save starts exactly one follow-up export when changes were coalesced;
- a save with no intervening changes does not start a follow-up export;
- existing export timeout and native-write timeout failures remain visible;
- PPTist sends dirty immediately while retaining coalescing for the full `slide-updated` payload.

## Scope

This change only affects autosaving the editable generated PPTX. It does not change manual export, artifact naming, task history, PPT generation quality, or the AI edit planner.
