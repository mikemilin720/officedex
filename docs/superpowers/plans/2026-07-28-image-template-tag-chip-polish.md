# Image Template Tag Chip Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the image-template tag chips with the approved compact typography and hide the native horizontal scrollbar without removing horizontal scrolling.

**Architecture:** Keep the existing React markup and filtering behavior unchanged. Add one focused CSS contract test to the existing dialogue screen suite, then make the minimum stylesheet-only change in `dialogue.css`.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Vite.

---

### Task 1: Lock the approved chip typography and overflow behavior

**Files:**
- Modify: `src/renderer/screens/DialogueScreens.test.tsx`
- Modify: `src/renderer/styles/dialogue.css:973-1006`

- [ ] **Step 1: Write the failing stylesheet contract test**

Add this test beside the existing image-template tag filtering tests in `src/renderer/screens/DialogueScreens.test.tsx`:

```tsx
it("uses compact tag chips without a visible native horizontal scrollbar", () => {
  const css = readFileSync("src/renderer/styles/dialogue.css", "utf8");
  const rowRule = css.match(/\.image-template-tag-filters\s*\{[^}]*\}/s)?.[0] ?? "";
  const chipRule = css.match(/\.image-template-tag-filters button\s*\{[^}]*\}/s)?.[0] ?? "";
  const countRule = css.match(/\.image-template-tag-filters button b\s*\{[^}]*\}/s)?.[0] ?? "";
  const interactiveCountRule = css.match(/\.image-template-tag-filters button:hover b,\s*\.image-template-tag-filters button\.is-selected b\s*\{[^}]*\}/s)?.[0] ?? "";
  const webkitScrollbarRule = css.match(/\.image-template-tag-filters::\-webkit-scrollbar\s*\{[^}]*\}/s)?.[0] ?? "";

  expect(rowRule).toContain("overflow-x: auto;");
  expect(rowRule).toContain("scrollbar-width: none;");
  expect(rowRule).toContain("-webkit-overflow-scrolling: touch;");
  expect(chipRule).toContain("min-height: 26px;");
  expect(chipRule).toContain("gap: 4px;");
  expect(chipRule).toContain("padding: 2px 8px;");
  expect(chipRule).toContain("font-size: 12px;");
  expect(chipRule).toContain("font-weight: 500;");
  expect(chipRule).toContain("line-height: 1.2;");
  expect(countRule).toContain("color: var(--n-muted);");
  expect(countRule).toContain("font-size: 10px;");
  expect(countRule).toContain("font-weight: 500;");
  expect(interactiveCountRule).toContain("color: inherit;");
  expect(webkitScrollbarRule).toContain("display: none;");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run src/renderer/screens/DialogueScreens.test.tsx -t "uses compact tag chips without a visible native horizontal scrollbar"
```

Expected: FAIL because the current row uses `scrollbar-width: thin`, the chips inherit the larger body font, and no WebKit scrollbar-hiding rule exists.

- [ ] **Step 3: Implement the minimum CSS change**

Replace the existing tag-filter rules in `src/renderer/styles/dialogue.css` with:

```css
.image-template-tag-filters {
  display: flex;
  min-width: 0;
  gap: 8px;
  overflow-x: auto;
  padding: 0 1px 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.image-template-tag-filters::-webkit-scrollbar {
  display: none;
}

.image-template-tag-filters button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  border: 1px solid var(--n-hairline);
  border-radius: var(--radius-full);
  background: var(--n-canvas);
  color: var(--n-slate);
  padding: 2px 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
  cursor: pointer;
}

.image-template-tag-filters button b {
  color: var(--n-muted);
  font-size: 10px;
  font-weight: 500;
}

.image-template-tag-filters button:hover,
.image-template-tag-filters button.is-selected {
  border-color: var(--n-primary);
  background: var(--n-primary-soft);
  color: var(--n-primary);
}

.image-template-tag-filters button:hover b,
.image-template-tag-filters button.is-selected b {
  color: inherit;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run src/renderer/screens/DialogueScreens.test.tsx -t "uses compact tag chips without a visible native horizontal scrollbar"
npm test -- --run src/renderer/imageTemplateTags.test.ts src/renderer/screens/DialogueScreens.test.tsx
```

Expected: the focused contract test passes; the existing image-template tag and dialogue suite reports `172` or more passing tests with zero failures.

- [ ] **Step 5: Run static verification**

Run:

```bash
npm run lint
git diff --check
```

Expected: both commands exit successfully with no TypeScript or whitespace errors.

- [ ] **Step 6: Verify the UI in the browser build**

Run:

```bash
npm run dev:browser
```

Open `http://localhost:3100/`, enter the Image generation screen, and confirm:

- chips render at the approved compact density;
- counts are visually subordinate until hover or selection;
- no native horizontal scrollbar is visible;
- trackpad or shift-wheel horizontal scrolling still reveals off-screen tags;
- selecting a tag still filters the template cards.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/renderer/screens/DialogueScreens.test.tsx src/renderer/styles/dialogue.css
git commit -m "style: polish image template tag filters"
```
