# OfficeDex Magic Prompt Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a special demo-only, deterministic PPTX generation and edit flow for the approved launch-video magic prompt.

**Architecture:** Add a Go `internal/demoflow` engine compiled only with the `officedex_demo` build tag, plus a normal-build stub that cannot contain demo fixtures. Route `App.Generate`, `App.Respond`, and `App.ModifyPptistDeck` through Demo Flow before provider/bridge paths, and use one shared app event recorder so synthetic demo events persist and emit like real bridge events.

**Tech Stack:** Go build tags, Wails app bindings, SQLite local store, existing `types.BridgeEvent` task events, existing PPTist `slide:replace` edit operation, Vitest/React tests for renderer state, Go tests for app routing and demo state.

---

## Execution Setup

The current main checkout is heavily dirty with unrelated PPTist and app work. Before implementing, create an isolated worktree from the current branch using `superpowers:using-git-worktrees`.

Use:

```bash
git worktree add /Users/luyang/.config/superpowers/worktrees/officedex/magic-prompt-demo -b codex/magic-prompt-demo
cd /Users/luyang/.config/superpowers/worktrees/officedex/magic-prompt-demo
```

If `git worktree add` fails because the branch already exists, inspect it with:

```bash
git worktree list
git status --short
```

Do not reset or discard either checkout. If the target worktree exists and is dirty, stop and ask before continuing.

## File Structure

- Create `internal/demoflow/engine.go`: public Demo Flow interface used by `app.go`; build-agnostic types shared by the demo and normal build variants.
- Create `internal/demoflow/engine_demo.go`: demo-build implementation guarded by `//go:build officedex_demo`.
- Create `internal/demoflow/engine_stub.go`: normal-build stub guarded by `//go:build !officedex_demo`.
- Create `internal/demoflow/fixtures_demo.go`: demo prompt, stage tree data, deterministic deck slides, and slide-6 replacement, guarded by `//go:build officedex_demo`.
- Create `internal/demoflow/engine_demo_test.go`: demo-build tests, guarded by `//go:build officedex_demo`.
- Create `internal/demoflow/engine_stub_test.go`: normal-build tests proving the stub does not match.
- Create `app_demo_flow_test.go`: app-level demo-build tests for routing before provider/bridge validation.
- Modify `app.go`: add a `demoFlow *demoflow.Engine` field, initialize it, route app methods through it, and extract shared event recording.
- Modify `package.json`: add `build:demo`.
- Modify `src/renderer/taskState.test.ts`: add focused event-replay coverage if existing tests do not already cover native staged `task.vibe_tree`, `task.vibe_slide`, and completed PPTX artifact replay.

## Task 1: Create Demo Flow Public Contract and Normal Stub

**Files:**
- Create: `internal/demoflow/engine.go`
- Create: `internal/demoflow/engine_stub.go`
- Test: `internal/demoflow/engine_stub_test.go`

- [ ] **Step 1: Write the normal-build stub test**

Create `internal/demoflow/engine_stub_test.go`:

```go
package demoflow

import (
	"context"
	"testing"

	"officedex/internal/types"
)

func TestNormalBuildDoesNotMatchMagicPrompt(t *testing.T) {
	engine := New(Options{})
	result, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Topic:          MagicPromptForTests(),
	})
	if err != nil {
		t.Fatalf("TryGenerate returned error: %v", err)
	}
	if ok {
		t.Fatalf("normal build matched demo flow: %#v", result)
	}
}

func TestNormalBuildDoesNotHandleRespondOrEdit(t *testing.T) {
	engine := New(Options{})
	if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "demo-task"}); err != nil || ok {
		t.Fatalf("TryRespond = ok %v err %v, want ok false nil", ok, err)
	}
	if _, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: "Make this launch timeline more visual."}); err != nil || ok {
		t.Fatalf("TryModifyPptistDeck = ok %v err %v, want ok false nil", ok, err)
	}
}
```

- [ ] **Step 2: Run the normal stub test and verify it fails**

Run:

```bash
go test ./internal/demoflow -run 'TestNormalBuild' -count=1
```

Expected: FAIL because `internal/demoflow` does not exist.

- [ ] **Step 3: Add the contract and disabled stub**

Create `internal/demoflow/engine.go`:

```go
package demoflow

import (
	"context"
	"time"

	"officedex/internal/types"
)

type GenerateResult struct {
	TaskID    string
	SessionID string
	Status    string
}

type RespondInput struct {
	TaskID     string
	QuestionID string
	OptionID   string
	Answer     string
	Answers    []RespondAnswerInput
}

type RespondAnswerInput struct {
	QuestionGroupID string
	QuestionID      string
	OptionID        string
	Answer          string
	QuestionIndex   int
}

type ModifyPptistDeckInput struct {
	Prompt             string
	Snapshot           PptistDeckSnapshot
	SelectedSlideID    string
	SelectedElementIDs []string
}

type PptistDeckSnapshot struct {
	Slides     []PptistSlide
	SlideIndex int
}

type PptistSlide struct {
	ID         string
	Elements   []map[string]any
	Background map[string]any
}

type ModifyPptistDeckResult struct {
	Summary              string
	Ops                  []map[string]any
	Confidence           string
	RequiresConfirmation bool
	Confirmation         *PptistEditConfirmation
	Warnings             []string
}

type PptistEditConfirmation struct {
	Title     string
	Message   string
	Target    string
	Changes   []string
	Preserved []string
}

type EventRecorder interface {
	RecordAndEmitTaskEvent(context.Context, types.BridgeEvent) error
	RecordTaskWorkspaceContext(taskID, workspaceID, conversationID, parentTaskID, title string, noProject bool) error
	AllowArtifact(types.Artifact) error
	RecordArtifact(types.Artifact) error
	UserDataDir() string
}

type Options struct {
	Recorder EventRecorder
	Delay    func(context.Context) <-chan time.Time
	NewID    func() string
}

type Engine struct {
	impl implementation
}

type implementation interface {
	TryGenerate(context.Context, types.GenerateInput) (GenerateResult, bool, error)
	TryRespond(context.Context, RespondInput) ([]byte, bool, error)
	TryModifyPptistDeck(context.Context, ModifyPptistDeckInput) (ModifyPptistDeckResult, bool, error)
	Shutdown()
}

func New(options Options) *Engine {
	return &Engine{impl: newImplementation(options)}
}

func (e *Engine) TryGenerate(ctx context.Context, input types.GenerateInput) (GenerateResult, bool, error) {
	return e.impl.TryGenerate(ctx, input)
}

func (e *Engine) TryRespond(ctx context.Context, input RespondInput) ([]byte, bool, error) {
	return e.impl.TryRespond(ctx, input)
}

func (e *Engine) TryModifyPptistDeck(ctx context.Context, input ModifyPptistDeckInput) (ModifyPptistDeckResult, bool, error) {
	return e.impl.TryModifyPptistDeck(ctx, input)
}

func (e *Engine) Shutdown() {
	e.impl.Shutdown()
}
```

Create `internal/demoflow/engine_stub.go`:

