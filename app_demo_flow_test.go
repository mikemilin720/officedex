package main

import (
	"context"
	"path/filepath"
	"testing"

	"officedex/internal/demoflow"
	"officedex/internal/localstore"
	"officedex/internal/preview"
	"officedex/internal/settings"
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
		ctx:           context.Background(),
		userDataDir:   dir,
		workspaceDir:  dir,
		localStore:    store,
		previewReg:    reg,
		settingsStore: settings.New(filepath.Join(dir, "settings.json"), nil),
	}
	app.demoFlow = demoflow.New(demoflow.Options{Recorder: app})
	return app
}
