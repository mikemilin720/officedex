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
	ID         string
	Prompt     string
	QuestionID string
	Done       bool
}

func newImplementation(options Options) implementation {
	delay := options.Delay
	if delay == nil {
		delay = func(context.Context) <-chan time.Time {
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
	prompt := strings.TrimSpace(input.Topic)
	if input.DocumentType != types.DocPPTX || input.GenerationMode != "plan" || prompt != magicPrompt {
		return GenerateResult{}, false, nil
	}
	if d.recorder == nil {
		return GenerateResult{}, true, errors.New("demo mode: recorder is required")
	}

	taskID := d.newID()
	task := &demoTask{ID: taskID, Prompt: prompt}
	d.mu.Lock()
	d.tasks[taskID] = task
	d.mu.Unlock()

	if err := d.emit(ctx, taskID, "task.started", map[string]any{
		"document_type": "pptx",
		"topic":         prompt,
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
		"id":       "demo-confirm-idea",
		"question": "Confirm the idea and story direction",
		"options": []map[string]any{
			{"id": "confirm", "label": "Approve"},
		},
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
