# OfficeDex Anchored Overlay Alignment Design

## Problem

Two Ant Design overlays can become detached from their visual anchors:

- the top-bar sidebar toggle Tooltip remains at its old screen coordinate when
  expanding or collapsing the sidebar changes the grid layout; and
- the Living Tree node confirmation Popover remains at its old screen
  coordinate when React Flow pans or zooms the selected node.

Both overlays are rendered in a portal under `body`. Ant Design recalculates
their position for events such as opening, scrolling, and window resizing, but
the sidebar CSS transition and React Flow viewport transform do not emit an
alignment trigger understood by the overlay.

## Goal

Keep each overlay visually attached to its current anchor without changing the
sidebar animation, React Flow navigation, or the contents and behavior of the
node confirmation form.

## Selected Approach

Use two narrow synchronization rules matched to the interaction:

1. Close the sidebar toggle Tooltip when the toggle is activated. The old
   hover hint is no longer useful after its action has run, and the next hover
   opens a fresh Tooltip at the button's new location.
2. Keep the node confirmation Popover open and call its exposed `forceAlign()`
   method whenever React Flow reports a viewport change. This preserves the
   user's editing context while continuously realigning the portaled Popover to
   the transformed node.

## Considered Alternatives

### Global overlay realignment listener

Observing all layout mutations or animation frames and realigning every Ant
Design overlay would affect unrelated screens and add permanent runtime work.
It is rejected because both failures have explicit local lifecycle signals.

### Render the node confirmation UI inside the React Flow transform layer

This would make the UI move automatically with the node, but it would also
scale the form and text during zoom and could be clipped by the canvas. It is
rejected because the confirmation form should remain readable at a stable
screen size.

### Close the node Popover on pan or zoom

This avoids stale placement but discards the user's editing context during
normal canvas navigation. It is rejected in favor of realignment.

## Component Changes

### Sidebar toggle Tooltip

`Shell` will control the toggle Tooltip's open state. `onOpenChange` continues
to reflect hover visibility, while the toggle click handler closes it before
changing the collapsed state. Other sidebar Tooltips are unchanged.

### Living Tree node Popover

`VibeTreeFlowNode` will retain a ref to the Ant Design Popover. A small child
component inside `ReactFlowProvider` will subscribe to React Flow viewport
changes and invoke a callback. While a node Popover is open, that callback will
call `forceAlign()` on the active Popover ref.

The viewport subscription will not alter node selection, Popover state, canvas
position, or zoom. It only requests a coordinate recalculation.

## Testing

- Add a Shell component regression test that opens the sidebar toggle Tooltip,
  activates the toggle, and verifies the old Tooltip closes as the layout
  state changes.
- Add a Living Tree regression test using the existing React Flow test setup.
  Open a node confirmation Popover, simulate a viewport change, and verify the
  active Popover receives a realignment request.
- Run focused Vitest tests, TypeScript linting, and the relevant renderer test
  suite. Build the renderer/application if the focused checks pass.

## Acceptance Criteria

- No stale sidebar toggle Tooltip remains at the pre-collapse or pre-expand
  coordinate after clicking the button.
- An open node confirmation Popover follows its selected node during React Flow
  pan and zoom without closing or scaling.
- Existing sidebar collapse, node selection, node confirmation, and Popover
  content behavior remain unchanged.
- The solution is local to the two affected overlays and introduces no global
  mutation or animation observer.
