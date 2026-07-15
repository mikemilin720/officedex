# OfficeDex Magic Prompt Demo Design

Date: 2026-07-13

Status: Approved design

## Goal

Create a deterministic OfficeDex PPTX demo path for the launch video.

The demo must make the approved launch-strategy prompt fast, repeatable, and stable enough for screen recording while preserving the real user confirmation experience. It exists only in a special demo build and must not change normal production behavior.

## Demo Trigger

The demo flow starts only when all of these conditions are true:

- The app was compiled as the special demo build.
- `documentType` is `pptx`.
- `generationMode` is `plan`.
- Leading and trailing whitespace around the prompt may be trimmed.
- The trimmed prompt matches this exact text:

```text
Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review.
```

Any other prompt, document type, mode, or normal build follows the existing real generation path.

## Required Demo Behavior

The matched magic prompt must never call the LLM, network, login, provider validation, OfficeCLI bridge startup, or any credit-consuming path.

The flow is deterministic from start to finish:

- Use normal OfficeDex task IDs, task events, `Respond`, local-store persistence, artifact records, PPTist preview, export, autosave, and task reopen behavior.
- Keep genuine user confirmations at each stage. The user must still click the actual approval controls.
- Emit stage results after fixed delays between 0.5 and 1.5 seconds so the recording has believable pacing without depending on model latency.
- Persist synthetic task events through the same local-store path used by real generation so a restart can reconstruct the visible stage and pending confirmation.
- Produce a deterministic nine-slide English PPTX artifact.
- Ensure slide 6, using the user-visible one-based slide number, is the 90-day launch timeline slide.
- Allow the generated artifact to open in the existing PPTist review/edit surface.

The demo may use deterministic data, but it must travel through the same user-visible product surfaces used by a normal PPTX task.

## Demo Story Content

The bundled deck is a nine-slide executive launch-strategy presentation for a new AI productivity app:

1. Launch Strategy
2. Executive Summary
3. Target Audience
4. Positioning
5. Launch Channels
6. 90-Day Launch Timeline
7. Success Metrics
8. Risks and Mitigations
9. Next Steps

Slide 6, using the user-visible one-based slide number, is the prepared timeline slide used by the video edit moment. The deck should be visually polished enough for the launch video, but the implementation should keep the fixture deterministic and small enough to commit safely.

## Confirmation Flow

The demo state machine mirrors the approved multi-step PPTX journey:

1. Create the task and show the initial thinking state.
2. Present the idea and story direction for confirmation.
3. Present story beats for confirmation.
4. Present chapters for confirmation.
5. Present per-slide outlines for confirmation.
6. Build the deterministic PPTX artifact.
7. Show the completed task with the PPTist preview entry point.

Each confirmation is accepted only through `App.Respond` for the current demo task and current pending question. Duplicate confirmations are idempotent and return the already-recorded next state. A response for the wrong task, stale question, or invalid state returns a clear Demo Mode error.

## PPTist Edit Demo

Only one edit prompt is recognized. No paraphrase, casing change, punctuation change, or extra text should match:

```text
Turn this launch timeline into a vertical roadmap.
```

The edit prompt must target slide 6, using the user-visible one-based slide number. When matched, `ModifyPptistDeck` returns a confirmation-required `slide:replace` preset operation for slide 6. The operation replaces the timeline with the prepared more-visual timeline variant and uses the existing PPTist edit confirmation/apply surface.

Any other edit prompt returns this exact message:

```text
Demo mode supports the prepared timeline edit.
```

A request for the recognized edit against a slide other than slide 6 returns a clear Demo Mode error instead of planning a different edit.

## Architecture

Use a native Go demo task engine rather than a renderer-only route.

Add a new `internal/demoflow` package with two build variants:

- Demo build: compiled with a build tag such as `officedex_demo`; contains the deterministic state machine and fixtures.
- Normal build: compiled without the tag; contains only a disabled stub and does not include demo fixtures, magic prompt text, or prepared slide data in the compiled application bundle.