```go
//go:build !officedex_demo

package demoflow

import (
	"context"

	"officedex/internal/types"
)

type disabledImplementation struct{}

func newImplementation(Options) implementation {
	return disabledImplementation{}
}

func (disabledImplementation) TryGenerate(context.Context, types.GenerateInput) (GenerateResult, bool, error) {
	return GenerateResult{}, false, nil
}

func (disabledImplementation) TryRespond(context.Context, RespondInput) ([]byte, bool, error) {
	return nil, false, nil
}

func (disabledImplementation) TryModifyPptistDeck(context.Context, ModifyPptistDeckInput) (ModifyPptistDeckResult, bool, error) {
	return ModifyPptistDeckResult{}, false, nil
}

func (disabledImplementation) Shutdown() {}

func MagicPromptForTests() string {
	return "Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review."
}
```

- [ ] **Step 4: Run the normal stub test**

Run:

```bash
go test ./internal/demoflow -run 'TestNormalBuild' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/demoflow/engine.go internal/demoflow/engine_stub.go internal/demoflow/engine_stub_test.go
git commit -m "test: add disabled demo flow stub"
```

## Task 2: Add Demo Fixtures and Exact Match Tests

**Files:**
- Create: `internal/demoflow/fixtures_demo.go`
- Create: `internal/demoflow/engine_demo.go`
- Test: `internal/demoflow/engine_demo_test.go`

- [ ] **Step 1: Write demo-build matching tests**

Create `internal/demoflow/engine_demo_test.go`:

```go
//go:build officedex_demo

package demoflow

import (
	"context"
	"testing"

	"officedex/internal/types"
)

func TestDemoBuildMatchesOnlyExactMagicPrompt(t *testing.T) {
	engine := New(Options{Recorder: newMemoryRecorder(t), Delay: instantDelay, NewID: fixedID("demo-task-1")})
	input := types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Topic:          "  " + magicPrompt + "\n",
	}
	result, ok, err := engine.TryGenerate(context.Background(), input)
	if err != nil {
		t.Fatalf("TryGenerate returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected demo flow to match")
	}
	if result.TaskID != "demo-task-1" || result.Status != "running" {
		t.Fatalf("result = %#v, want demo task running", result)
	}

	mismatches := []types.GenerateInput{
		{DocumentType: types.DocDOCX, GenerationMode: "plan", Topic: magicPrompt},
		{DocumentType: types.DocPPTX, GenerationMode: "fast", Topic: magicPrompt},
		{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt + " " + "Please."},
		{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: "Create a launch strategy presentation for a new AI productivity app."},
	}
	for _, mismatch := range mismatches {
		if _, ok, err := New(Options{Recorder: newMemoryRecorder(t), Delay: instantDelay}).TryGenerate(context.Background(), mismatch); err != nil || ok {
			t.Fatalf("mismatch %#v returned ok %v err %v", mismatch, ok, err)
		}
	}
}
```

Add test helpers in the same file:

```go
type memoryRecorder struct {
	t      *testing.T
	events []types.BridgeEvent
}

func newMemoryRecorder(t *testing.T) *memoryRecorder {
	t.Helper()
	return &memoryRecorder{t: t}
}

func (r *memoryRecorder) RecordAndEmitTaskEvent(_ context.Context, event types.BridgeEvent) error {
	r.events = append(r.events, event)
	return nil
}

func (r *memoryRecorder) RecordTaskWorkspaceContext(taskID, workspaceID, conversationID, parentTaskID, title string, noProject bool) error {
	return nil
}

func (r *memoryRecorder) AllowArtifact(types.Artifact) error { return nil }
func (r *memoryRecorder) RecordArtifact(types.Artifact) error { return nil }
func (r *memoryRecorder) UserDataDir() string { return r.t.TempDir() }

func instantDelay(context.Context) <-chan time.Time {
	ch := make(chan time.Time, 1)
	ch <- time.Now()
	return ch
}

func fixedID(id string) func() string {
	return func() string { return id }
}
```

The test helper imports are `context`, `testing`, and `time`.

- [ ] **Step 2: Run the demo matching test and verify it fails**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run TestDemoBuildMatchesOnlyExactMagicPrompt -count=1
```

Expected: FAIL because the demo implementation and fixtures do not exist.

- [ ] **Step 3: Add demo fixtures and minimal matcher**

Create `internal/demoflow/fixtures_demo.go`:

```go
//go:build officedex_demo

package demoflow

const magicPrompt = "Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review."
const timelineEditPrompt = "Make this launch timeline more visual."

var demoStages = []struct {
	ID    string
	Label string
}{
	{"idea", "Idea"},
	{"story", "Story Beats"},
	{"chapters", "Chapters"},
	{"outline", "Slide Outlines"},
	{"build", "Build PPTX"},
	{"review", "Review"},
}
```

Create `internal/demoflow/engine_demo.go` with the minimal implementation:

```go
//go:build officedex_demo

package demoflow

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"officedex/internal/types"
)

type demoImplementation struct {
	recorder EventRecorder
	delay    func(context.Context) <-chan time.Time
	newID    func() string

	mu    sync.Mutex
	tasks map[string]*demoTask
}

type demoTask struct {
	ID              string
	Prompt          string
	QuestionID      string
	ConfirmationIdx int
	Done            bool
}

func newImplementation(options Options) implementation {
	delay := options.Delay
	if delay == nil {
		delay = func(ctx context.Context) <-chan time.Time {
			return time.After(750 * time.Millisecond)
		}
	}
	newID := options.NewID
	if newID == nil {
		newID = func() string { return "demo-" + uuid.NewString() }
	}
	return &demoImplementation{
		recorder: options.Recorder,
		delay:    delay,
		newID:    newID,
		tasks:    map[string]*demoTask{},
	}
}

func (d *demoImplementation) TryGenerate(ctx context.Context, input types.GenerateInput) (GenerateResult, bool, error) {
	if input.DocumentType != types.DocPPTX || input.GenerationMode != "plan" || strings.TrimSpace(input.Topic) != magicPrompt {
		return GenerateResult{}, false, nil
	}
	if d.recorder == nil {
		return GenerateResult{}, true, errors.New("demo mode: recorder is required")
	}
	taskID := d.newID()
	task := &demoTask{ID: taskID, Prompt: strings.TrimSpace(input.Topic)}
	d.mu.Lock()
	d.tasks[taskID] = task
	d.mu.Unlock()
	if err := d.emit(ctx, taskID, "task.started", map[string]any{
		"document_type": "pptx",
		"topic":         task.Prompt,
		"stage_id":      demoStages[0].ID,
		"stage_label":   demoStages[0].Label,
	}); err != nil {
		return GenerateResult{}, true, err
	}
	go d.advanceToQuestion(context.Background(), taskID)
	return GenerateResult{TaskID: taskID, SessionID: taskID, Status: "running"}, true, nil
}

func (d *demoImplementation) TryRespond(context.Context, RespondInput) ([]byte, bool, error) {
	return nil, false, nil
}

func (d *demoImplementation) TryModifyPptistDeck(context.Context, ModifyPptistDeckInput) (ModifyPptistDeckResult, bool, error) {
	return ModifyPptistDeckResult{}, false, nil
}

func (d *demoImplementation) Shutdown() {}

func (d *demoImplementation) advanceToQuestion(ctx context.Context, taskID string) {
	<-d.delay(ctx)
	_ = d.emit(ctx, taskID, "task.question", map[string]any{
		"id":      "demo-confirm-idea",
		"question": "Confirm the idea and story direction",
		"options": []map[string]any{{"id": "confirm", "label": "Approve"}},
	})
	d.mu.Lock()
	if task := d.tasks[taskID]; task != nil {
		task.QuestionID = "demo-confirm-idea"
	}
	d.mu.Unlock()
}

