//go:build officedex_demo

package demoflow

import (
	"archive/zip"
	"context"
	"io"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
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
		"task.vibe_tree",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.question",
		"task.answers",
		"task.vibe_tree",
		"task.question",
		"task.answers",
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
		if tc.idx < len(demoQuestions) {
			actions, _ := payload["actions"].([]map[string]any)
			if len(actions) != 1 || actions[0]["id"] != "confirm" || actions[0]["label"] != "Approve "+demoQuestions[tc.idx].Label {
				t.Fatalf("demoTreePayload(%d) actions = %#v, want one explicit stage approval action", tc.idx, actions)
			}
		}
	}
	slideKinds := demoPayloadNodeKinds(t, demoTreePayload(2))
	if slideKinds["generated_slide"] != len(demoSlides) {
		t.Fatalf("slides_ready generated slides = %d, want %d", slideKinds["generated_slide"], len(demoSlides))
	}
}

func TestDemoVibeTreeUsesOneRepresentativeConfirmationPerStage(t *testing.T) {
	want := [][]string{
		{"chapter-02"},
		{"outline-6"},
		{"slide-6"},
	}
	for idx, wantNodeIDs := range want {
		payload := demoTreePayload(idx)
		confirmation, _ := payload["confirmation"].(map[string]any)
		nodeIDs, _ := confirmation["nodeIds"].([]string)
		if !reflect.DeepEqual(nodeIDs, wantNodeIDs) {
			t.Fatalf("demoTreePayload(%d) confirmation nodeIds = %#v, want %#v", idx, nodeIDs, wantNodeIDs)
		}
		tree, _ := payload["tree"].(map[string]any)
		nodes, _ := tree["nodes"].([]map[string]any)
		for _, nodeID := range nodeIDs {
			found := false
			for _, node := range nodes {
				if node["id"] == nodeID {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("demoTreePayload(%d) confirmation node %q is not present in the tree", idx, nodeID)
			}
		}
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
	timelineSlide := demoTimelineSnapshotSlideForTest()
	snapshot := PptistDeckSnapshot{
		SlideIndex: 5,
		Slides: []PptistSlide{
			{ID: "s1"}, {ID: "s2"}, {ID: "s3"}, {ID: "s4"}, {ID: "s5"}, timelineSlide, {ID: "s7"}, {ID: "s8"}, {ID: "s9"},
		},
	}
	result, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: "Turn this launch timeline into a vertical roadmap.", Snapshot: snapshot})
	if err != nil || !ok {
		t.Fatalf("TryModifyPptistDeck ok=%v err=%v", ok, err)
	}
	if !result.RequiresConfirmation || len(result.Ops) != 1 {
		t.Fatalf("result = %#v, want confirmation with one source-preserving slide update", result)
	}
	op := result.Ops[0]
	if op["type"] != "slide:update" || op["slideId"] != "demo-slide-06" || op["slideIndex"] != 5 {
		t.Fatalf("op = %#v, want one update against the live imported slide 6", op)
	}
	if op["type"] == "slide:replace" {
		t.Fatalf("timeline edit must preserve the imported slide instead of replacing it: %#v", op)
	}

	wrongPrompt, ok, err := engine.TryModifyPptistDeck(context.Background(), ModifyPptistDeckInput{Prompt: "Make this launch timeline more visual.", Snapshot: snapshot})
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

func TestDemoTimelineEditBuildsAlignedVerticalRoadmap(t *testing.T) {
	target := demoTimelineSnapshotSlideForTest()
	ops, err := demoTimelineEditOps(target, 5)
	if err != nil {
		t.Fatalf("demoTimelineEditOps: %v", err)
	}
	if len(ops) != 1 {
		t.Fatalf("len(ops) = %d, want one source-preserving update", len(ops))
	}
	op := ops[0]
	if op["type"] != "slide:update" {
		t.Fatalf("op = %#v, want slide:update", op)
	}
	props, _ := op["props"].(map[string]any)
	elements, _ := props["elements"].([]map[string]any)
	if len(elements) != len(target.Elements)+6 {
		t.Fatalf("len(elements) = %d, want all %d imported elements plus 3 vertical segments and 3 rings", len(elements), len(target.Elements))
	}
	byID := map[string]map[string]any{}
	for _, element := range elements {
		id, _ := element["id"].(string)
		byID[id] = element
	}
	for _, id := range []string{"eyebrow", "hero-title", "footer", "page"} {
		if !reflect.DeepEqual(byID[id], timelineElementByID(target.Elements, id)) {
			t.Fatalf("non-timeline element %q changed: before=%#v after=%#v", id, timelineElementByID(target.Elements, id), byID[id])
		}
	}
	copyText := byID["hero-copy"]["text"].(map[string]any)["content"].(string)
	if !strings.Contains(copyText, "Validate demand. Build proof. Scale what converts.") {
		t.Fatalf("subtitle content = %q, want audience-facing copy", copyText)
	}

	axis := byID["timeline-axis"]
	if axis["left"] != 203.0 || axis["top"] != 331.0 || axis["width"] != 4.0 || axis["height"] != 220.0 {
		t.Fatalf("vertical axis bounds = %#v, want x=203 y=331 w=4 h=220", axis)
	}
	for i := 0; i < 3; i++ {
		segment := byID["demo-timeline-segment-"+strconv.Itoa(i+1)]
		if segment["left"] != 203.0 || segment["width"] != 4.0 {
			t.Fatalf("segment %d bounds = %#v, want exact vertical alignment with the axis", i+1, segment)
		}
		ring := byID["demo-timeline-ring-"+strconv.Itoa(i+1)]
		node := byID["timeline-node-"+strconv.Itoa(i+1)]
		if ring["left"] != node["left"].(float64)-6 || ring["top"] != node["top"].(float64)-6 || ring["width"] != node["width"].(float64)+12 || ring["height"] != node["height"].(float64)+12 {
			t.Fatalf("ring %d bounds = %#v, want a centered 6px halo around node %#v", i+1, ring, node)
		}
		day := byID["timeline-day-"+strconv.Itoa(i+1)]
		nodeCenterX := node["left"].(float64) + node["width"].(float64)/2
		dayCenterX := day["left"].(float64) + day["width"].(float64)/2
		if nodeCenterX != 205.0 || math.Abs(dayCenterX-nodeCenterX) > 0.01 {
			t.Fatalf("row %d node/day centers = %.2f/%.2f, want aligned on vertical axis x=205", i+1, nodeCenterX, dayCenterX)
		}
		title := byID["timeline-title-"+strconv.Itoa(i+1)]
		body := byID["timeline-copy-"+strconv.Itoa(i+1)]
		if title["left"] != 270.0 || body["left"] != 270.0 || body["top"].(float64)-title["top"].(float64) != 36 {
			t.Fatalf("row %d text bounds title=%#v body=%#v, want a stacked right-hand text column", i+1, title, body)
		}
	}
	if byID["timeline-node-2"]["top"].(float64)-byID["timeline-node-1"]["top"].(float64) != 110 || byID["timeline-node-3"]["top"].(float64)-byID["timeline-node-2"]["top"].(float64) != 110 {
		t.Fatalf("vertical milestone rows are not evenly spaced: %#v %#v %#v", byID["timeline-node-1"], byID["timeline-node-2"], byID["timeline-node-3"])
	}
}

func demoTimelineSnapshotSlideForTest() PptistSlide {
	return PptistSlide{
		ID:         "demo-slide-06",
		Background: map[string]any{"type": "solid", "color": "#05101A"},
		Elements: []map[string]any{
			{"id": "eyebrow", "type": "shape", "left": 72.0, "top": 48.0, "width": 420.0, "height": 24.0, "text": map[string]any{"content": "<p>90-DAY LAUNCH TIMELINE</p>"}},
			{"id": "hero-title", "type": "shape", "left": 72.0, "top": 82.0, "width": 790.0, "height": 108.0, "text": map[string]any{"content": "<p>Turn launch proof into a repeatable funnel</p>"}},
			{"id": "hero-copy", "type": "shape", "left": 74.0, "top": 192.0, "width": 720.0, "height": 54.0, "text": map[string]any{"content": "<p>This slide is intentionally visual so the demo can show a precise timeline edit.</p>"}},
			{"id": "timeline-axis", "type": "shape", "left": 150.0, "top": 416.0, "width": 980.0, "height": 4.0, "path": "axis-path", "viewBox": []any{200.0, 200.0}, "fill": "#315D62", "fixedRatio": false},
			{"id": "timeline-node-1", "type": "shape", "left": 174.0, "top": 386.0, "width": 62.0, "height": 62.0, "path": "circle-path", "viewBox": []any{200.0, 200.0}, "fill": "#1AAE39", "fixedRatio": false},
			{"id": "timeline-day-1", "type": "shape", "left": 178.0, "top": 404.0, "width": 54.0, "height": 22.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">0–30</p>"}},
			{"id": "timeline-title-1", "type": "shape", "left": 140.0, "top": 476.0, "width": 130.0, "height": 34.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">Proof</p>"}},
			{"id": "timeline-copy-1", "type": "shape", "left": 92.0, "top": 518.0, "width": 226.0, "height": 54.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">Website, video, download funnel</p>"}},
			{"id": "timeline-node-2", "type": "shape", "left": 524.0, "top": 386.0, "width": 62.0, "height": 62.0, "path": "circle-path", "viewBox": []any{200.0, 200.0}, "fill": "#006876", "fixedRatio": false},
			{"id": "timeline-day-2", "type": "shape", "left": 518.0, "top": 405.0, "width": 74.0, "height": 22.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">31–60</p>"}},
			{"id": "timeline-title-2", "type": "shape", "left": 490.0, "top": 476.0, "width": 130.0, "height": 34.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">Signal</p>"}},
			{"id": "timeline-copy-2", "type": "shape", "left": 442.0, "top": 518.0, "width": 226.0, "height": 54.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">X thread, community examples, onboarding data</p>"}},
			{"id": "timeline-node-3", "type": "shape", "left": 874.0, "top": 386.0, "width": 62.0, "height": 62.0, "path": "circle-path", "viewBox": []any{200.0, 200.0}, "fill": "#7B3FF2", "fixedRatio": false},
			{"id": "timeline-day-3", "type": "shape", "left": 874.0, "top": 406.0, "width": 62.0, "height": 16.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">61–90</p>"}},
			{"id": "timeline-title-3", "type": "shape", "left": 840.0, "top": 476.0, "width": 130.0, "height": 34.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">Scale</p>"}},
			{"id": "timeline-copy-3", "type": "shape", "left": 792.0, "top": 518.0, "width": 226.0, "height": 54.0, "text": map[string]any{"content": "<p style=\"text-align: center;\">Templates, partner content, paid conversion tests</p>"}},
			{"id": "footer", "type": "shape", "left": 72.0, "top": 668.0, "width": 280.0, "height": 22.0, "text": map[string]any{"content": "<p>OfficeDex launch demo</p>"}},
			{"id": "page", "type": "shape", "left": 1130.0, "top": 668.0, "width": 80.0, "height": 22.0, "text": map[string]any{"content": "<p>06/09</p>"}},
		},
	}
}

func timelineElementByID(elements []map[string]any, id string) map[string]any {
	for _, element := range elements {
		if element["id"] == id {
			return element
		}
	}
	return nil
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
