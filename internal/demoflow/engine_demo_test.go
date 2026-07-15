//go:build officedex_demo

package demoflow

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
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

func TestDemoBuildMatchesMagicPromptFromRendererPromptField(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task-prompt")})
	result, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Prompt:         magicPrompt,
	})
	if err != nil {
		t.Fatalf("TryGenerate returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected demo flow to match renderer prompt field")
	}
	if result.TaskID != "demo-task-prompt" || result.Status != "running" {
		t.Fatalf("result = %#v, want demo task running", result)
	}
}

func TestDemoBuildMatchesMagicPromptWhenRendererTopicIsSummary(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task-summary")})
	result, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{
		DocumentType:   types.DocPPTX,
		GenerationMode: "plan",
		Topic:          "Create a launch strategy presentation",
		Prompt:         magicPrompt,
	})
	if err != nil {
		t.Fatalf("TryGenerate returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected demo flow to match exact magic prompt even when renderer topic is a summary")
	}
	if result.TaskID != "demo-task-summary" || result.Status != "running" {
		t.Fatalf("result = %#v, want demo task running", result)
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

	confirmations := demoConfirmationIDs()
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
		"task.vibe_slide",
		"task.vibe_tree",
		"task.completed",
	}
	assertContainsInOrder(t, got, wantContainsInOrder)
}

func TestDemoFlowWritesPptxUnderWorkspaceDir(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task")})
	_, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt})
	if err != nil || !ok {
		t.Fatalf("TryGenerate ok=%v err=%v", ok, err)
	}
	for _, questionID := range demoConfirmationIDs() {
		waitForQuestion(t, recorder, questionID)
		if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "demo-task", QuestionID: questionID, OptionID: "confirm"}); err != nil || !ok {
			t.Fatalf("TryRespond(%s) ok=%v err=%v", questionID, ok, err)
		}
	}
	waitForEvent(t, recorder, "task.completed")
	artifact := recorder.lastArtifact()
	if artifact == nil {
		t.Fatal("expected recorded artifact")
	}
	if !strings.HasPrefix(artifact.FilePath, recorder.WorkspaceDir()+string(os.PathSeparator)) {
		t.Fatalf("artifact path = %q, want under workspace %q", artifact.FilePath, recorder.WorkspaceDir())
	}
}

func TestDemoVibeTreeStagesMatchRendererAcceptedStages(t *testing.T) {
	accepted := map[string]bool{
		"story_ready":   true,
		"outline_ready": true,
		"refined_ready": true,
		"slides_ready":  true,
		"rendering":     true,
		"completed":     true,
	}
	for idx := range demoQuestions {
		payload := demoTreePayload(idx)
		stage, _ := payload["stage"].(string)
		if stage == "story_ready" {
			t.Fatalf("demoTreePayload(%d) stage = story_ready, promo demo must avoid the renderer idea gate", idx)
		}
		if !accepted[stage] {
			t.Fatalf("demoTreePayload(%d) stage = %q, want renderer-accepted stage", idx, stage)
		}
	}
}

func TestDemoVibeTreeExpandsAcrossVisibleNodeTypes(t *testing.T) {
	cases := []struct {
		idx      int
		stage    string
		wantKind string
	}{
		{0, "outline_ready", "slide_group"},
		{1, "refined_ready", "outline"},
		{2, "slides_ready", "generated_slide"},
		{3, "completed", "deck"},
	}
	for _, tc := range cases {
		payload := demoTreePayload(tc.idx)
		if payload["stage"] != tc.stage {
			t.Fatalf("demoTreePayload(%d) stage = %v, want %s", tc.idx, payload["stage"], tc.stage)
		}
		kinds := demoPayloadNodeKinds(t, payload)
		if kinds[tc.wantKind] == 0 {
			t.Fatalf("demoTreePayload(%d) node kinds = %#v, want at least one %s", tc.idx, kinds, tc.wantKind)
		}
	}
	slideKinds := demoPayloadNodeKinds(t, demoTreePayload(2))
	if slideKinds["generated_slide"] != len(demoSlides) {
		t.Fatalf("slides_ready generated slides = %d, want %d", slideKinds["generated_slide"], len(demoSlides))
	}
}

