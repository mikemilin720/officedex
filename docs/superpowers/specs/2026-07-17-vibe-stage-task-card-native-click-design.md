# Vibe Stage Task Card Native Click Design

## Problem

OfficeDex `v0.6.3` and its bundled OfficeCLI `0.2.119` correctly receive the
`story_ready` Vibe Tree snapshot, including the four pending Story Beat nodes.
The renderer therefore has all data required to render the current-task card.

The active progress step is currently a non-semantic `div` passed directly to
Ant Design `Popover` with `trigger="click"`. Renderer tests dispatch a synthetic
Testing Library click to that `div`, but the component has no native interactive
element or explicit application-owned click handler. This leaves the release
WebView interaction dependent on Ant Design cloning the child and installing its
trigger handler.

## Goal

Make the active Vibe progress step a native, explicitly controlled button so a
real click opens the current-task card consistently in the packaged desktop app.

## Scope

- Change only the active Vibe progress-step trigger and its presentation reset.
- Preserve automatic task-card opening, stage transitions, task-card contents,
  confirmation actions, and inactive progress-step rendering.
- Add a regression test that requires a native button and invokes its DOM click.
- Run focused renderer tests, TypeScript validation, and a production build.
- Do not include the separate node-Popover viewport realignment work.
- Do not publish a new GitHub Release as part of this code fix.

## Selected Approach

Render the active step as a `button type="button"` with an accessible label and
an explicit `onClick` handler that updates `manualOpen`. Keep the Popover fully
controlled through its existing `open` property, and disable Ant Design's own
trigger list so only the application-owned handler changes the state.

Inactive and completed steps remain non-interactive `div` elements. A narrow CSS
reset removes native button chrome while retaining the existing progress-step
layout and visual states.

## Alternatives Rejected

### CSS pointer-event override

There is no evidence that the active step or its ancestors currently disable
pointer events. Adding overrides would mask the trigger ownership problem and
could interfere with the connector line or task-card portal.

### Keep the `div` and add more synthetic tests

This would preserve the release-specific dependency on Ant Design child cloning.
It would improve coverage without making the interaction boundary more robust or
accessible.

### Bundle the viewport-alignment fix

Keeping node Popovers aligned while React Flow pans is a separate behavior with
different state and tests. Combining it would make this release-click regression
harder to isolate.

## Component Behavior

`VibeProgressSteps` continues to calculate:

```ts
const popoverOpen = manualOpen || Boolean(autoOpenTaskCard);
```

For the active step with a task card:

1. the native button receives the user click;
2. its handler toggles `manualOpen`;
3. the controlled Popover receives the updated `open` value; and
4. Ant Design renders the unchanged task card in its portal.

When the active stage changes, existing logic clears manual state. When automatic
opening becomes false, existing effect behavior remains unchanged.

## Testing

- Renderer regression: query the Story Beat trigger by button role and accessible
  name, call the real DOM `click()` method, and assert that `Current Task` appears.
- Existing Living Tree renderer tests: ensure confirmations, automatic opening,
  stage actions, and transitions remain green.
- TypeScript: ensure the controlled Popover trigger typing is valid.
- Production build: prove the renderer bundles successfully through the normal
  non-demo release path.

## Acceptance Criteria

- The active Story Beat step is a native button in the rendered DOM.
- Clicking that button opens the current-task card when it is not auto-open.
- The card still auto-opens when `autoOpenTaskCard` is true.
- Inactive progress steps remain non-clickable.
- Existing Vibe confirmation and generation behavior is unchanged.
- Focused tests, TypeScript validation, and the production build exit zero.
