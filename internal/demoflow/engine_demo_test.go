//go:build officedex_demo

package demoflow

import (
	"context"
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
	if len(recorder.events) == 0 || recorder.events[0].Type != "task.started" {
		t.Fatalf("events = %#v, want first event task.started", recorder.events)
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
