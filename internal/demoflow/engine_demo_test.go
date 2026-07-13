//go:build officedex_demo

package demoflow

import (
	"archive/zip"
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"officedex/internal/types"
)

func TestDemoBuildMatchesOnlyExactMagicPrompt(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task-1")})
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
	events := recorder.snapshot()
	if len(events) == 0 || events[0].Type != "task.started" {
		t.Fatalf("events = %#v, want first event task.started", events)
	}

	mismatches := []types.GenerateInput{
		{DocumentType: types.DocDOCX, GenerationMode: "plan", Topic: magicPrompt},
		{DocumentType: types.DocPPTX, GenerationMode: "fast", Topic: magicPrompt},
		{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt + " Please."},
		{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: "Create a launch strategy presentation for a new AI productivity app."},
	}
	for _, mismatch := range mismatches {
		if _, ok, err := New(Options{Recorder: newMemoryRecorder(t), Delay: instantDelay}).TryGenerate(context.Background(), mismatch); err != nil || ok {
			t.Fatalf("mismatch %#v returned ok %v err %v", mismatch, ok, err)
		}
	}
}

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
		waitForQuestion(t, recorder, questionID)
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

	got := eventTypes(recorder.snapshot())
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

type memoryRecorder struct {
	t      *testing.T
	mu     sync.Mutex
	events []types.BridgeEvent
}

func newMemoryRecorder(t *testing.T) *memoryRecorder {
	t.Helper()
	return &memoryRecorder{t: t}
}

func (r *memoryRecorder) RecordAndEmitTaskEvent(_ context.Context, event types.BridgeEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
	return nil
}

func (r *memoryRecorder) snapshot() []types.BridgeEvent {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]types.BridgeEvent(nil), r.events...)
}

func (r *memoryRecorder) RecordTaskWorkspaceContext(taskID, workspaceID, conversationID, parentTaskID, title string, noProject bool) error {
	return nil
}

func (r *memoryRecorder) AllowArtifact(types.Artifact) error  { return nil }
func (r *memoryRecorder) RecordArtifact(types.Artifact) error { return nil }
func (r *memoryRecorder) UserDataDir() string                 { return r.t.TempDir() }

func instantDelay(context.Context) <-chan time.Time {
	ch := make(chan time.Time, 1)
	ch <- time.Now()
	return ch
}

func fixedID(id string) func() string {
	return func() string { return id }
}

func waitForEvent(t *testing.T, recorder *memoryRecorder, typ string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		events := recorder.snapshot()
		for _, event := range events {
			if event.Type == typ {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for event %s; got %v", typ, eventTypes(recorder.snapshot()))
}

func waitForQuestion(t *testing.T, recorder *memoryRecorder, id string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, event := range recorder.snapshot() {
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
		for _, event := range recorder.snapshot() {
			if event.Type == typ {
				return event.Payload
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for event %s", typ)
	return nil
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
