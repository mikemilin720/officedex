//go:build officedex_demo

package demoflow

import "strconv"

const magicPrompt = "Create a launch strategy presentation for a new AI productivity app. Define the target audience, positioning, launch channels, a 90-day rollout plan, and success metrics. Make it clear, visual, and suitable for an executive review."
const timelineEditPrompt = "Make this launch timeline more visual."

var demoStages = []struct {
	ID    string
	Label string
}{
	{"idea", "Idea"},
	{"story", "Story Beats"},
	{"chapters", "Chapters"},
	{"outline", "Slide Outlines"},
	{"build", "Build PPTX"},
	{"review", "Review"},
}

var demoSlides = []map[string]any{
	demoTitleSlide("demo-slide-01", "Launch Strategy", "New AI Productivity App"),
	demoBulletsSlide("demo-slide-02", "Executive Summary", []string{"Position around trusted execution", "Launch in focused professional channels", "Measure activation, retention, and team adoption"}),
	demoBulletsSlide("demo-slide-03", "Target Audience", []string{"Operators building recurring decks", "Founders preparing investor and launch materials", "Marketing teams turning briefs into presentations"}),
	demoBulletsSlide("demo-slide-04", "Positioning", []string{"From prompt to reviewable presentation workflow", "Visible planning before slide creation", "Editable output with AI-assisted refinement"}),
	demoBulletsSlide("demo-slide-05", "Launch Channels", []string{"Website launch page", "X product demo thread", "Creator and productivity communities", "Template-led onboarding campaigns"}),
	demoTimelineSlide("demo-slide-06", false),
	demoBulletsSlide("demo-slide-07", "Success Metrics", []string{"Activation: first PPTX created", "Quality: preview opened and edited", "Growth: referral and social conversion", "Revenue: paid upgrade intent"}),
	demoBulletsSlide("demo-slide-08", "Risks and Mitigations", []string{"Slow generation: deterministic staged feedback", "Unclear output quality: preview-first review", "Trust gap: transparent confirmations"}),
	demoBulletsSlide("demo-slide-09", "Next Steps", []string{"Record launch video", "Ship demo build", "Prepare website and X assets", "Open download funnel"}),
}

var demoTimelineVisualSlide = demoTimelineSlide("demo-slide-06", true)

func demoTitleSlide(id, title, subtitle string) map[string]any {
	return map[string]any{
		"id":         id,
		"background": map[string]any{"type": "solid", "color": "#FCFAF2"},
		"elements": []map[string]any{
			{"id": "title", "type": "text", "left": 72, "top": 92, "width": 780, "height": 88, "content": "<p>" + title + "</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"},
			{"id": "subtitle", "type": "text", "left": 76, "top": 205, "width": 720, "height": 52, "content": "<p>" + subtitle + "</p>", "defaultFontName": "Inter", "defaultColor": "#1A2530"},
		},
	}
}

func demoBulletsSlide(id, title string, bullets []string) map[string]any {
	elements := []map[string]any{{"id": "title", "type": "text", "left": 64, "top": 48, "width": 820, "height": 60, "content": "<p>" + title + "</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"}}
	for i, bullet := range bullets {
		elements = append(elements, map[string]any{
			"id": "bullet-" + strconv.Itoa(i+1), "type": "text",
			"left": 92, "top": 150 + i*82, "width": 760, "height": 54,
			"content": bulletText(bullet), "defaultFontName": "Inter", "defaultColor": "#1A2530",
		})
	}
	return map[string]any{"id": id, "background": map[string]any{"type": "solid", "color": "#FCFAF2"}, "elements": elements}
}

func demoTimelineSlide(id string, visual bool) map[string]any {
	elements := []map[string]any{{"id": "title", "type": "text", "left": 64, "top": 48, "width": 820, "height": 60, "content": "<p>90-Day Launch Timeline</p>", "defaultFontName": "Inter", "defaultColor": "#05101A"}}
	labels := []string{"Days 1-30: Validate", "Days 31-60: Launch", "Days 61-90: Scale"}
	for i, label := range labels {
		elements = append(elements, map[string]any{
			"id": "phase-" + strconv.Itoa(i+1), "type": "text",
			"left": 80 + i*285, "top": 190, "width": 230, "height": 86,
			"content": bulletText(label), "defaultFontName": "Inter", "defaultColor": "#1A2530",
		})
	}
	if visual {
		elements = append(elements, map[string]any{"id": "timeline-accent", "type": "shape", "left": 72, "top": 310, "width": 780, "height": 12, "viewBox": []int{0, 0}, "path": "M 0 0 L 780 0", "fill": "#006876"})
	}
	return map[string]any{"id": id, "background": map[string]any{"type": "solid", "color": "#FCFAF2"}, "elements": elements}
}

func bulletText(text string) string {
	return "<p>" + text + "</p>"
}

func demoTreePayload(idx int) map[string]any {
	stage := demoStages[min(idx, len(demoStages)-1)]
	return map[string]any{
		"stage":       stage.ID,
		"stage_id":    stage.ID,
		"stage_label": stage.Label,
		"tree": map[string]any{
			"id":     "demo-tree",
			"rootId": "root",
			"title":  "Launch Strategy",
			"nodes": []map[string]any{{
				"id":      "root",
				"title":   "Launch Strategy",
				"summary": "Deterministic demo node",
				"kind":    "idea",
				"status":  "done",
			}},
		},
	}
}
