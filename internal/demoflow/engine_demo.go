//go:build officedex_demo

package demoflow

import (
	"context"
	"errors"
	"os"
	"path/filepath"
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
		"answers": []map[string]any{{
			"questionId": input.QuestionID,
			"answer":     "Approve",
			"optionId":   "confirm",
		}},
	}); err != nil {
		return nil, true, err
	}
	go d.advanceAfterConfirmation(context.Background(), input.TaskID, idx)
	return raw, true, nil
}

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

func (d *demoImplementation) Shutdown() {}

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

func (d *demoImplementation) emit(ctx context.Context, taskID, typ string, payload map[string]any) error {
	return d.recorder.RecordAndEmitTaskEvent(ctx, types.BridgeEvent{
		EventID: "demo-" + uuid.NewString(),
		TaskID:  taskID,
		Type:    typ,
		TS:      time.Now().UTC().Format(time.RFC3339Nano),
		Payload: payload,
	})
}

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

func MagicPromptForTests() string { return magicPrompt }
