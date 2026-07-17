# OfficeDex Anchored Overlay Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the sidebar toggle Tooltip and Living Tree node confirmation Popover from remaining at stale coordinates after their anchors move.

**Architecture:** Control the sidebar toggle Tooltip so the layout-changing click closes the old hover overlay. Add a focused `ViewportAnchoredPopover` wrapper that exposes the open Popover's `forceAlign()` callback to `LivingTreeCockpit`; React Flow's `onMove` calls that ref directly without introducing viewport state or canvas-wide rerenders.

**Tech Stack:** React 19, TypeScript, Ant Design 6, React Flow 12, Vitest, Testing Library

---

## File Map

- Modify `src/renderer/components/Shell.tsx`: control top-bar Tooltip visibility.
- Modify `src/renderer/components/Shell.test.tsx`: cover closing the Tooltip on collapse and expand.
- Create `src/renderer/components/ViewportAnchoredPopover.tsx`: register and unregister the open Popover's alignment callback.
- Create `src/renderer/components/ViewportAnchoredPopover.test.tsx`: test open and closed alignment behavior.
- Modify `src/renderer/screens/DialogueScreens.tsx`: publish React Flow viewport revisions to node Popovers.

### Task 1: Close the sidebar toggle Tooltip when layout changes

**Files:**
- Modify: `src/renderer/components/Shell.test.tsx`
- Modify: `src/renderer/components/Shell.tsx`

- [ ] **Step 1: Write the failing sidebar Tooltip regression test**

Add `waitFor` to the Testing Library import. Make the existing `uses the topbar as the only sidebar control and reveals the hidden sidebar from the left edge` test async, then open the Tooltip before clicking and require it to be gone afterward:

```tsx
fireEvent.mouseEnter(toggle);
await screen.findByText("Collapse sidebar");
fireEvent.click(toggle);
await waitFor(() => {
  expect(document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)")).toBeNull();
});
```

Then verify the expand direction with the same explicit sequence:

```tsx
const expandToggle = screen.getByRole("button", { name: /expand sidebar/i });
fireEvent.mouseEnter(expandToggle);
await screen.findByText("Expand sidebar");
fireEvent.click(expandToggle);
await waitFor(() => {
  expect(document.querySelector(".ant-tooltip:not(.ant-tooltip-hidden)")).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/renderer/components/Shell.test.tsx -t "uses the topbar as the only sidebar control"
```

Expected: FAIL because the uncontrolled Tooltip remains open while the button moves.

- [ ] **Step 3: Implement controlled Tooltip visibility**

Add state in `Shell`:

```tsx
const [sidebarToggleTooltipOpen, setSidebarToggleTooltipOpen] = useState(false);
```

Control only the top-bar Tooltip and close it before layout state changes:

```tsx
<Tooltip
  title={sidebarToggleLabel}
  placement="bottom"
  open={sidebarToggleTooltipOpen}
  onOpenChange={setSidebarToggleTooltipOpen}
  destroyOnHidden
>
  <button
    type="button"
    className={`topbar-sidebar-toggle ${collapsed ? "is-collapsed" : "is-expanded"} ${sidebarPreview ? "is-previewing" : ""}`}
    data-sidebar-icon-state={collapsed ? (sidebarPreview ? "preview" : "hidden") : "expanded"}
    aria-label={sidebarToggleLabel}
    onClick={() => {
      setSidebarToggleTooltipOpen(false);
      setCollapsed((current) => !current);
      setSidebarPreview(false);
    }}
  >
    <SidebarToggleIcon aria-hidden="true" strokeWidth={1.8} />
    {collapsed ? <span className="sidebar-toggle-dot" aria-hidden="true" /> : null}
  </button>
</Tooltip>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS with no open Tooltip after either click.

- [ ] **Step 5: Commit the sidebar fix**

```bash
git add src/renderer/components/Shell.tsx src/renderer/components/Shell.test.tsx
git commit -m "fix: close sidebar tooltip during layout toggle"
```

### Task 2: Realign node Popovers during React Flow viewport changes

**Files:**
- Create: `src/renderer/components/ViewportAnchoredPopover.tsx`
- Create: `src/renderer/components/ViewportAnchoredPopover.test.tsx`
- Modify: `src/renderer/screens/DialogueScreens.tsx`

- [ ] **Step 1: Write the failing Popover wrapper tests**

Create `ViewportAnchoredPopover.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewportAnchoredPopover } from "./ViewportAnchoredPopover";

const forceAlign = vi.hoisted(() => vi.fn());

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  const React = await import("react");
  return {
    ...actual,
    Popover: React.forwardRef(function MockPopover(
      { children }: { children: ReactNode },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({
        forceAlign,
        nativeElement: document.body,
        popupElement: document.createElement("div"),
      }));
      return children;
    }),
  };
});

afterEach(() => {
  cleanup();
  forceAlign.mockClear();
});