func (d *demoImplementation) emit(ctx context.Context, taskID, typ string, payload map[string]any) error {
	return d.recorder.RecordAndEmitTaskEvent(ctx, types.BridgeEvent{
		EventID: "demo-" + uuid.NewString(),
		TaskID:  taskID,
		Type:    typ,
		TS:      time.Now().UTC().Format(time.RFC3339Nano),
		Payload: payload,
	})
}

func MagicPromptForTests() string { return magicPrompt }
```

- [ ] **Step 4: Run the demo matching test**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run TestDemoBuildMatchesOnlyExactMagicPrompt -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/demoflow/fixtures_demo.go internal/demoflow/engine_demo.go internal/demoflow/engine_demo_test.go
git commit -m "feat: add demo flow magic prompt matcher"
```

## Task 3: Implement Full Demo State Machine and Persistent Event Flow

**Files:**
- Modify: `internal/demoflow/engine_demo.go`
- Test: `internal/demoflow/engine_demo_test.go`

- [ ] **Step 1: Add state-machine tests**

Append to `internal/demoflow/engine_demo_test.go`:

```go
func TestDemoFlowStageOrderingAndConfirmations(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task")})
	_, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Topic:          magicPrompt,
	})
	if err != nil || !ok {
		t.Fatalf("TryGenerate ok=%v err=%v", ok, err)
	}
	waitForEvent(t, recorder, "task.question")

	confirmations := []string{"demo-confirm-idea", "demo-confirm-story", "demo-confirm-chapters", "demo-confirm-outline"}
	for _, questionID := range confirmations {
		raw, ok, err := engine.TryRespond(context.Background(), RespondInput{
			TaskID:     "demo-task",
			QuestionID: questionID,
			OptionID:   "confirm",
		})
		if err != nil || !ok || len(raw) == 0 {
			t.Fatalf("TryRespond(%s) ok=%v err=%v raw=%q", questionID, ok, err, string(raw))
		}
	}
	waitForEvent(t, recorder, "task.completed")

	got := eventTypes(recorder.events)
	wantContainsInOrder := []string{
		"task.started",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.vibe_slide",
		"task.completed",
	}
	assertContainsInOrder(t, got, wantContainsInOrder)
}

func TestDemoFlowRejectsWrongOrStaleConfirmation(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task")})
	_, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt})
	if err != nil || !ok {
		t.Fatalf("TryGenerate ok=%v err=%v", ok, err)
	}
	waitForEvent(t, recorder, "task.question")
	if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "other-task", QuestionID: "demo-confirm-idea", OptionID: "confirm"}); !ok || err == nil || !strings.Contains(err.Error(), "Demo Mode") {
		t.Fatalf("wrong task ok=%v err=%v, want Demo Mode error", ok, err)
	}
	if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "demo-task", QuestionID: "demo-confirm-story", OptionID: "confirm"}); !ok || err == nil || !strings.Contains(err.Error(), "Demo Mode") {
		t.Fatalf("stale question ok=%v err=%v, want Demo Mode error", ok, err)
	}
}
```

Add helper functions:

```go
func waitForEvent(t *testing.T, recorder *memoryRecorder, typ string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, event := range recorder.events {
			if event.Type == typ {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for event %s; got %v", typ, eventTypes(recorder.events))
}

func eventTypes(events []types.BridgeEvent) []string {
	out := make([]string, 0, len(events))
	for _, event := range events {
		out = append(out, event.Type)
	}
	return out
}

func assertContainsInOrder(t *testing.T, got []string, want []string) {
	t.Helper()
	pos := 0
	for _, item := range got {
		if pos < len(want) && item == want[pos] {
			pos++
		}
	}
	if pos != len(want) {
		t.Fatalf("events %v did not contain %v in order", got, want)
	}
}
```

Add `strings` to imports.

- [ ] **Step 2: Run the state-machine tests and verify they fail**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run 'TestDemoFlow(StageOrdering|Rejects)' -count=1
```

Expected: FAIL because `TryRespond` is not implemented.

- [ ] **Step 3: Implement confirmation stages**

Replace the `demoTask` and response implementation in `internal/demoflow/engine_demo.go` with:

```go
type demoTask struct {
	ID              string
	Prompt          string
	QuestionID      string
	ConfirmationIdx int
	Done            bool
	LastRaw         []byte
}

var demoQuestions = []struct {
	ID       string
	Question string
	StageID  string
	Label    string
}{
	{"demo-confirm-idea", "Confirm the idea and story direction", "idea", "Idea"},
	{"demo-confirm-story", "Confirm the story beats", "story", "Story Beats"},
	{"demo-confirm-chapters", "Confirm the chapter structure", "chapters", "Chapters"},
	{"demo-confirm-outline", "Confirm the per-slide outline", "outline", "Slide Outlines"},
}

func (d *demoImplementation) TryRespond(ctx context.Context, input RespondInput) ([]byte, bool, error) {
	d.mu.Lock()
	task, exists := d.tasks[input.TaskID]
	if !exists {
		d.mu.Unlock()
		return nil, true, errors.New("Demo Mode: unknown demo task")
	}
	if task.Done {
		raw := append([]byte(nil), task.LastRaw...)
		d.mu.Unlock()
		return raw, true, nil
	}
	expected := task.QuestionID
	if input.QuestionID != expected || input.OptionID != "confirm" {
		d.mu.Unlock()
		return nil, true, errors.New("Demo Mode: confirmation does not match the current prepared step")
	}
	idx := task.ConfirmationIdx
	task.ConfirmationIdx++
	task.QuestionID = ""
	raw := []byte(`{"ok":true}`)
	task.LastRaw = raw
	d.mu.Unlock()

	if err := d.emit(ctx, input.TaskID, "task.answers", map[string]any{
		"answers": []map[string]any{{"questionId": input.QuestionID, "answer": "Approve", "optionId": "confirm"}},
	}); err != nil {
		return nil, true, err
	}
	go d.advanceAfterConfirmation(context.Background(), input.TaskID, idx)
	return raw, true, nil
}

func (d *demoImplementation) advanceToQuestion(ctx context.Context, taskID string) {
	d.emitQuestion(ctx, taskID, 0)
}

func (d *demoImplementation) advanceAfterConfirmation(ctx context.Context, taskID string, answeredIdx int) {
	<-d.delay(ctx)
	_ = d.emit(ctx, taskID, "task.vibe_tree", demoTreePayload(answeredIdx))
	next := answeredIdx + 1
	if next < len(demoQuestions) {
		d.emitQuestion(ctx, taskID, next)
		return
	}
	<-d.delay(ctx)
	_ = d.emit(ctx, taskID, "task.vibe_slide", map[string]any{"index": 0, "slide": demoSlides[0]})
	_ = d.completeTask(ctx, taskID)
}

func (d *demoImplementation) emitQuestion(ctx context.Context, taskID string, idx int) {
	<-d.delay(ctx)
	q := demoQuestions[idx]
	_ = d.emit(ctx, taskID, "task.question", map[string]any{
		"id":          q.ID,
		"question":    q.Question,
		"stage_id":    q.StageID,
		"stage_label": q.Label,
		"options":     []map[string]any{{"id": "confirm", "label": "Approve"}},
	})
	d.mu.Lock()
	if task := d.tasks[taskID]; task != nil {
		task.QuestionID = q.ID
	}
	d.mu.Unlock()
}
```

Add fixture helpers in `fixtures_demo.go`:

```go
var demoSlides = []map[string]any{{
	"id": "demo-slide-1",
	"background": map[string]any{"type": "solid", "color": "#FCFAF2"},
	"elements": []map[string]any{{
		"id": "title",
		"type": "text",
		"left": 80, "top": 80, "width": 800, "height": 80,
		"content": "<p>Launch Strategy</p>",
	}},
}}

