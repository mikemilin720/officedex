//go:build officedex_demo

package demoflow

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
