package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"officedex/internal/bridge"
)

type fakePptistPlanner struct {
	input  bridge.PlanPptistEditInput
	result bridge.PlanPptistEditResult
	err    error
	calls  int
}

func (f *fakePptistPlanner) PlanPptistEdit(_ context.Context, input bridge.PlanPptistEditInput) (bridge.PlanPptistEditResult, error) {
	f.calls++
	f.input = input
	return f.result, f.err
}

func TestModifyPptistDeckAppliesExplicitSlideTitleEditWithoutPlannerConfirmation(t *testing.T) {
	planner := &fakePptistPlanner{err: errors.New("planner should not be called")}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	result, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "将第二页的标题改为“咩咩咩”",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{
				{ID: "slide-1", Elements: []map[string]any{{"id": "title-1", "type": "text", "content": "<p>第一页标题</p>", "left": 80, "top": 80, "width": 600, "height": 60, "defaultFontSize": 34}}},
				{ID: "slide-2", Elements: []map[string]any{
					{"id": "body-2", "type": "text", "content": "<p>正文内容</p>", "left": 70, "top": 210, "width": 560, "height": 180, "defaultFontSize": 18},
					{"id": "title-2", "type": "text", "content": "<p>什么是石墨文档</p>", "left": 70, "top": 60, "width": 600, "height": 70, "defaultFontSize": 36},
				}},
			},
			SlideIndex: 1,
		},
		SelectedSlideID: "slide-2",
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	if planner.calls != 0 {
		t.Fatalf("planner calls = %d, want 0", planner.calls)
	}
	if result.RequiresConfirmation || result.Confidence != "high" {
		t.Fatalf("result should be high confidence without confirmation: %+v", result)
	}
	if len(result.Ops) != 1 {
		t.Fatalf("ops = %d, want 1", len(result.Ops))
	}
	op := result.Ops[0]
	if op["type"] != "element:update-text" || op["slideId"] != "slide-2" || op["elementId"] != "title-2" || op["text"] != "咩咩咩" || op["preserveStyle"] != true {
		t.Fatalf("unexpected title edit op: %#v", op)
	}
}

func TestModifyPptistDeckFallsBackWhenPlannerReturnsNoOperations(t *testing.T) {
	planner := &fakePptistPlanner{err: errors.New("pptist plan edit: no edit operations returned")}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	result, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "把第一页标题改得更现代",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{
				ID: "slide-1",
				Elements: []map[string]any{
					{"id": "title-1", "type": "text", "content": `<p><span style="color:#f00;font-family:Inter">Original</span></p>`},
				},
			}},
			SlideIndex: 0,
		},
		SelectedSlideID: "slide-1",
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	if len(result.Ops) != 1 {
		t.Fatalf("ops = %d, want 1", len(result.Ops))
	}
	op := result.Ops[0]
	if op["type"] != "element:update-text" || op["elementId"] != "title-1" || op["text"] != "把第一页标题改得更现代" || op["preserveStyle"] != true {
		t.Fatalf("unexpected fallback op: %#v", op)
	}
	if result.Confidence != "low" || !result.RequiresConfirmation {
		t.Fatalf("fallback should require confirmation: %+v", result)
	}
}

func TestModifyPptistDeckUsesBridgePlannerAndPreservesIntentText(t *testing.T) {
	planner := &fakePptistPlanner{
		result: bridge.PlanPptistEditResult{
			Summary:              "Updated slide 1 title.",
			Confidence:           "high",
			RequiresConfirmation: false,
			Ops: []map[string]any{{
				"type":          "element:update-text",
				"slideId":       "slide-1",
				"elementId":     "title-1",
				"text":          "石墨文档介绍123",
				"preserveStyle": true,
			}},
		},
	}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	result, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "请让当前页面表达更现代，保留原有视觉样式",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{
				ID: "slide-1",
				Elements: []map[string]any{
					{"id": "title-1", "type": "text", "content": `<p><span style="color:#f00;font-family:Inter">Original</span></p>`},
				},
			}},
			SlideIndex: 0,
		},
		SelectedSlideID: "slide-1",
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	if planner.input.Tool != "office.pptist.plan_edit" {
		t.Fatalf("planner tool = %q", planner.input.Tool)
	}
	if planner.input.Prompt != "请让当前页面表达更现代，保留原有视觉样式" {
		t.Fatalf("planner prompt = %q", planner.input.Prompt)
	}
	if planner.input.SelectedSlideID != "slide-1" {
		t.Fatalf("selected slide = %q", planner.input.SelectedSlideID)
	}
	if len(result.Ops) != 1 {
		t.Fatalf("ops = %d, want 1", len(result.Ops))
	}
	op := result.Ops[0]
	if op["type"] != "element:update-text" || op["text"] != "石墨文档介绍123" || op["preserveStyle"] != true {
		t.Fatalf("unexpected op: %#v", op)
	}
	if strings.Contains(op["text"].(string), "字体") || strings.Contains(op["text"].(string), "颜色") {
		t.Fatalf("constraint leaked into replacement text: %#v", op["text"])
	}
}