func demoTreePayload(idx int) map[string]any {
	stage := demoStages[min(idx, len(demoStages)-1)]
	return map[string]any{
		"stage":       stage.ID,
		"stage_id":    stage.ID,
		"stage_label": stage.Label,
		"tree": map[string]any{
			"id": "demo-tree",
			"rootId": "root",
			"title": "Launch Strategy",
			"nodes": []map[string]any{{
				"id": "root",
				"title": "Launch Strategy",
				"summary": "Deterministic demo node",
				"kind": "idea",
				"status": "done",
			}},
		},
	}
}
```

- [ ] **Step 4: Run the state-machine tests**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run 'TestDemoFlow(StageOrdering|Rejects)' -count=1
```

Expected: tests still fail because `completeTask` and artifact fixture are missing.

- [ ] **Step 5: Commit only if tests pass**

If tests are not passing yet, do not commit. Continue with Task 4, then commit both task changes together with the Task 4 commit.

## Task 4: Generate Deterministic Nine-Slide PPTX Artifact and Completion Event

**Files:**
- Modify: `internal/demoflow/fixtures_demo.go`
- Modify: `internal/demoflow/engine_demo.go`
- Test: `internal/demoflow/engine_demo_test.go`

- [ ] **Step 1: Add artifact and slide-6 tests**

Append to `internal/demoflow/engine_demo_test.go`:

```go
func TestDemoFlowCompletesWithNineSlidePptxArtifact(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task")})
	_, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt})
	if err != nil || !ok {
		t.Fatalf("TryGenerate ok=%v err=%v", ok, err)
	}
	for _, questionID := range []string{"demo-confirm-idea", "demo-confirm-story", "demo-confirm-chapters", "demo-confirm-outline"} {
		waitForQuestion(t, recorder, questionID)
		if _, _, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "demo-task", QuestionID: questionID, OptionID: "confirm"}); err != nil {
			t.Fatalf("TryRespond(%s): %v", questionID, err)
		}
	}
	completed := waitForEventPayload(t, recorder, "task.completed")
	result := completed["result"].(map[string]any)
	if result["document_type"] != "pptx" {
		t.Fatalf("document_type = %#v, want pptx", result["document_type"])
	}
	if _, err := os.Stat(result["file_path"].(string)); err != nil {
		t.Fatalf("artifact missing: %v", err)
	}
	reader, err := zip.OpenReader(result["file_path"].(string))
	if err != nil {
		t.Fatalf("open pptx zip: %v", err)
	}
	defer reader.Close()
	names := map[string]bool{}
	for _, file := range reader.File {
		names[file.Name] = true
	}
	for _, name := range []string{"[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide6.xml"} {
		if !names[name] {
			t.Fatalf("pptx missing %s", name)
		}
	}
	if len(demoSlides) != 9 {
		t.Fatalf("len(demoSlides) = %d, want 9", len(demoSlides))
	}
	if title := slideTitle(demoSlides[5]); title != "90-Day Launch Timeline" {
		t.Fatalf("slide 6 title = %q, want 90-Day Launch Timeline", title)
	}
}
```

Add helpers:

```go
func waitForQuestion(t *testing.T, recorder *memoryRecorder, id string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, event := range recorder.events {
			if event.Type == "task.question" && event.Payload["id"] == id {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for question %s", id)
}

func waitForEventPayload(t *testing.T, recorder *memoryRecorder, typ string) map[string]any {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, event := range recorder.events {
			if event.Type == typ {
				return event.Payload
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for event %s", typ)
	return nil
}

func slideTitle(slide map[string]any) string {
	for _, raw := range slide["elements"].([]map[string]any) {
		if raw["id"] == "title" {
			content := raw["content"].(string)
			content = strings.TrimPrefix(content, "<p>")
			content = strings.TrimSuffix(content, "</p>")
			return content
		}
	}
	return ""
}
```

Add `archive/zip` and `os` to imports.

- [ ] **Step 2: Run the artifact test and verify it fails**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run TestDemoFlowCompletesWithNineSlidePptxArtifact -count=1
```

Expected: FAIL because there is no nine-slide artifact.

- [ ] **Step 3: Expand slide fixtures to nine slides**

Replace `demoSlides` in `fixtures_demo.go` with a nine-slide slice:

```go
var demoSlides = []map[string]any{
	demoTitleSlide("demo-slide-01", "Launch Strategy", "New AI Productivity App"),
	demoBulletsSlide("demo-slide-02", "Executive Summary", []string{"Position around trusted execution", "Launch in focused professional channels", "Measure activation, retention, and team adoption"}),
	demoBulletsSlide("demo-slide-03", "Target Audience", []string{"Operators building recurring decks", "Founders preparing investor and launch materials", "Marketing teams turning briefs into presentations"}),
	demoBulletsSlide("demo-slide-04", "Positioning", []string{"From prompt to reviewable presentation workflow", "Visible planning before slide creation", "Editable output with AI-assisted refinement"}),
	demoBulletsSlide("demo-slide-05", "Launch Channels", []string{"Website launch page", "X product demo thread", "Creator and productivity communities", "Template-led onboarding campaigns"}),
	demoTimelineSlide("demo-slide-06", false),
	demoBulletsSlide("demo-slide-07", "Success Metrics", []string{"Activation: first PPTX created", "Quality: preview opened and edited", "Growth: referral and social conversion", "Revenue: paid upgrade intent"}),
	demoBulletsSlide("demo-slide-08", "Risks and Mitigations", []string{"Slow generation: deterministic staged feedback", "Unclear output quality: preview-first review", "Trust gap: transparent confirmations"}),
	demoBulletsSlide("demo-slide-09", "Next Steps", []string{"Record launch video", "Ship demo build", "Prepare website and X assets", "Open download funnel"}),
}

func demoTitleSlide(id, title, subtitle string) map[string]any {
	return map[string]any{
		"id": id,
		"background": map[string]any{"type": "solid", "color": "#FCFAF2"},
		"elements": []map[string]any{
			{"id": "title", "type": "text", "left": 72, "top": 92, "width": 780, "height": 88, "content": "<p>" + title + "</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"},
			{"id": "subtitle", "type": "text", "left": 76, "top": 205, "width": 720, "height": 52, "content": "<p>" + subtitle + "</p>", "defaultFontName": "Inter", "defaultColor": "#1A2530"},
		},
	}
}

func demoBulletsSlide(id, title string, bullets []string) map[string]any {
	elements := []map[string]any{{"id": "title", "type": "text", "left": 64, "top": 48, "width": 820, "height": 60, "content": "<p>" + title + "</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"}}
	for i, bullet := range bullets {
		elements = append(elements, map[string]any{
			"id": "bullet-" + strconv.Itoa(i+1), "type": "text",
			"left": 92, "top": 150 + i*82, "width": 760, "height": 54,
			"content": "<p>" + bullet + "</p>", "defaultFontName": "Inter", "defaultColor": "#1A2530",
		})
	}
	return map[string]any{"id": id, "background": map[string]any{"type": "solid", "color": "#FCFAF2"}, "elements": elements}
}