Add `npm run build:demo` as the official way to build the demo app. Normal build scripts remain unchanged.

Routing points:

- `App.Generate` asks Demo Flow first. If the input matches in a demo build, Demo Flow creates the task before provider validation or bridge startup.
- `App.Respond` routes recognized demo task IDs into the deterministic state machine.
- `App.ModifyPptistDeck` asks Demo Flow before the LLM edit planner and before any real bridge/provider path.

No URL demo route, renderer query parameter, runtime production setting, or hidden toggle is added.

## Shared Event Recording

Extract one shared event-recording/emitting path used by both the real bridge flow and Demo Flow.

The shared path must:

- write task events to the existing local store;
- emit the same Wails event payloads the renderer already consumes;
- tolerate tests without a live Wails event emitter;
- preserve event ordering;
- let Demo Flow replay or reconstruct state after app restart.

Demo Flow should not create a second event model. It should synthesize the same task event shapes that the real bridge produces.

## Timers and Lifecycle

Demo timers are part of the task engine and must be cancelable.

- Stage timers use fixed delays between 0.5 and 1.5 seconds.
- Timers are canceled when the app shuts down.
- A restarted app reconstructs the current stage from persisted events and does not duplicate completed stage events.
- Pending confirmations remain pending after restart.

## Error Handling

Failure cases must be explicit:

- If the magic prompt matches but fixtures are missing or invalid, emit `task.failed`.
- If the demo state machine reaches an impossible state, emit `task.failed`.
- If `Respond` receives the wrong task ID, wrong question ID, stale answer, or an answer in a non-confirmation state, return a Demo Mode error.
- If duplicate confirmation arrives for an already-accepted question, return the existing accepted result without emitting duplicate stage events.
- If a normal build receives the same prompt, it must use the normal real bridge path and must not return demo content.

A matched magic prompt in a demo build must never fall back to real generation after a demo error.

## Fixture Isolation

Demo fixtures include:

- deterministic task stage data;
- deterministic nine-slide PPTX source or generator data;
- deterministic slide-6 replacement operation data.

These assets are compiled only in the demo build. Normal compiled application bundles must not contain the magic prompt, demo deck content, or prepared edit text.

## Testing

Add focused tests that prove:

- exact trigger matching works, including trimmed outer whitespace;
- mismatched prompt, type, mode, and normal build do not enter Demo Flow;
- the matched demo prompt starts before provider validation or bridge startup;
- stage events appear in the approved order with deterministic delays;
- every confirmation goes through `Respond`;
- duplicate confirmations are idempotent;
- stale or wrong confirmations return clear Demo Mode errors;
- persisted synthetic events reconstruct the current stage after restart;
- the deterministic PPTX artifact exists and opens through the existing artifact/PPTist path;
- slide 6, using the user-visible one-based slide number, is the 90-day timeline slide;
- the exact timeline edit returns a confirmation-required `slide:replace` operation for slide 6;
- any other edit prompt returns `Demo mode supports the prepared timeline edit.`;
- recognized edit text against the wrong slide fails clearly;
- missing or invalid fixtures emit `task.failed`;
- normal builds do not include demo fixtures or magic text;
- normal and demo applications both build successfully.

## Verification

Before the implementation is considered complete:

- Run the relevant Go tests.
- Run the relevant frontend tests for task state, completed PPTX preview, and PPTist edit behavior.
- Build the normal app and confirm the magic prompt routes through the normal path.
- Build the demo app with `npm run build:demo` and confirm the magic prompt produces the deterministic flow.
- Reopen the demo task after app restart and confirm the stage, artifact, and pending confirmation are restored from local-store events.

## Scope Boundary

This design covers only the deterministic demo path required for the launch video. It does not change production generation, provider selection, login behavior, credit accounting, live LLM prompts, PPTist's general AI editor, the website, or the marketing video edit itself.
