//go:build !officedex_demo

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
	if _, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: "Turn this launch timeline into a vertical roadmap."}); err != nil || ok {
		t.Fatalf("TryModifyPptistDeck = ok %v err %v, want ok false nil", ok, err)
	}
}