func demoTimelineSlide(id string, visual bool) map[string]any {
	elements := []map[string]any{{"id": "title", "type": "text", "left": 64, "top": 48, "width": 820, "height": 60, "content": "<p>90-Day Launch Timeline</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"}}
	labels := []string{"Days 1-30: Validate", "Days 31-60: Launch", "Days 61-90: Scale"}
	for i, label := range labels {
		elements = append(elements, map[string]any{
			"id": "phase-" + strconv.Itoa(i+1), "type": "text",
			"left": 80 + i*285, "top": 190, "width": 230, "height": 86,
			"content": "<p>" + label + "</p>", "defaultFontName": "Inter", "defaultColor": "#1A2530",
		})
	}
	if visual {
		elements = append(elements, map[string]any{"id": "timeline-accent", "type": "shape", "left": 72, "top": 310, "width": 780, "height": 12, "viewBox": []int{0, 0}, "path": "M 0 0 L 780 0", "fill": "#006876"})
	}
	return map[string]any{"id": id, "background": map[string]any{"type": "solid", "color": "#FCFAF2"}, "elements": elements}
}
```

Add `strconv` to imports.

- [ ] **Step 4: Implement artifact writing and completion**

Add to `engine_demo.go`:

```go
func (d *demoImplementation) completeTask(ctx context.Context, taskID string) error {
	path, err := d.writeDemoPptx(taskID)
	if err != nil {
		_ = d.emit(ctx, taskID, "task.failed", map[string]any{"message": "Demo Mode: failed to write deterministic PPTX: " + err.Error()})
		return err
	}
	artifact := types.Artifact{
		TaskID:       taskID,
		FilePath:     path,
		FileName:     filepath.Base(path),
		DocumentType: "pptx",
	}
	if err := d.recorder.AllowArtifact(artifact); err != nil {
		return err
	}
	if err := d.recorder.RecordArtifact(artifact); err != nil {
		return err
	}
	d.mu.Lock()
	if task := d.tasks[taskID]; task != nil {
		task.Done = true
	}
	d.mu.Unlock()
	return d.emit(ctx, taskID, "task.completed", map[string]any{
		"stage_id":    "review",
		"stage_label": "Review",
		"result": map[string]any{
			"file_path":     path,
			"file_name":     filepath.Base(path),
			"document_type": "pptx",
		},
	})
}

func (d *demoImplementation) writeDemoPptx(taskID string) (string, error) {
	dir := filepath.Join(d.recorder.UserDataDir(), "demo-flow", taskID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "launch-strategy-demo.pptx")
	return path, writePptx(path)
}
```

Add imports `os` and `path/filepath`.

Create `internal/demoflow/pptx_demo.go` in the same task:

```go
//go:build officedex_demo

package demoflow

import (
	"archive/zip"
	"bytes"
	"fmt"
	"html"
	"io"
	"os"
	"strings"
)

func writePptx(path string) error {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	files := map[string]string{
		"[Content_Types].xml":              contentTypesXML(),
		"_rels/.rels":                      rootRelsXML(),
		"ppt/presentation.xml":             presentationXML(),
		"ppt/_rels/presentation.xml.rels":  presentationRelsXML(),
		"ppt/theme/theme1.xml":             themeXML(),
		"ppt/slideMasters/slideMaster1.xml": masterXML(),
		"ppt/slideLayouts/slideLayout1.xml": layoutXML(),
	}
	for name, body := range files {
		if err := addZipFile(zw, name, body); err != nil {
			return err
		}
	}
	for i, slide := range demoSlides {
		if err := addZipFile(zw, fmt.Sprintf("ppt/slides/slide%d.xml", i+1), slideXML(slide)); err != nil {
			return err
		}
		if err := addZipFile(zw, fmt.Sprintf("ppt/slides/_rels/slide%d.xml.rels", i+1), slideRelsXML()); err != nil {
			return err
		}
	}
	if err := zw.Close(); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func addZipFile(zw *zip.Writer, name, body string) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = io.WriteString(w, body)
	return err
}

func slideXML(slide map[string]any) string {
	title := html.EscapeString(slideTitleText(slide))
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2800"/><a:t>` + title + `</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

func slideTitleText(slide map[string]any) string {
	elements, _ := slide["elements"].([]map[string]any)
	for _, element := range elements {
		if element["id"] == "title" {
			content, _ := element["content"].(string)
			content = strings.TrimPrefix(content, "<p>")
			content = strings.TrimSuffix(content, "</p>")
			return content
		}
	}
	return "OfficeDex Demo"
}
```

Add static XML helpers in the same file:

```go
func contentTypesXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` + slideContentTypesXML() + `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>` }
func slideContentTypesXML() string { out := ""; for i := range demoSlides { out += fmt.Sprintf(`<Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`, i+1) }; return out }
func rootRelsXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` }
func presentationXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId10"/></p:sldMasterIdLst><p:sldIdLst>` + slideIDsXML() + `</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` }
func slideIDsXML() string { out := ""; for i := range demoSlides { out += fmt.Sprintf(`<p:sldId id="%d" r:id="rId%d"/>`, 256+i, i+1) }; return out }
func presentationRelsXML() string { out := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`; for i := range demoSlides { out += fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide%d.xml"/>`, i+1, i+1) }; return out + `<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>` }
func slideRelsXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` }
func themeXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="OfficeDex Demo"><a:themeElements><a:clrScheme name="OfficeDex"><a:dk1><a:srgbClr val="05101A"/></a:dk1><a:lt1><a:srgbClr val="FCFAF2"/></a:lt1><a:dk2><a:srgbClr val="1A2530"/></a:dk2><a:lt2><a:srgbClr val="F0EEE6"/></a:lt2><a:accent1><a:srgbClr val="006876"/></a:accent1><a:accent2><a:srgbClr val="1AAE39"/></a:accent2><a:accent3><a:srgbClr val="6B46C1"/></a:accent3><a:accent4><a:srgbClr val="E6E4D8"/></a:accent4><a:accent5><a:srgbClr val="FFFFFF"/></a:accent5><a:accent6><a:srgbClr val="05101A"/></a:accent6><a:hlink><a:srgbClr val="006876"/></a:hlink><a:folHlink><a:srgbClr val="6B46C1"/></a:folHlink></a:clrScheme><a:fontScheme name="OfficeDex"><a:majorFont><a:latin typeface="Inter"/></a:majorFont><a:minorFont><a:latin typeface="Inter"/></a:minorFont></a:fontScheme><a:fmtScheme name="OfficeDex"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>` }
func masterXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>` }
func layoutXML() string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` }
```

- [ ] **Step 5: Run demo flow tests**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/demoflow/fixtures_demo.go internal/demoflow/engine_demo.go internal/demoflow/pptx_demo.go internal/demoflow/engine_demo_test.go
git commit -m "feat: implement deterministic demo task flow"
```

## Task 5: Extract Shared App Event Recorder

**Files:**
- Modify: `app.go`
- Test: existing Go tests

- [ ] **Step 1: Add app-level recorder tests**

Create or append to `app_demo_flow_test.go`:

