# Image Template Tags Design

## Summary

Add administrator-configurable tags to image-generation templates and let OfficeDex aggregate those tags into a single-select template filter. Tags apply consistently to platform-public templates, user-private templates, and local JSON templates.

The implementation spans two repositories:

- `officecli-internal`: database persistence, template APIs, publish/copy inheritance, OfficeCLI Admin editing, and admin JSON import/export.
- `officedex`: bridge mapping, shared renderer types, local JSON import/export, tag aggregation, and gallery filtering.

## Goals

- Let an administrator configure multiple tags directly on each image template.
- Return template tags through the existing public/private template APIs.
- Preserve tags when copying a public template to a private template and when approving a private template for public publication.
- Preserve tags in local and admin template JSON import/export flows.
- Aggregate tags across public, private, and local templates in OfficeDex.
- Filter the template gallery by one tag at a time without discarding the selected template or form input.
- Populate the approved ecommerce starter pack with useful initial tags.

## Non-goals

- A standalone tag-management page.
- A normalized tag table or template-to-tag join table.
- Tag colors, icons, descriptions, aliases, permissions, or independent enabled state.
- Multi-select filtering or AND/OR filter modes.
- Server-side tag filtering, pagination, or tag analytics.
- Free-text template search.

## Data Model

Add a `tags` JSON column to `image_prompt_templates`, defaulting to an empty array. The Go model stores the serialized value and the admin/service layer exposes it as `[]string`.

The API shape is:

```json
{
  "tags": ["Ecommerce", "Studio"]
}
```

The same logical field is named `tags` in snake_case API responses, camelCase renderer models, and local/admin JSON files because the field name contains no word boundary.

Existing rows and older payloads without `tags` are interpreted as an empty array. A missing or `null` response value is also normalized to an empty array at client boundaries.

## Tag Normalization and Validation

The backend is the authoritative normalization boundary. Before persistence it:

1. Trims leading and trailing whitespace.
2. Removes empty values.
3. Deduplicates case-insensitively while preserving the first spelling supplied by the administrator.
4. Rejects a template with more than 10 normalized tags.
5. Rejects any tag longer than 32 Unicode characters.

Admin and local JSON parsers apply compatible normalization so imported data has predictable behavior before it reaches the API. The backend still validates all server writes.

Tags are display labels rather than slugs. Spaces and localized text are allowed. Matching in OfficeDex is case-insensitive.

## Backend and Template Lifecycle

All image-template create, update, list, and response paths include tags.

When a user copies a platform-public template into their private library, the new template inherits the source tags unless a future API explicitly allows the user to replace them. The current create-from-source flow does not add a separate tag editor.

When an administrator approves a private template publication request, the resulting public template inherits the private template tags. Rejecting a request makes no template changes.

Audit log payloads naturally include the persisted tags with the rest of the template model.

## OfficeCLI Admin Experience

The image-template create and edit forms gain a `Tags` control. It supports adding a tag with Enter and pasting comma-separated values. Added values render as removable tag tokens.

Configured-template cards display their current tags so administrators can inspect the saved classification without entering an edit mode.

Admin JSON import, paste, export, and clipboard copy preserve `tags`. Both the wrapped `{ "version": 1, "templates": [...] }` shape and the existing bare-array shape remain supported.

Invalid imported tag values produce an error that identifies the affected template and field rather than silently discarding malformed data.

## OfficeDex Data Flow

1. OfficeDex requests the existing combined public/private template list from OfficeCLI.
2. The Go bridge maps `tags` from bridge responses into the renderer-facing `ImagePromptTemplate` type.
3. Local templates load from browser storage with their normalized tags.
4. OfficeDex merges enabled local templates with enabled server templates.
5. The picker derives unique tags and counts from the merged enabled list.
6. Selecting a tag filters only the visible gallery cards.

No extra cache or tag endpoint is introduced. Refreshing the existing template list refreshes tags as well.

## OfficeDex Filter Experience

The picker displays a tag-filter row below the `Image templates` heading and above the masonry gallery.

- `All` is always the first filter and is selected by default.
- Other filters are sorted by display name for stable placement.
- Each filter shows the number of matching templates.
- Selection is single-choice.
- Matching ignores case.
- If refreshed data no longer contains the selected tag, the filter returns to `All`.
- If the selected filter has no matching templates, the picker shows a tag-specific empty state.
- Changing filters never clears the selected template, guided-field values, raw prompt edits, or attachments.
- When no enabled template has tags, the filter row is omitted and the current gallery remains unchanged.

Template cards do not display their tags in this iteration, keeping the image-first gallery compact.

## Local Template JSON

Local imports accept:

```json
{
  "title": "Clean Product Hero",
  "promptPreset": "...",
  "tags": ["Ecommerce", "Studio"]
}
```

Exports include `tags` only when the normalized list is non-empty, matching the existing compact treatment of optional thumbnail and slot fields. Older local files continue to import successfully.

## Ecommerce Starter Tags

The 12 approved templates receive these initial English tags:

| Template | Tags |
| --- | --- |
| Clean Product Hero | `Ecommerce`, `Studio` |
| Lifestyle Scene | `Ecommerce`, `Lifestyle` |
| Flat Lay Arrangement | `Ecommerce`, `Studio` |
| Material Detail Macro | `Ecommerce`, `Studio`, `Product Detail` |
| Model Showcase | `Ecommerce`, `Lifestyle` |
| Feature Infographic | `Ecommerce`, `Infographic` |
| Size and Specification Guide | `Ecommerce`, `Infographic` |
| Product Bundle Display | `Ecommerce`, `Studio` |
| Promotional Poster / Banner | `Ecommerce`, `Promotion` |
| Social Media Product Story | `Ecommerce`, `Lifestyle`, `Social Media` |
| Authentic UGC / Customer Snapshot | `Ecommerce`, `Lifestyle`, `Social Media` |
| Luxury Brand Atmosphere | `Ecommerce`, `Studio`, `Premium` |

## Error Handling

- Database rows with missing, null, or invalid legacy tag JSON degrade to an empty list when read, while new writes must pass validation.
- API validation errors state whether the tag count or tag length exceeded the limit.
- Admin import errors include the template index and invalid `tags` location.
- Local import errors include the template index and invalid `tags` location.
- A template-list network failure continues to use the existing picker error state; tags do not introduce a second request that can fail independently.
- The selected tag is UI state only and is not persisted between sessions.

## Testing Strategy

### `officecli-internal`

- Migration coverage for the default empty tag array.
- Service tests for trimming, empty removal, case-insensitive deduplication, count validation, and length validation.
- CRUD response round-trip tests.
- Public-to-private copy inheritance tests.
- Private-to-public approval inheritance tests.
- Application-route response tests.
- Admin page tests for create/edit input and visible tag tokens.
- Admin JSON import/export round-trip tests.

### `officedex`

- Go bridge tests for response and create mapping.
- Shared renderer/local JSON tests for normalization and round-trip behavior.
- Pure aggregation tests for case-insensitive uniqueness, counts, and sort order.
- Picker interaction tests for `All`, tag selection, tag-specific empty state, and refresh fallback.
- Regression tests proving filter changes preserve template selection and form state.
- English and Chinese i18n coverage.
- Focused test suites followed by the repository's full renderer tests and production build.

## Repository Isolation

The current shared `officecli-internal` checkout contains extensive unrelated changes and branch divergence. Implementation must use isolated worktrees for both repositories, based on appropriate clean branch points, and must not overwrite or absorb those shared-checkout edits. The existing ecommerce starter-pack branch/worktree should be reused or integrated carefully when adding its tags.