func TestDemoFlowRejectsWrongOrStaleConfirmation(t *testing.T) {
	recorder := newMemoryRecorder(t)
	engine := New(Options{Recorder: recorder, Delay: instantDelay, NewID: fixedID("demo-task")})
	_, ok, err := engine.TryGenerate(context.Background(), types.GenerateInput{DocumentType: types.DocPPTX, GenerationMode: "plan", Topic: magicPrompt})
	if err != nil || !ok {
		t.Fatalf("TryGenerate ok=%v err=%v", ok, err)
	}
	waitForEvent(t, recorder, "task.question")
	if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "other-task", QuestionID: "demo-confirm-story", OptionID: "confirm"}); !ok || err == nil || !strings.Contains(err.Error(), "Demo Mode") {
		t.Fatalf("wrong task ok=%v err=%v, want Demo Mode error", ok, err)
	}
	if _, ok, err := engine.TryRespond(context.Background(), RespondInput{TaskID: "demo-task", QuestionID: "demo-confirm-outline", OptionID: "confirm"}); !ok || err == nil || !strings.Contains(err.Error(), "Demo Mode") {
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
	for _, questionID := range demoConfirmationIDs() {
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
	slideCount := 0
	for _, file := range reader.File {
		names[file.Name] = true
		if strings.HasPrefix(file.Name, "ppt/slides/slide") && strings.HasSuffix(file.Name, ".xml") {
			slideCount++
		}
	}
	for _, name := range []string{"[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide6.xml"} {
		if !names[name] {
			t.Fatalf("pptx missing %s", name)
		}
	}
	for _, name := range []string{"docProps/app.xml", "docProps/core.xml", "ppt/presProps.xml"} {
		if !names[name] {
			t.Fatalf("pptx missing %s; demo artifact should be a real polished PPTX package, not a handcrafted minimal package", name)
		}
	}
	if slideCount != 9 {
		t.Fatalf("demo artifact slide count = %d; want exactly 9 polished demo slides", slideCount)
	}
	slide1XML := readZipFile(t, &reader.Reader, "ppt/slides/slide1.xml")
	slide6XML := readZipFile(t, &reader.Reader, "ppt/slides/slide6.xml")
	slide9XML := readZipFile(t, &reader.Reader, "ppt/slides/slide9.xml")
	for _, assertion := range []struct {
		name   string
		xml    string
		needle string
	}{
		{name: "slide 1", xml: slide1XML, needle: "OfficeDex turns prompts"},
		{name: "slide 6", xml: slide6XML, needle: "90-DAY LAUNCH TIMELINE"},
		{name: "slide 6", xml: slide6XML, needle: "Turn launch proof into a repeatable funnel"},
		{name: "slide 9", xml: slide9XML, needle: "Download OfficeDex"},
	} {
		if !strings.Contains(assertion.xml, assertion.needle) {
			t.Fatalf("%s missing %q", assertion.name, assertion.needle)
		}
	}
	if len(demoSlides) != 9 {
		t.Fatalf("len(demoSlides) = %d, want 9", len(demoSlides))
	}
	if title := slideTitle(demoSlides[5]); title != "90-Day Launch Timeline" {
		t.Fatalf("slide 6 title = %q, want 90-Day Launch Timeline", title)
	}
}

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

func TestDemoTimelineVisualEditUsesActualTimelineVisuals(t *testing.T) {
	elements := demoTimelineVisualSlide["elements"].([]map[string]any)
	shapeCount := 0
	longPhaseText := ""
	visualIDs := map[string]bool{}
	for _, element := range elements {
		id, _ := element["id"].(string)
		visualIDs[id] = true
		if element["type"] == "shape" {
			shapeCount++
		}
		if id == "phase-card-1" || id == "phase-card-2" || id == "phase-card-3" {
			if text, ok := element["text"].(map[string]any); ok {
				if content, _ := text["content"].(string); len(content) > len(longPhaseText) {
					longPhaseText = content
				}
			}
		}
	}
	if shapeCount < 10 {
		t.Fatalf("visual timeline shape count = %d, want at least 10 cards, markers, and axis shapes", shapeCount)
	}
	for _, id := range []string{
		"timeline-axis",
		"phase-card-1",
		"phase-card-2",
		"phase-card-3",
		"milestone-dot-1",
		"milestone-dot-2",
		"milestone-dot-3",
		"launch-marker",
	} {
		if !visualIDs[id] {
			t.Fatalf("visual timeline missing element %q", id)
		}
	}
	if longPhaseText != "" {
		t.Fatalf("visual timeline phase cards should use separate short labels, found nested text %q", longPhaseText)
	}
	for _, id := range []string{
		"phase-icon-1",
		"phase-icon-2",
		"phase-icon-3",
		"phase-metric-1",
		"phase-metric-2",
		"phase-metric-3",
		"launch-flag-label",
	} {
		if !visualIDs[id] {
			t.Fatalf("visual timeline missing short visual label %q", id)
		}
	}
	for _, element := range elements {
		id, _ := element["id"].(string)
		width, _ := element["width"].(int)
		switch id {
		case "phase-icon-label-1", "phase-icon-label-2", "phase-icon-label-3":
			if width < 60 {
				t.Fatalf("%s width = %d, want at least 60 to prevent digit wrapping", id, width)
			}
		case "phase-chip-1", "phase-chip-2", "phase-chip-3":
			if width < 110 {
				t.Fatalf("%s width = %d, want at least 110 to prevent percentage wrapping", id, width)
			}
		}
	}
}

type memoryRecorder struct {
	t            *testing.T
	mu           sync.Mutex
	events       []types.BridgeEvent
	artifacts    []types.Artifact
	userDataDir  string
	workspaceDir string
}

func newMemoryRecorder(t *testing.T) *memoryRecorder {
	t.Helper()
	root := t.TempDir()
	userDataDir := filepath.Join(root, "user-data")
	workspaceDir := filepath.Join(root, "workspace")
	if err := os.MkdirAll(userDataDir, 0o755); err != nil {
		t.Fatalf("mkdir user data dir: %v", err)
	}
	if err := os.MkdirAll(workspaceDir, 0o755); err != nil {
		t.Fatalf("mkdir workspace dir: %v", err)
	}
	return &memoryRecorder{t: t, userDataDir: userDataDir, workspaceDir: workspaceDir}
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

func (r *memoryRecorder) AllowArtifact(types.Artifact) error { return nil }
func (r *memoryRecorder) RecordArtifact(artifact types.Artifact) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.artifacts = append(r.artifacts, artifact)
	return nil
}
func (r *memoryRecorder) lastArtifact() *types.Artifact {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.artifacts) == 0 {
		return nil
	}
	artifact := r.artifacts[len(r.artifacts)-1]
	return &artifact
}
func (r *memoryRecorder) UserDataDir() string  { return r.userDataDir }
func (r *memoryRecorder) WorkspaceDir() string { return r.workspaceDir }

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

func demoPayloadNodeKinds(t *testing.T, payload map[string]any) map[string]int {
	t.Helper()
	tree, ok := payload["tree"].(map[string]any)
	if !ok {
		t.Fatalf("payload tree = %#v, want map", payload["tree"])
	}
	rawNodes, ok := tree["nodes"].([]map[string]any)
	if !ok {
		t.Fatalf("tree nodes = %#v, want []map[string]any", tree["nodes"])
	}
	kinds := map[string]int{}
	for _, node := range rawNodes {
		kind, _ := node["kind"].(string)
		kinds[kind]++
	}
	return kinds
}

func demoConfirmationIDs() []string {
	return []string{"demo-confirm-story", "demo-confirm-outline", "demo-confirm-slides"}
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

func readZipFile(t *testing.T, reader *zip.Reader, name string) string {
	t.Helper()
	for _, file := range reader.File {
		if file.Name != name {
			continue
		}
		rc, err := file.Open()
		if err != nil {
			t.Fatalf("open %s: %v", name, err)
		}
		defer rc.Close()
		body, err := io.ReadAll(rc)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		return string(body)
	}
	t.Fatalf("zip missing %s", name)
	return ""
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