```go
package main

import (
	"context"
	"path/filepath"
	"testing"

	"officedex/internal/localstore"
	"officedex/internal/preview"
	"officedex/internal/types"
)

func TestRecordAndEmitTaskEventPersistsWithoutWailsContext(t *testing.T) {
	store := localstore.New(filepath.Join(t.TempDir(), "officedex.sqlite"))
	if err := store.Open(context.Background()); err != nil {
		t.Fatalf("Open local store: %v", err)
	}
	reg, err := preview.New(preview.RegistryOptions{TrustedRoots: []string{t.TempDir()}})
	if err != nil {
		t.Fatalf("preview registry: %v", err)
	}
	app := &App{localStore: store, previewReg: reg}
	event := types.BridgeEvent{TaskID: "task-recorder", Type: "task.started", Payload: map[string]any{"document_type": "pptx"}}
	if err := app.RecordAndEmitTaskEvent(context.Background(), event); err != nil {
		t.Fatalf("RecordAndEmitTaskEvent: %v", err)
	}
	events, err := store.QueryEventsByTask(context.Background(), "task-recorder")
	if err != nil {
		t.Fatalf("QueryEventsByTask: %v", err)
	}
	if len(events) != 1 || events[0].Type != "task.started" {
		t.Fatalf("events = %#v", events)
	}
}
```

- [ ] **Step 2: Run the recorder test and verify it fails**

Run:

```bash
go test ./... -run TestRecordAndEmitTaskEventPersistsWithoutWailsContext -count=1
```

Expected: FAIL because `RecordAndEmitTaskEvent` does not exist.

- [ ] **Step 3: Implement recorder methods on App**

In `app.go`, add methods near `recordTaskWorkspaceContext`:

```go
func (a *App) RecordAndEmitTaskEvent(ctx context.Context, event types.BridgeEvent) error {
	completedArtifact := (*types.Artifact)(nil)
	if event.Type == "task.completed" {
		completedArtifact = artifactFromCompletedEvent(event)
	}
	if a.localStore != nil {
		if err := a.localStore.RecordEvent(event); err != nil {
			return err
		}
	}
	if event.Type == "task.completed" && completedArtifact != nil {
		if err := a.AllowArtifact(*completedArtifact); err != nil {
			return err
		}
		if err := a.RecordArtifact(*completedArtifact); err != nil {
			return err
		}
	}
	emit(ctx, bridgeEventChannel, event)
	return nil
}

func (a *App) RecordTaskWorkspaceContext(taskID, workspaceID, conversationID, parentTaskID, title string, noProject bool) error {
	return a.recordTaskWorkspaceContext(taskID, workspaceID, conversationID, parentTaskID, title, noProject)
}

func (a *App) AllowArtifact(artifact types.Artifact) error {
	if a.previewReg == nil {
		return nil
	}
	return a.previewReg.AllowArtifact(artifact)
}

func (a *App) RecordArtifact(artifact types.Artifact) error {
	if a.localStore == nil {
		return nil
	}
	return a.localStore.RecordArtifact(artifact)
}

func (a *App) UserDataDir() string {
	return a.userDataDir
}
```

- [ ] **Step 4: Refactor bridge event callback to use recorder**

In `ensureBridgeForCwd`, replace the duplicated local-store/preview registration block inside `client.OnEvent` with:

```go
if err := a.RecordAndEmitTaskEvent(ctx, event); err != nil {
	wailsruntime.LogWarningf(ctx, "record task event: %v", err)
}
if event.Type == "task.completed" || event.Type == "task.failed" {
	if a.localStore != nil && event.Payload != nil {
		if c, ok := event.Payload["credits_charged"].(float64); ok {
			charged := int(c)
			mode, _ := event.Payload["credit_mode"].(string)
			if err := a.localStore.RecordTaskCredit(event.TaskID, &charged, mode); err != nil {
				wailsruntime.LogWarningf(ctx, "record task credit: %v", err)
			}
		}
	}
}
```

Keep the existing early return for `bridge.*` events.

- [ ] **Step 5: Run recorder and existing bridge-related tests**

Run:

```bash
go test ./... -run 'TestRecordAndEmitTaskEventPersistsWithoutWailsContext|TestExitEmitsExitEventAndDoesNotReconnectWhenDisabled|TestBuildBridgeEnvNilSupplierEmitsNoProxy' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app.go app_demo_flow_test.go
git commit -m "refactor: share task event recording"
```

## Task 6: Wire Demo Flow Into App.Generate, App.Respond, and Shutdown

**Files:**
- Modify: `app.go`
- Test: `app_demo_flow_test.go`

- [ ] **Step 1: Add app-level demo routing tests**

Append to `app_demo_flow_test.go`:

```go
func TestDemoGenerateBypassesProviderValidation(t *testing.T) {
	app := newDemoTestApp(t)
	app.cachedSettings.LlmProvider = &types.LlmProvider{Type: types.LlmOpenAI, BaseURL: "", APIKey: "", Model: ""}

	result, err := app.Generate(types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Topic:          demoflow.MagicPromptForTests(),
	})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if result.TaskID == "" || result.Status != "running" {
		t.Fatalf("result = %#v", result)
	}
	if app.bridgeClient != nil {
		t.Fatal("demo generate started bridge client")
	}
}
```

Add helper:

```go
func newDemoTestApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	store := localstore.New(filepath.Join(dir, "officedex.sqlite"))
	if err := store.Open(context.Background()); err != nil {
		t.Fatalf("Open local store: %v", err)
	}
	reg, err := preview.New(preview.RegistryOptions{TrustedRoots: []string{dir}})
	if err != nil {
		t.Fatalf("preview registry: %v", err)
	}
	app := &App{
		ctx:          context.Background(),
		userDataDir:  dir,
		workspaceDir: dir,
		localStore:   store,
		previewReg:   reg,
		settingsStore: settings.New(filepath.Join(dir, "settings.json"), nil),
	}
	app.demoFlow = demoflow.New(demoflow.Options{Recorder: app})
	return app
}
```

Add imports:

```go
"officedex/internal/demoflow"
"officedex/internal/settings"
```

- [ ] **Step 2: Run app demo routing test and verify it fails**

Run:

```bash
go test -tags officedex_demo ./... -run TestDemoGenerateBypassesProviderValidation -count=1
```

Expected: FAIL because `App` has no `demoFlow` and `Generate` does not route through it.

- [ ] **Step 3: Add `demoFlow` to App and initialize it**

In `app.go`, add import:

```go
"officedex/internal/demoflow"
```

Add field:

```go
demoFlow *demoflow.Engine
```

In `NewApp`, after `app := &App{...}`, add:

```go
app.demoFlow = demoflow.New(demoflow.Options{Recorder: app})
```

In `shutdown`, before closing the local store, add:

```go
demoFlow := a.demoFlow
if demoFlow != nil {
	demoFlow.Shutdown()
}
```

- [ ] **Step 4: Route `Generate` before provider validation**

In `Generate`, after `input = normalizeGenerateInputText(input)` and before image watermark/provider validation, add:

```go
if a.demoFlow != nil {
	if result, ok, err := a.demoFlow.TryGenerate(a.ctx, input); ok || err != nil {
		if err != nil {
			return GenerateResult{}, err
		}
		return GenerateResult{TaskID: result.TaskID, SessionID: result.SessionID, Status: result.Status}, nil
	}
}
```

- [ ] **Step 5: Route `Respond` before bridge routing**

In `Respond`, after `recordRespondAnswers`, add:

```go
if a.demoFlow != nil {
	if raw, ok, err := a.demoFlow.TryRespond(a.ctx, demoflow.RespondInput{
		TaskID:     input.TaskID,
		QuestionID: input.QuestionID,
		OptionID:   input.OptionID,
		Answer:     input.Answer,
		Answers:    demoflowRespondAnswers(input.Answers),
	}); ok || err != nil {
		return raw, err
	}
}
```

