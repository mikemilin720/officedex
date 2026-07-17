# Vibe Stage Task Card Native Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the active Vibe progress step open its current-task card through a native, application-controlled button click in packaged OfficeDex builds.

**Architecture:** `VibeProgressSteps` will own the click boundary instead of relying on Ant Design to clone a non-interactive child and inject a trigger. The Popover remains controlled by the existing `manualOpen || autoOpenTaskCard` state, while a narrow CSS reset preserves the current visuals.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Testing Library, Vitest, Wails v2

---

## File Map

- Modify `src/renderer/screens/DialogueScreens.test.tsx`: require a native active-stage button and verify its DOM click opens the task card.
- Modify `src/renderer/screens/DialogueScreens.tsx`: render the active stage as an explicit button and make the Popover state application-controlled.
- Modify `src/renderer/styles/dialogue.css`: reset native button presentation without changing existing progress-step visuals.

### Task 1: Add the native-click renderer regression

**Files:**
- Modify: `src/renderer/screens/DialogueScreens.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a focused test near the other Vibe task-card tests. Build a `story_ready`
question task with one pending branch, render it, and require the active stage to
be discoverable as a button:

```tsx
it("opens the Vibe task card through a native active-stage button click", async () => {
  const task: DesktopTask = {
    id: "task-vibe-native-stage-click",
    conversationId: "task-vibe-native-stage-click",
    status: "question",
    documentType: "pptx",
    events: [],
    question: {
      id: "vibe_story_ready",
      question: "Project Map generated.",
      allowFreeform: true,
      options: [{ id: "generate_chapters", label: "Generate Chapters", recommended: true }],
    },
    vibeTree: {
      stage: "story_ready",
      tree: {
        id: "tree-native-stage-click",
        rootId: "root",
        title: "Native Stage Click",
        nodes: [
          { id: "root", kind: "root", title: "Native Stage Click", status: "story_ready" },
          { id: "branch-a", parentId: "root", kind: "branch", title: "Current State", status: "story_ready" },
        ],
      },
      actions: [{ id: "generate_chapters", label: "Generate Chapters" }],
      confirmation: { nodeIds: ["branch-a"] },
    },
  };

  render(<DialogueScreen {...baseProps()} tasks={[task]} />);

  const trigger = screen.getByRole("button", { name: "Open Story Beat task" });
  expect(screen.queryByLabelText("Current Task")).toBeNull();
  trigger.click();
  await waitFor(() => expect(screen.getByLabelText("Current Task")).toBeTruthy());
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/renderer/screens/DialogueScreens.test.tsx -t "opens the Vibe task card through a native active-stage button click"
```

Expected: FAIL because the active Story Beat step is currently a `div`, so no
button with the accessible name `Open Story Beat task` exists.

### Task 2: Implement the explicit native trigger

**Files:**
- Modify: `src/renderer/screens/DialogueScreens.tsx`
- Modify: `src/renderer/styles/dialogue.css`

- [ ] **Step 1: Render the active step as a button**

In `VibeProgressSteps`, keep the existing `div` for inactive steps. For the active
step with `taskCard`, render this controlled trigger:

```tsx
const activeStepButton = (
  <button
    key={step.key}
    type="button"
    className="living-tree-step is-active"
    data-step-key={step.key}
    data-step-index={index}
    data-step-state="active"
    aria-label={`Open ${step.label} task`}
    aria-expanded={popoverOpen}
    onClick={() => setManualOpen((current) => !current)}
  >
    <span>{index + 1}</span>
    <strong>{step.label}</strong>
  </button>
);
```

Wrap it with the controlled Popover and disable library-owned triggers:

```tsx
<Popover
  key={step.key}
  content={taskCard}
  open={popoverOpen}
  trigger={[]}
  placement="bottom"
  overlayClassName="living-tree-step-popover"
  arrow={{ pointAtCenter: true }}
  forceRender
>
  {activeStepButton}
</Popover>
```

Remove `onOpenChange={setManualOpen}` because the native button is now the only
manual trigger owner.

- [ ] **Step 2: Reset native button presentation**

Add these properties to `.living-tree-step` in `src/renderer/styles/dialogue.css`:

```css
  border: 0;
  background: transparent;
  appearance: none;
  font-family: inherit;
  text-align: left;
```

The selector also applies harmlessly to inactive `div` steps and prevents native
button chrome from altering the existing layout.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/screens/DialogueScreens.test.tsx -t "opens the Vibe task card through a native active-stage button click"
```

Expected: PASS with one matching native button and a visible `Current Task` card
after `HTMLElement.click()`.

- [ ] **Step 4: Commit the isolated behavior fix**

```bash
git add src/renderer/screens/DialogueScreens.tsx src/renderer/screens/DialogueScreens.test.tsx src/renderer/styles/dialogue.css
git diff --cached --check
git commit -m "fix: use native Vibe stage task trigger"
```

### Task 3: Verify regression safety and production packaging

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run the complete Living Tree renderer suite**

```bash
npx vitest run src/renderer/screens/DialogueScreens.test.tsx
```

Expected: zero failed tests, including task-card automatic opening, confirmations,
stage actions, and completed Canvas behavior.

- [ ] **Step 2: Run TypeScript validation**

```bash
npm run lint
```

Expected: `tsc --noEmit` exits zero.

- [ ] **Step 3: Run the full Vitest suite**

```bash
npm test
```

Expected: zero failed tests.

- [ ] **Step 4: Build the normal packaged application path**

Use the required local proxy for npm/runtime downloads:

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm run build
```

Expected: Wails production build exits zero and bundles the fetched OfficeCLI
runtime through the non-demo build path.

- [ ] **Step 5: Inspect the final branch state**

```bash
git diff --check
git status --short
git log -5 --oneline
```

Expected: no uncommitted source changes and the native-trigger fix appears after
the design/plan commits.
