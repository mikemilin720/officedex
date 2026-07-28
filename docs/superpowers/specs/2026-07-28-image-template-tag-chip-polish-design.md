# Image Template Tag Chip Polish Design

## Goal

Make the image-template tag filters feel quieter, denser, and more consistent with the rest of OfficeDex while removing the visually heavy native horizontal scrollbar.

## Scope

Only the image-template tag filter row is affected. Template filtering behavior, tag counts, selected state semantics, keyboard accessibility, and the image-template card layout remain unchanged.

## Typography and geometry

Use the approved compact editorial direction:

- Label text: `12px`, weight `500`, line-height `1.2`.
- Count text: `10px`, weight `500`.
- Chip minimum height: `26px`.
- Internal horizontal gap: `4px`.
- Chip padding: `2px 8px`.
- Row gap: `8px`.
- Preserve the existing pill radius, border colors, background colors, hover state, and selected state.
- In unselected chips, render the count with the existing muted text token so the label remains the primary scan target.
- In selected and hovered chips, let the count inherit the interactive foreground color for consistent contrast.

## Horizontal overflow

Keep `overflow-x: auto` so trackpads, touch gestures, mouse horizontal scrolling, and keyboard-reachable controls continue to work. Hide the native scrollbar visually across Firefox and WebKit/Blink:

- Firefox: `scrollbar-width: none`.
- WebKit/Blink: hide `::-webkit-scrollbar` by setting its display to `none`.
- Keep momentum scrolling on touch devices.
- Do not clip overflowing tags or replace scrolling with wrapping.

## Accessibility

The controls remain native buttons with their existing `aria-pressed` state. Hiding the scrollbar must not remove scrolling or keyboard access. Text remains at least `10px` for the secondary numeric count and `12px` for the actionable label.

## Verification

- Add a focused stylesheet contract test that reads `dialogue.css` and verifies the approved chip metrics and cross-browser scrollbar-hiding rules.
- Run the focused stylesheet test and the existing image-template tag and dialogue screen tests.
- Run TypeScript linting.
- Start the browser build and visually verify that the tag row uses the compact typography, has no visible native scrollbar, and still scrolls horizontally when content overflows.