Add helper near `Respond`:

```go
func demoflowRespondAnswers(input []RespondAnswerInput) []demoflow.RespondAnswerInput {
	out := make([]demoflow.RespondAnswerInput, 0, len(input))
	for _, item := range input {
		out = append(out, demoflow.RespondAnswerInput{
			QuestionGroupID: item.QuestionGroupID,
			QuestionID:      item.QuestionID,
			OptionID:        item.OptionID,
			Answer:          item.Answer,
			QuestionIndex:   item.QuestionIndex,
		})
	}
	return out
}
```

- [ ] **Step 6: Run app routing tests**

Run:

```bash
go test -tags officedex_demo ./... -run 'TestDemoGenerateBypassesProviderValidation|TestDemoFlowStageOrderingAndConfirmations' -count=1
```

Expected: PASS.

- [ ] **Step 7: Run normal build smoke test**

Run:

```bash
go test ./... -run TestNormalBuildDoesNotMatchMagicPrompt -count=1
```

Expected: PASS, proving normal build compiles without demo tag.

- [ ] **Step 8: Commit**

```bash
git add app.go app_demo_flow_test.go
git commit -m "feat: route magic prompt demo through app bindings"
```

## Task 7: Implement Deterministic PPTist Timeline Edit

**Files:**
- Modify: `internal/demoflow/fixtures_demo.go`
- Modify: `internal/demoflow/engine_demo.go`
- Modify: `app.go`
- Test: `internal/demoflow/engine_demo_test.go`
- Test: `app_demo_flow_test.go`

- [ ] **Step 1: Add edit tests**

Append to `internal/demoflow/engine_demo_test.go`:

```go
func TestDemoTimelineEditRequiresExactPromptAndSlideSix(t *testing.T) {
	engine := New(Options{Recorder: newMemoryRecorder(t)})
	snapshot := PptistDeckSnapshot{
		SlideIndex: 5,
		Slides: []PptistSlide{
			{ID: "s1"}, {ID: "s2"}, {ID: "s3"}, {ID: "s4"}, {ID: "s5"}, {ID: "demo-slide-06"}, {ID: "s7"}, {ID: "s8"}, {ID: "s9"},
		},
	}
	result, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{
		Prompt:   timelineEditPrompt,
		Snapshot: snapshot,
	})
	if err != nil || !ok {
		t.Fatalf("TryModifyPptistDeck ok=%v err=%v", ok, err)
	}
	if !result.RequiresConfirmation || len(result.Ops) != 1 || result.Ops[0]["type"] != "slide:replace" {
		t.Fatalf("result = %#v, want confirmation slide:replace", result)
	}
	if result.Ops[0]["index"] != 5 {
		t.Fatalf("op index = %#v, want 5", result.Ops[0]["index"])
	}

	wrongPrompt, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: "Make the timeline more visual.", Snapshot: snapshot})
	if err != nil || !ok {
		t.Fatalf("wrong prompt ok=%v err=%v", ok, err)
	}
	if wrongPrompt.Summary != "Demo mode supports the prepared timeline edit." {
		t.Fatalf("wrong prompt summary = %q", wrongPrompt.Summary)
	}

	snapshot.SlideIndex = 4
	if _, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: timelineEditPrompt, Snapshot: snapshot}); !ok || err == nil || !strings.Contains(err.Error(), "slide 6") {
		t.Fatalf("wrong slide ok=%v err=%v, want slide 6 error", ok, err)
	}
}
```

- [ ] **Step 2: Run edit test and verify it fails**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run TestDemoTimelineEditRequiresExactPromptAndSlideSix -count=1
```

Expected: FAIL because demo edit is not implemented.

- [ ] **Step 3: Add replacement fixture**

In `fixtures_demo.go`, add:

```go
var demoTimelineVisualSlide = demoTimelineSlide("demo-slide-06", true)
```

- [ ] **Step 4: Implement demo edit**

In `engine_demo.go`, replace `TryModifyPptistDeck` with:

```go
func (d *demoImplementation) TryModifyPptistDeck(_ context.Context, input ModifyPptistDeckInput) (ModifyPptistDeckResult, bool, error) {
	if strings.TrimSpace(input.Prompt) != timelineEditPrompt {
		return ModifyPptistDeckResult{
			Summary:              "Demo mode supports the prepared timeline edit.",
			Ops:                  nil,
			Confidence:           "high",
			RequiresConfirmation: false,
			Warnings:             []string{"Demo mode supports one prepared edit."},
		}, true, nil
	}
	if len(input.Snapshot.Slides) < 6 {
		return ModifyPptistDeckResult{}, true, errors.New("Demo Mode: prepared timeline edit requires slide 6")
	}
	targetIndex := input.Snapshot.SlideIndex
	if input.SelectedSlideID != "" {
		for i, slide := range input.Snapshot.Slides {
			if slide.ID == input.SelectedSlideID {
				targetIndex = i
				break
			}
		}
	}
	if targetIndex != 5 {
		return ModifyPptistDeckResult{}, true, errors.New("Demo Mode: prepared timeline edit only supports slide 6")
	}
	return ModifyPptistDeckResult{
		Summary:              "Prepared a more visual launch timeline.",
		Confidence:           "high",
		RequiresConfirmation: true,
		Ops: []map[string]any{{
			"type":  "slide:replace",
			"index": 5,
			"slide": demoTimelineVisualSlide,
		}},
		Confirmation: &PptistEditConfirmation{
			Title:     "Apply prepared timeline edit?",
			Message:   "Demo Mode prepared the approved visual timeline replacement for slide 6.",
			Target:    "Slide 6",
			Changes:   []string{"Replace the text-heavy timeline with a visual 90-day timeline."},
			Preserved: []string{"Deck topic", "slide count", "paper-and-ink visual system"},
		},
	}, true, nil
}
```

- [ ] **Step 5: Route App.ModifyPptistDeck through Demo Flow**

In `app.go`, in `ModifyPptistDeck`, after validating prompt and snapshot, before `planDeterministicPptistTitleEdit`, add:

```go
if a.demoFlow != nil {
	if result, ok, err := a.demoFlow.TryModifyPptistDeck(a.ctx, demoflow.ModifyPptistDeckInput{
		Prompt:             input.Prompt,
		Snapshot:           demoflowPptistSnapshot(input.Snapshot),
		SelectedSlideID:    input.SelectedSlideID,
		SelectedElementIDs: append([]string(nil), input.SelectedElementIDs...),
	}); ok || err != nil {
		if err != nil {
			return ModifyPptistDeckResult{}, err
		}
		var confirmation *PptistEditConfirmation
		if result.Confirmation != nil {
			confirmation = &PptistEditConfirmation{
				Title:     result.Confirmation.Title,
				Message:   result.Confirmation.Message,
				Target:    result.Confirmation.Target,
				Changes:   append([]string(nil), result.Confirmation.Changes...),
				Preserved: append([]string(nil), result.Confirmation.Preserved...),
			}
		}
		return ModifyPptistDeckResult{
			Summary:              result.Summary,
			Ops:                  result.Ops,
			Confidence:           result.Confidence,
			RequiresConfirmation: result.RequiresConfirmation,
			Confirmation:         confirmation,
			Warnings: append([]string(nil), result.Warnings...),
		}, nil
	}
}
```

Add helper:

```go
func demoflowPptistSnapshot(input PptistDeckSnapshot) demoflow.PptistDeckSnapshot {
	slides := make([]demoflow.PptistSlide, 0, len(input.Slides))
	for _, slide := range input.Slides {
		slides = append(slides, demoflow.PptistSlide{
			ID:         slide.ID,
			Elements:   append([]map[string]any(nil), slide.Elements...),
			Background: cloneMapAny(slide.Background),
		})
	}
	return demoflow.PptistDeckSnapshot{Slides: slides, SlideIndex: input.SlideIndex}
}

