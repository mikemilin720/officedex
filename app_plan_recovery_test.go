package main

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"officedex/internal/bridge"
	"officedex/internal/localstore"
	"officedex/internal/types"
)

func TestRespondRecoversStalePlanQuestionTask(t *testing.T) {
	ctx := context.Background()
	oldTaskID := "task-stale-plan-question"
	newTaskID := "task-recovered-plan-question"
	workspaceDir := t.TempDir()

	store := localstore.New(filepath.Join(t.TempDir(), "officedex.db"))
	if err := store.Open(ctx); err != nil {
		t.Fatalf("open local store: %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})

	workspace, err := store.EnsureWorkspace(ctx, workspaceDir)
	if err != nil {
		t.Fatalf("EnsureWorkspace: %v", err)
	}
	if err := store.EnsureConversation(ctx, workspace.ID, "conversation-recover", "Generate investor deck"); err != nil {
		t.Fatalf("EnsureConversation: %v", err)
	}
	if err := store.RecordTaskContext(ctx, oldTaskID, localstore.TaskContext{
		WorkspaceID:    workspace.ID,
		ConversationID: "conversation-recover",
	}); err != nil {
		t.Fatalf("RecordTaskContext: %v", err)
	}
	if err := store.RecordEvent(types.BridgeEvent{
		EventID: "event-user-input",
		TaskID:  oldTaskID,
		Type:    "task.user_input",
		Payload: map[string]any{
			"document_type": "pptx",
			"topic":         "Investor deck",
			"prompt":        "Generate an investor deck",
			"enable_images": true,
			"local_preview": true,
		},
	}); err != nil {
		t.Fatalf("RecordEvent user input: %v", err)
	}
	if err := store.RecordEvent(types.BridgeEvent{
		EventID: "event-question",
		TaskID:  oldTaskID,
		Type:    "task.question",
		Payload: map[string]any{
			"id":           "question-group",
			"question":     "Who is the audience?",
			"currentIndex": 1,
			"questions": []map[string]any{
				{"id": "q-audience", "question": "Who is the audience?"},
				{"id": "q-tone", "question": "Which tone should it use?"},
			},
		},
	}); err != nil {
		t.Fatalf("RecordEvent question: %v", err)
	}
	if err := store.RecordTaskAnswers(ctx, oldTaskID, []localstore.TaskAnswer{
		{QuestionGroupID: "question-group", QuestionID: "q-audience", OptionID: "leadership", Answer: "Leadership", QuestionIndex: 0},
	}); err != nil {
		t.Fatalf("RecordTaskAnswers existing: %v", err)
	}

	transport := newCancelPersistTransport()
	client := bridge.New(bridge.Options{
		RequestTimeout: 500 * time.Millisecond,
		CreateTransport: func(opts bridge.Options) (bridge.Transport, error) {
			return transport, nil
		},
		DisableAutoReconnect: true,
	})
	if err := client.Start(ctx); err != nil {
		t.Fatalf("start bridge client: %v", err)
	}
	t.Cleanup(client.Stop)

	app := &App{
		ctx:          ctx,
		userDataDir:  t.TempDir(),
		workspaceDir: workspaceDir,
		localStore:   store,
		bridgeClient: client,
		bridgeCwd:    workspaceDir,
	}

	done := make(chan struct {
		raw []byte
		err error
	}, 1)
	go func() {
		raw, err := app.Respond(RespondInput{
			TaskID:     oldTaskID,
			QuestionID: "question-group",
			OptionID:   "concise",
			Answer:     "Concise",
			Answers: []RespondAnswerInput{
				{QuestionGroupID: "question-group", QuestionID: "q-audience", OptionID: "leadership", Answer: "Leadership", QuestionIndex: 0},
				{QuestionGroupID: "question-group", QuestionID: "q-tone", OptionID: "concise", Answer: "Concise", QuestionIndex: 1},
			},
		})
		done <- struct {
			raw []byte
			err error
		}{raw: raw, err: err}
	}()

	req := transport.readRequest(t)
	if req.Method != "task/respond" {
		t.Fatalf("bridge request method = %q, want task/respond", req.Method)
	}
	transport.writeError(t, req.ID, "task not found: "+oldTaskID)

	req = transport.readRequest(t)
	if req.Method != "session/open" {
		t.Fatalf("bridge request method = %q, want session/open", req.Method)
	}
	transport.writeResponse(t, req.ID, map[string]any{"id": "session-recovered"})

	req = transport.readRequest(t)
	if req.Method != "task/invoke" {
		t.Fatalf("bridge request method = %q, want task/invoke", req.Method)
	}
	var invokeParams map[string]any
	if err := json.Unmarshal(req.Params, &invokeParams); err != nil {
		t.Fatalf("decode task/invoke params: %v", err)
	}
	args, ok := invokeParams["args"].(map[string]any)
	if !ok {
		t.Fatalf("task/invoke args = %#v", invokeParams["args"])
	}
	if args["document_type"] != "pptx" || args["prompt"] != "Generate an investor deck" {
		t.Fatalf("task/invoke args = %#v", args)
	}
	if args["topic"] != "Investor deck" {
		t.Fatalf("task/invoke topic = %#v, want Investor deck; args=%#v", args["topic"], args)
	}
	transport.writeResponse(t, req.ID, map[string]any{"task_id": newTaskID, "session_id": "session-recovered", "status": "running"})

	req = transport.readRequest(t)
	if req.Method != "task/status" {
		t.Fatalf("bridge request method = %q, want task/status", req.Method)
	}
	transport.writeResponse(t, req.ID, map[string]any{
		"task_id":    newTaskID,
		"session_id": "session-recovered",
		"status":     "question",
		"current_question": map[string]any{
			"id":            "question-group",
			"current_index": 0,
			"questions": []map[string]any{
				{"id": "q-audience", "question": "Who is the audience?"},
				{"id": "q-tone", "question": "Which tone should it use?"},
			},
		},
	})

	req = transport.readRequest(t)
	if req.Method != "task/respond" {
		t.Fatalf("bridge request method = %q, want recovered task/respond", req.Method)
	}
	var respondParams map[string]any
	if err := json.Unmarshal(req.Params, &respondParams); err != nil {
		t.Fatalf("decode recovered task/respond params: %v", err)
	}
	if respondParams["task_id"] != newTaskID {
		t.Fatalf("recovered task_id = %q, want %q", respondParams["task_id"], newTaskID)
	}
	rawAnswers, ok := respondParams["answers"].([]any)
	if !ok || len(rawAnswers) != 2 {
		t.Fatalf("recovered answers = %#v, want two answers", respondParams["answers"])
	}
	if respondParams["option_id"] != "concise" || respondParams["answer"] != "Concise" {
		t.Fatalf("recovered single-answer fallback = option_id:%#v answer:%#v, want concise/Concise", respondParams["option_id"], respondParams["answer"])
	}
	transport.writeResponse(t, req.ID, map[string]any{"accepted": true, "task_id": newTaskID})

	select {
	case out := <-done:
		if out.err != nil {
			t.Fatalf("Respond: %v", out.err)
		}
		text := string(out.raw)
		if !strings.Contains(text, `"recoveredFrom":"`+oldTaskID+`"`) || !strings.Contains(text, `"taskId":"`+newTaskID+`"`) {
			t.Fatalf("Respond raw = %s, want recovered metadata", text)
		}
	case <-time.After(time.Second):
		t.Fatal("Respond did not return")
	}

	answers, err := store.QueryTaskAnswers(ctx, oldTaskID)
	if err != nil {
		t.Fatalf("QueryTaskAnswers: %v", err)
	}
	if len(answers) != 2 || answers[1].QuestionID != "q-tone" || answers[1].OptionID != "concise" {
		t.Fatalf("persisted answers after recovery = %#v", answers)
	}
}

func TestRecoverGenerateInputFromEventsFillsMissingTopicFromPrompt(t *testing.T) {
	got, err := recoverGenerateInputFromEvents([]types.BridgeEvent{
		{
			EventID: "event-user-input",
			TaskID:  "task-prompt-only",
			Type:    "task.user_input",
			Payload: map[string]any{
				"document_type": "pptx",
				"prompt":        "Generate a reloaded deck",
			},
		},
		{
			EventID: "event-question",
			TaskID:  "task-prompt-only",
			Type:    "task.question",
			Payload: map[string]any{"id": "question-group"},
		},
	}, localstore.TaskContext{WorkspaceID: "ws-1", ConversationID: "conversation-1"})
	if err != nil {
		t.Fatalf("recoverGenerateInputFromEvents: %v", err)
	}
	if got.Topic != "Generate a reloaded deck" {
		t.Fatalf("Topic = %q, want prompt fallback", got.Topic)
	}
	if got.Prompt != "Generate a reloaded deck" {
		t.Fatalf("Prompt = %q, want original prompt", got.Prompt)
	}
}

func TestRecoverGenerateInputFromEventsReadsNestedTextInputTopic(t *testing.T) {
	got, err := recoverGenerateInputFromEvents([]types.BridgeEvent{
		{
			EventID: "event-user-input",
			TaskID:  "task-nested-topic",
			Type:    "task.user_input",
			Payload: map[string]any{
				"documentType": "docx",
				"text_input": map[string]any{
					"topic":  "Quarterly impact report",
					"prompt": "Write a concise quarterly impact report",
				},
			},
		},
		{
			EventID: "event-question",
			TaskID:  "task-nested-topic",
			Type:    "task.question",
			Payload: map[string]any{"id": "question-group"},
		},
	}, localstore.TaskContext{WorkspaceID: "ws-1", ConversationID: "conversation-1"})
	if err != nil {
		t.Fatalf("recoverGenerateInputFromEvents: %v", err)
	}
	if got.Topic != "Quarterly impact report" {
		t.Fatalf("Topic = %q, want nested text_input topic", got.Topic)
	}
	if got.Prompt != "Write a concise quarterly impact report" {
		t.Fatalf("Prompt = %q, want nested text_input prompt", got.Prompt)
	}
}

func TestGenerateInputEventPayloadBackfillsTopicFromPrompt(t *testing.T) {
	payload := generateInputEventPayload(types.GenerateInput{
		DocumentType: types.DocPPTX,
		Prompt:       "Generate a recovery-safe deck",
	}, localstore.TaskContext{})
	if payload["topic"] != "Generate a recovery-safe deck" {
		t.Fatalf("payload topic = %#v, want prompt fallback; payload=%#v", payload["topic"], payload)
	}
	if payload["prompt"] != "Generate a recovery-safe deck" {
		t.Fatalf("payload prompt = %#v, want original prompt; payload=%#v", payload["prompt"], payload)
	}
}

func TestGenerateInputEventPayloadAndRecoveryPreserveGenerationMode(t *testing.T) {
	payload := generateInputEventPayload(types.GenerateInput{
		DocumentType:   types.DocDOCX,
		Topic:          "Plan mode recovery",
		Prompt:         "Write a plan-mode document",
		GenerationMode: "plan",
	}, localstore.TaskContext{})
	if payload["generation_mode"] != "plan" || payload["generationMode"] != "plan" {
		t.Fatalf("generation mode payload = %#v", payload)
	}
	if _, ok := payload["runtime_mode"]; ok {
		t.Fatalf("runtime_mode should not carry generation mode: %#v", payload["runtime_mode"])
	}

	got, err := recoverGenerateInputFromEvents([]types.BridgeEvent{
		{
			EventID: "event-user-input",
			TaskID:  "task-plan-recovery",
			Type:    "task.user_input",
			Payload: payload,
		},
		{
			EventID: "event-question",
			TaskID:  "task-plan-recovery",
			Type:    "task.question",
			Payload: map[string]any{"id": "question-group"},
		},
	}, localstore.TaskContext{})
	if err != nil {
		t.Fatalf("recoverGenerateInputFromEvents: %v", err)
	}
	if got.GenerationMode != "plan" {
		t.Fatalf("GenerationMode = %q, want plan", got.GenerationMode)
	}
	if got.RuntimeMode != "" {
		t.Fatalf("RuntimeMode = %q, want empty", got.RuntimeMode)
	}
}
