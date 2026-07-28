# Sidebar Brand Icon Rounded Corners Design

## Goal

Make the OfficeDex icon in the sidebar brand block appear with its intended rounded outline instead of showing the opaque black square corners contained in the PNG.

## Scope

- Change only the sidebar brand mark rendered by `Shell`.
- Keep `public/officedex-logo.png` unchanged.
- Do not change the macOS Dock icon, Windows icon, installer artwork, or About screen icon.
- Include the fix in OfficeDex `v0.6.7`.

## Design

Apply a rounded clipping boundary to `.brand-mark` in `src/renderer/styles/shell.css`:

- use an approximately 20% corner radius for the 40px square mark;
- hide overflow so the opaque black corners of the source PNG are clipped;
- preserve the existing image dimensions and `object-fit: contain` behavior.

This keeps the fix local to the affected UI surface and avoids altering a shared image asset.

## Verification

1. Add a focused regression assertion that the sidebar brand mark stylesheet defines both rounded corners and overflow clipping.
2. Run the focused Shell test and the relevant renderer suite.
3. Build or run the local UI and visually confirm that the sidebar icon has rounded corners without changing its size or alignment.
4. Let the `v0.6.7` Release workflow verify the complete packaged application on macOS and Windows.