func cloneMapAny(input map[string]any) map[string]any {
	if input == nil {
		return nil
	}
	out := make(map[string]any, len(input))
	for k, v := range input {
		out[k] = v
	}
	return out
}
```

- [ ] **Step 6: Run edit tests**

Run:

```bash
go test -tags officedex_demo ./internal/demoflow -run TestDemoTimelineEditRequiresExactPromptAndSlideSix -count=1
go test -tags officedex_demo ./... -run 'TestDemoTimelineEditRequiresExactPromptAndSlideSix|TestPlanDeterministicPptistTitleEdit' -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/demoflow/fixtures_demo.go internal/demoflow/engine_demo.go internal/demoflow/engine_demo_test.go app.go app_demo_flow_test.go app_pptist_modify_test.go
git commit -m "feat: add deterministic demo timeline edit"
```

## Task 8: Add Build Script and Normal-Bundle Isolation Checks

**Files:**
- Modify: `package.json`
- Test: shell commands

- [ ] **Step 1: Add build script**

In `package.json`, add:

```json
"build:demo": "wails build -tags officedex_demo -ldflags \"-X main.appVersion=$(node -p 'require(`./package.json`).version')-demo\""
```

Place it next to `build`.

- [ ] **Step 2: Verify normal build does not compile demo fixtures**

Run:

```bash
go test ./... -run TestNormalBuildDoesNotMatchMagicPrompt -count=1
```

Expected: PASS.

Run:

```bash
go test -tags officedex_demo ./... -run 'TestDemoBuildMatchesOnlyExactMagicPrompt|TestDemoArtifactIsValidPptxPackage|TestDemoTimelineEditRequiresExactPromptAndSlideSix|TestDemoGenerateBypassesProviderValidation' -count=1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: add OfficeDex demo build script"
```

## Task 9: Renderer Replay and PPTist Edit Surface Verification

**Files:**
- Modify: `src/renderer/taskState.test.ts`
- Modify only if tests reveal a real gap: `src/renderer/taskState.ts`

- [ ] **Step 1: Add renderer replay test**

Append to `src/renderer/taskState.test.ts`:

```ts
it("replays demo staged PPTX events into a completed PPTist-reviewable task", () => {
  let state = createInitialTaskState();
  const taskId = "demo-task";
  const events = [
    { task_id: taskId, type: "task.started", payload: { document_type: "pptx", topic: "Launch strategy", stage_id: "idea", stage_label: "Idea" } },
    { task_id: taskId, type: "task.question", payload: { id: "demo-confirm-idea", question: "Confirm the idea", options: [{ id: "confirm", label: "Approve" }] } },
    { task_id: taskId, type: "task.vibe_tree", payload: { stage: "outline", tree: { id: "demo-tree", rootId: "root", title: "Launch Strategy", nodes: [{ id: "root", title: "Launch Strategy", summary: "Demo", kind: "idea" }] } } },
    { task_id: taskId, type: "task.vibe_slide", payload: { index: 5, slide: { id: "demo-slide-06", elements: [{ id: "title", type: "text", left: 0, top: 0, width: 100, height: 40, content: "<p>90-Day Launch Timeline</p>" }] } } },
    { task_id: taskId, type: "task.completed", payload: { result: { file_path: "/tmp/launch-strategy-demo.pptx", file_name: "launch-strategy-demo.pptx", document_type: "pptx" } } },
  ] as const;
  for (const event of events) state = applyTaskEvent(state, event);
  const task = state.tasks[taskId];
  expect(task.status).toBe("completed");
  expect(task.documentType).toBe("pptx");
  expect(task.artifact?.fileName).toBe("launch-strategy-demo.pptx");
  expect(task.vibeSlides?.[5]?.id).toBe("demo-slide-06");
});
```

- [ ] **Step 2: Run renderer replay test**

Run:

```bash
npx vitest run src/renderer/taskState.test.ts -t "replays demo staged PPTX events"
```

Expected: PASS. If it fails, update `taskState.ts` only for the missing event-replay behavior exposed by the test.

- [ ] **Step 3: Run PPTist edit component tests**

Run:

```bash
npx vitest run src/renderer/components/PptistEmbedPanel.test.tsx src/renderer/screens/DialogueScreens.test.tsx -t "edit"
```

Expected: PASS or unrelated skipped/no matching tests. If failures are caused by `slide:replace`, add a focused test that posts a `slide:replace` op and expects `pptist:apply-edit-ops` to be sent unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/taskState.test.ts src/renderer/taskState.ts src/renderer/components/PptistEmbedPanel.test.tsx src/renderer/screens/DialogueScreens.test.tsx
git commit -m "test: cover demo task replay in renderer"
```

## Task 10: Full Verification

**Files:**
- No source edits unless verification exposes a defect.

- [ ] **Step 1: Run focused Go tests**

Run:

```bash
go test ./... -run 'TestNormalBuildDoesNotMatchMagicPrompt|TestRecordAndEmitTaskEventPersistsWithoutWailsContext' -count=1
```

Expected: PASS.

- [ ] **Step 2: Run demo Go tests**

Run:

```bash
go test -tags officedex_demo ./... -run 'TestDemo|TestRecordAndEmitTaskEventPersistsWithoutWailsContext' -count=1
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
npx vitest run src/renderer/taskState.test.ts src/renderer/App.test.tsx src/renderer/components/PptistEmbedPanel.test.tsx src/renderer/screens/DialogueScreens.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Build normal app**

Run:

```bash
npm run build
```

Expected: PASS. Normal app must route the magic prompt through the normal path because `officedex_demo` is not set.

- [ ] **Step 6: Build demo app**

Run:

```bash
npm run build:demo
```

Expected: PASS. Demo app must include the deterministic flow.

- [ ] **Step 7: Manual smoke test in demo app**

Open the demo app and run:

```text
Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review.
```

Expected:

- task starts without login or provider validation;
- four real confirmation gates appear and require clicks;
- stage results appear after short fixed delays;
- completed artifact is `launch-strategy-demo.pptx`;
- PPTist preview opens;
- slide 6 is `90-Day Launch Timeline`;
- edit prompt `Make this launch timeline more visual.` returns a confirmation-required slide replacement;
- any other edit prompt returns `Demo mode supports the prepared timeline edit.`;
- after app restart, the task reopens from persisted events.

- [ ] **Step 8: Commit verification fixes if any**

If verification required fixes:

```bash
git status --short
git add app.go package.json internal/demoflow src/renderer/taskState.test.ts src/renderer/taskState.ts src/renderer/components/PptistEmbedPanel.test.tsx src/renderer/screens/DialogueScreens.test.tsx app_demo_flow_test.go app_pptist_modify_test.go
git commit -m "fix: stabilize OfficeDex demo flow verification"
```

If no fixes were required, do not create an empty commit.