func TestModifyPptistDeckPassesCurrentPptxToPlanner(t *testing.T) {
	planner := &fakePptistPlanner{
		result: bridge.PlanPptistEditResult{
			Summary:              "Updated slide.",
			Confidence:           "high",
			RequiresConfirmation: false,
			Ops: []map[string]any{{
				"type":          "element:update-text",
				"slideId":       "slide-1",
				"elementId":     "title-1",
				"text":          "Updated",
				"preserveStyle": true,
			}},
		},
	}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	_, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt:         "改标题",
		PptxDataBase64: "UEsDBA==",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{ID: "slide-1", Elements: []map[string]any{{"id": "title-1", "type": "text", "content": "<p>Original</p>"}}}},
		},
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	if planner.input.PptxDataBase64 != "UEsDBA==" {
		t.Fatalf("PptxDataBase64 = %q, want forwarded PPTX bytes", planner.input.PptxDataBase64)
	}
}

func TestModifyPptistDeckCompactsHugeSnapshotBeforePlanning(t *testing.T) {
	planner := &fakePptistPlanner{
		result: bridge.PlanPptistEditResult{
			Summary: "Updated slide.",
			Ops:     []map[string]any{{"type": "element:update-text", "slideId": "slide-1", "elementId": "title-1", "text": "Updated"}},
		},
	}
	hugeDataURL := "data:image/png;base64," + strings.Repeat("a", 12*1024*1024)
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	_, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "把第一页标题改得更现代",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{
				ID: "slide-1",
				Elements: []map[string]any{
					{"id": "title-1", "type": "text", "content": "<p>Original title</p>", "style": map[string]any{"fontSize": 32}},
					{"id": "hero-image", "type": "image", "src": hugeDataURL, "left": 20, "top": 30, "width": 640, "height": 360},
				},
				Background: map[string]any{"image": hugeDataURL, "color": "#ffffff"},
			}},
			SlideIndex: 0,
		},
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	raw, err := json.Marshal(planner.input.Snapshot)
	if err != nil {
		t.Fatalf("marshal planner snapshot: %v", err)
	}
	if len(raw) > 64*1024 {
		t.Fatalf("planner snapshot is too large: %d bytes", len(raw))
	}
	if strings.Contains(string(raw), hugeDataURL) || strings.Contains(string(raw), strings.Repeat("a", 1024)) {
		t.Fatalf("planner snapshot still contains raw image data")
	}
	if !strings.Contains(string(raw), "Original title") {
		t.Fatalf("planner snapshot lost editable text context: %s", raw)
	}
	if !strings.Contains(string(raw), "hero-image") || !strings.Contains(string(raw), "image omitted") {
		t.Fatalf("planner snapshot lost image identity placeholder: %s", raw)
	}
}

func TestModifyPptistDeckReturnsConfirmationMetadata(t *testing.T) {
	planner := &fakePptistPlanner{
		result: bridge.PlanPptistEditResult{
			Summary:              "Needs review.",
			Confidence:           "low",
			RequiresConfirmation: true,
			Confirmation: &bridge.PlanPptistEditConfirmation{
				Title:     "Confirm AI edit",
				Message:   "Update title.",
				Target:    "Slide 1 title",
				Changes:   []string{"Set text to void"},
				Preserved: []string{"Font", "Color"},
			},
			Ops: []map[string]any{{"type": "element:update-text", "slideId": "slide-1", "elementId": "title-1", "text": "void", "preserveStyle": true}},
		},
	}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	result, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "改标题",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{ID: "slide-1", Elements: []map[string]any{{"id": "title-1", "type": "text", "content": "<p>Original</p>"}}}},
		},
	})
	if err != nil {
		t.Fatalf("ModifyPptistDeck: %v", err)
	}
	if !result.RequiresConfirmation || result.Confidence != "low" {
		t.Fatalf("confirmation flags not preserved: %+v", result)
	}
	if result.Confirmation == nil || result.Confirmation.Target != "Slide 1 title" || len(result.Confirmation.Preserved) != 2 {
		t.Fatalf("confirmation metadata = %+v", result.Confirmation)
	}
}

func TestModifyPptistDeckRejectsPlannerOpsOutsideSelectedElements(t *testing.T) {
	planner := &fakePptistPlanner{
		result: bridge.PlanPptistEditResult{
			Summary:              "Updated the wrong element.",
			Confidence:           "high",
			RequiresConfirmation: false,
			Ops: []map[string]any{{
				"type":      "element:update",
				"slideId":   "slide-1",
				"elementId": "other-shape",
				"props":     map[string]any{"fill": "#00aa66"},
			}},
		},
	}
	app := &App{ctx: context.Background(), pptistPlanner: planner}
	_, err := app.ModifyPptistDeck(ModifyPptistDeckInput{
		Prompt: "把这个形状改成绿色",
		Snapshot: PptistDeckSnapshot{
			Slides: []PptistSlide{{
				ID: "slide-1",
				Elements: []map[string]any{
					{"id": "shape-1", "type": "shape", "fill": "#111111"},
					{"id": "other-shape", "type": "shape", "fill": "#222222"},
				},
			}},
			SlideIndex: 0,
		},
		SelectedSlideID:    "slide-1",
		SelectedElementIDs: []string{"shape-1"},
	})
	if err == nil || !strings.Contains(err.Error(), "planner returned op outside selected elements") {
		t.Fatalf("error = %v, want selected element validation", err)
	}
}