describe("ViewportAnchoredPopover", () => {
  it("registers an aligner for an open popover and clears it when closed", () => {
    const onAlignerChange = vi.fn();
    const { rerender } = render(
      <ViewportAnchoredPopover open onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(forceAlign).toHaveBeenCalledTimes(1);
    const aligner = onAlignerChange.mock.calls.at(-1)?.[0] as VoidFunction;
    aligner();
    expect(forceAlign).toHaveBeenCalledTimes(2);

    rerender(
      <ViewportAnchoredPopover open={false} onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(onAlignerChange).toHaveBeenLastCalledWith(null);
  });

  it("does not register or align a popover that starts closed", () => {
    const onAlignerChange = vi.fn();
    render(
      <ViewportAnchoredPopover open={false} onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(forceAlign).not.toHaveBeenCalled();
    expect(onAlignerChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the wrapper test and verify RED**

```bash
npx vitest run src/renderer/components/ViewportAnchoredPopover.test.tsx
```

Expected: FAIL because `ViewportAnchoredPopover` does not exist yet.

- [ ] **Step 3: Implement the minimal wrapper**

Create `ViewportAnchoredPopover.tsx`:

```tsx
import { Popover, type PopoverProps, type TooltipRef } from "antd";
import { useCallback, useLayoutEffect, useRef, type ReactElement } from "react";

type ViewportAnchoredPopoverProps = PopoverProps & {
  children: ReactElement;
  onAlignerChange?: (aligner: VoidFunction | null) => void;
};

export function ViewportAnchoredPopover({ children, onAlignerChange, open, ...popoverProps }: ViewportAnchoredPopoverProps) {
  const popoverRef = useRef<TooltipRef>(null);
  const forceAlign = useCallback(() => popoverRef.current?.forceAlign(), []);

  useLayoutEffect(() => {
    if (!open) return;
    forceAlign();
    onAlignerChange?.(forceAlign);
    return () => onAlignerChange?.(null);
  }, [forceAlign, onAlignerChange, open]);

  return (
    <Popover ref={popoverRef} open={open} {...popoverProps}>
      {children}
    </Popover>
  );
}
```

- [ ] **Step 4: Run the wrapper tests and verify GREEN**

Run the command from Step 2. Expected: both tests PASS.

- [ ] **Step 5: Wire viewport revisions into Living Tree nodes**

In `DialogueScreens.tsx`:

- import `ViewportAnchoredPopover` and remove `Popover` from the Ant Design import;
- add `onPopoverAlignerChange?: (aligner: VoidFunction | null) => void` to `VibeCanvasData`;
- add `const activePopoverAlignerRef = useRef<VoidFunction | null>(null);` inside `LivingTreeCockpit`;
- add this stable registration callback:

```tsx
const handlePopoverAlignerChange = useCallback((aligner: VoidFunction | null) => {
  activePopoverAlignerRef.current = aligner;
}, []);
```

- pass `handlePopoverAlignerChange` into every base flow node's `data` as `onPopoverAlignerChange`;
- add `onMove={() => activePopoverAlignerRef.current?.()}` to `ReactFlow`; and
- replace the node's Ant Design `Popover` with:

```tsx
<ViewportAnchoredPopover
  content={data.popoverContent}
  open={data.popoverOpen}
  onAlignerChange={data.onPopoverAlignerChange}
  placement="right"
  trigger="click"
  autoAdjustOverflow
  overlayClassName="living-tree-popover-overlay"
>
  {nodeCard}
</ViewportAnchoredPopover>
```

- [ ] **Step 6: Run wrapper and Living Tree regressions**

```bash
npx vitest run src/renderer/components/ViewportAnchoredPopover.test.tsx src/renderer/screens/DialogueScreens.test.tsx
```

Expected: all tests PASS, including existing node selection and confirmation tests.

- [ ] **Step 7: Commit the node Popover fix**

```bash
git add src/renderer/components/ViewportAnchoredPopover.tsx src/renderer/components/ViewportAnchoredPopover.test.tsx src/renderer/screens/DialogueScreens.tsx
git commit -m "fix: realign node popover on canvas viewport changes"
```

### Task 3: Verify the combined behavior

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run src/renderer/components/Shell.test.tsx src/renderer/components/ViewportAnchoredPopover.test.tsx src/renderer/screens/DialogueScreens.test.tsx
```

Expected: zero failed tests.

- [ ] **Step 2: Run TypeScript validation**

```bash
npm run lint
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Run the full Vitest suite**

```bash
npm test
```

Expected: zero failed tests.

- [ ] **Step 4: Build the application using the required proxy defaults**

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm run build
```

Expected: Wails build and bundled OfficeCLI signing exit 0.

- [ ] **Step 5: Inspect the final state**

```bash
git diff --check
git status --short
git log -5 --oneline
```

Expected: no whitespace errors and no uncommitted implementation changes.
