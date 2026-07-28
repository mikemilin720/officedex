# Image Template Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add administrator-configurable image-template tags and a single-select aggregated tag filter in OfficeDex for public, private, and local templates.

**Architecture:** Persist tags as a normalized JSON string array on `image_prompt_templates`, carry them through OfficeCLI platform responses and the agent bridge, then map them through the OfficeDex Go bridge into renderer models. OfficeDex normalizes local JSON tags, derives case-insensitive filter counts from the merged enabled-template list, and filters only gallery visibility so selected-template form state remains intact.

**Tech Stack:** Go, GORM, MySQL/PostgreSQL migrations, React 19, TypeScript, Ant Design 6, Vitest, Testing Library, Wails bridge types, JSON template artifacts.

---

## File Map

### `officecli-internal`

- Create `platform/migrations/039_image_prompt_template_tags.sql`: add the MySQL-compatible `tags` JSON column.
- Create `platform/migrations/postgres/039_image_prompt_template_tags.sql`: add the PostgreSQL `tags` JSON column.
- Modify `platform/internal/model/models.go`: persist serialized template tags.
- Modify `platform/internal/admin/types.go`: expose tags on admin/public/private request and response types.
- Modify `platform/internal/admin/service.go`: normalize, validate, serialize, parse, update, copy, publish, and respond with tags.
- Modify `platform/internal/admin/service_test.go`: cover normalization, limits, CRUD, copy inheritance, and publication inheritance.
- Modify `platform/internal/app/application_image_templates_routes_test.go`: prove route responses include tags.
- Modify `internal/cli/types.go`: include tags in agent-bridge template/request types.
- Modify `internal/cli/agent_bridge_test.go`: prove the bridge returns server tags.
- Modify `platform/web/admin/src/types.ts`: add tags to the admin TypeScript model.
- Modify `platform/web/admin/src/pages/ImageTemplatesPage.tsx`: edit, display, import, and export tags.
- Modify `platform/web/admin/src/pages/ImageTemplatesPage.test.tsx`: cover create/edit and JSON round trips.

### `officedex`

- Modify `src/shared/types.ts`: expose tags in renderer template and create-input types.
- Modify `internal/types/types.go`: expose tags in Wails-facing Go types.
- Modify `internal/bridge/client.go`: map list/create tag fields across snake_case and camelCase boundaries.
- Modify `internal/bridge/client_test.go`: prove list and create mappings.
- Create `src/renderer/imageTemplateTags.ts`: normalize tags, aggregate counts, and match templates.
- Create `src/renderer/imageTemplateTags.test.ts`: test normalization and aggregation as pure behavior.
- Modify `src/renderer/localImageTemplates.ts`: preserve tags in local imports, storage, and exports.
- Modify `src/renderer/localImageTemplates.test.ts`: test local JSON compatibility and validation.
- Modify `src/renderer/screens/DialogueScreens.tsx`: add single-select tag filters to `ImageTemplatePicker`.
- Modify `src/renderer/screens/DialogueScreens.test.tsx`: test filtering, counts, refresh fallback, and form-state preservation.
- Modify `src/renderer/styles/dialogue.css`: style the compact filter row.
- Modify `src/renderer/i18n/en.ts`: add English filter text.
- Modify `src/renderer/i18n/zh.ts`: add Chinese filter text.
- Modify `examples/image-templates/ecommerce-starter.json`: add the approved English tags to all 12 templates.

## Task 1: Prepare isolated worktrees

**Files:** None. This task only creates isolated Git worktrees and preserves dirty shared checkouts.

- [ ] **Step 1: Read and follow the worktree skill**

Run:

```bash
sed -n '1,320p' /Users/luyang/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/using-git-worktrees/SKILL.md
```

Expected: instructions require checking repository state and creating isolated worktrees without disturbing current changes.

- [ ] **Step 2: Refresh clean remote branch references**

Run:

```bash
git -C /Users/luyang/Workspace/shimo/vibe-officing/officecli-internal fetch origin main
git -C /Users/luyang/Workspace/shimo/vibe-officing/officedex fetch origin main
```

If the network stalls, retry with:

```bash
HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 git -C /Users/luyang/Workspace/shimo/vibe-officing/officecli-internal fetch origin main
HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 git -C /Users/luyang/Workspace/shimo/vibe-officing/officedex fetch origin main
```

Expected: both fetches complete without modifying either shared working tree.

- [ ] **Step 3: Create the OfficeCLI backend/admin worktree**

Run:

```bash
git -C /Users/luyang/Workspace/shimo/vibe-officing/officecli-internal worktree add /Users/luyang/.config/superpowers/worktrees/officecli-internal/image-template-tags -b codex/image-template-tags origin/main
```

Expected: a clean worktree on `codex/image-template-tags` at the listed path.

- [ ] **Step 4: Create the OfficeDex worktree from the approved design commit**

Run:

```bash
git -C /Users/luyang/Workspace/shimo/vibe-officing/officedex worktree add /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags -b codex/image-template-tags 9aaddca
```

Expected: a clean OfficeDex worktree containing the approved design and plan documents.

- [ ] **Step 5: Bring only the approved JSON artifact into the OfficeDex worktree**

Run:

```bash
git -C /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags restore --source codex/ecommerce-image-template-pack -- examples/image-templates/ecommerce-starter.json
git -C /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags status --short
```

Expected: only `examples/image-templates/ecommerce-starter.json` is newly added; deleted docs and deleted tests from the older pack branch are not imported.

## Task 2: Persist and normalize tags in the platform service

**Files:**

- Create: `officecli-internal/platform/migrations/039_image_prompt_template_tags.sql`
- Create: `officecli-internal/platform/migrations/postgres/039_image_prompt_template_tags.sql`
- Modify: `officecli-internal/platform/internal/model/models.go`
- Modify: `officecli-internal/platform/internal/admin/types.go`
- Modify: `officecli-internal/platform/internal/admin/service.go`
- Test: `officecli-internal/platform/internal/admin/service_test.go`

- [ ] **Step 1: Write failing service tests for normalization and persistence**

Add these assertions to `TestImagePromptTemplatesServiceCRUDThumbnailAndCompose` and add a focused validation test:

```go
created, err := svc.CreateImagePromptTemplate(context.Background(), UpsertImagePromptTemplateRequest{
	Slug:         "poster",
	Title:        "Poster",
	Description:  "Poster template",
	PromptPreset: "cinematic poster style",
	Tags:         []string{" Ecommerce ", "studio", "STUDIO", ""},
	SortOrder:    10,
	Enabled:      true,
})
require.NoError(t, err)
require.Equal(t, []string{"Ecommerce", "studio"}, created.Tags)

publicItems, err := svc.ListImagePromptTemplates(context.Background(), true, "/api/image-templates")
require.NoError(t, err)
require.Equal(t, []string{"Ecommerce", "studio"}, publicItems[0].Tags)
```

```go
func TestImagePromptTemplateTagValidation(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:image_prompt_template_tag_validation?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ImagePromptTemplate{}, &model.AdminAuditLog{}))
	svc := NewService(sqlstore.NewWithDB(db), nil, "secret", time.Hour, "cookie", fakeCodec{}, "salt", nil, nil, nil)

	tooMany := make([]string, 11)
	for i := range tooMany {
		tooMany[i] = fmt.Sprintf("tag-%d", i)
	}
	_, err = svc.CreateImagePromptTemplate(context.Background(), UpsertImagePromptTemplateRequest{
		Slug: "too-many", Title: "Too many", PromptPreset: "prompt", Tags: tooMany, Enabled: true,
	})
	require.EqualError(t, err, "image template tags must contain at most 10 items")

	_, err = svc.CreateImagePromptTemplate(context.Background(), UpsertImagePromptTemplateRequest{
		Slug: "too-long", Title: "Too long", PromptPreset: "prompt", Tags: []string{strings.Repeat("界", 33)}, Enabled: true,
	})
	require.EqualError(t, err, "image template tag must contain at most 32 characters")
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from the OfficeCLI worktree:

```bash
env -u GOROOT go test ./platform/internal/admin -run 'TestImagePromptTemplatesServiceCRUDThumbnailAndCompose|TestImagePromptTemplateTagValidation' -count=1
```

Expected: compile failure because request/response types do not yet define `Tags`.

- [ ] **Step 3: Add database migrations and persisted model field**

Create the MySQL migration:

```sql
ALTER TABLE image_prompt_templates
  ADD COLUMN tags JSON NOT NULL DEFAULT ('[]');
```

Create the PostgreSQL migration:

```sql
ALTER TABLE image_prompt_templates
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
```

Add this field to `model.ImagePromptTemplate` next to `SlotsJSON`:

```go
TagsJSON string `gorm:"column:tags;type:json;not null;default:'[]'" json:"tags,omitempty"`
```

- [ ] **Step 4: Add request and response fields**

Add the following field to `ImagePromptTemplateResponse`, `UpsertImagePromptTemplateRequest`, and `CreateUserImagePromptTemplateRequest`:

```go
Tags []string `json:"tags,omitempty"`
```

- [ ] **Step 5: Implement normalization, serialization, and parsing helpers**

Add imports for `encoding/json` if not already present and `unicode/utf8`, then add:

```go
const (
	maxImagePromptTemplateTags      = 10
	maxImagePromptTemplateTagRunes  = 32
)

func normalizeImagePromptTags(tags []string) ([]string, error) {
	normalized := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, raw := range tags {
		tag := strings.TrimSpace(raw)
		if tag == "" {
			continue
		}
		if utf8.RuneCountInString(tag) > maxImagePromptTemplateTagRunes {
			return nil, fmt.Errorf("image template tag must contain at most 32 characters")
		}
		key := strings.ToLower(tag)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, tag)
	}
	if len(normalized) > maxImagePromptTemplateTags {
		return nil, fmt.Errorf("image template tags must contain at most 10 items")
	}
	return normalized, nil
}

func marshalImagePromptTags(tags []string) (string, error) {
	normalized, err := normalizeImagePromptTags(tags)
	if err != nil {
		return "", err
	}
	if normalized == nil {
		normalized = []string{}
	}
	encoded, err := json.Marshal(normalized)
	if err != nil {
		return "", fmt.Errorf("marshal image template tags: %w", err)
	}
	return string(encoded), nil
}

func parseImagePromptTags(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	var tags []string
	if err := json.Unmarshal([]byte(raw), &tags); err != nil {
		log.Printf("admin: decode image prompt template tags: %v", err)
		return []string{}
	}
	normalized, err := normalizeImagePromptTags(tags)
	if err != nil {
		log.Printf("admin: normalize stored image prompt template tags: %v", err)
		return []string{}
	}
	return normalized
}
```

- [ ] **Step 6: Wire tags into create, update, and response mapping**

In `imagePromptTemplateFromRequest`, serialize `req.Tags` and assign `item.TagsJSON`:

```go
tagsJSON, err := marshalImagePromptTags(req.Tags)
if err != nil {
	return item, err
}
item.TagsJSON = tagsJSON
```

Add the update value:

```go
"tags": item.TagsJSON,
```

Add the response field:

```go
Tags: parseImagePromptTags(item.TagsJSON),
```

- [ ] **Step 7: Run the focused tests and verify GREEN**

Run:

```bash
env -u GOROOT go test ./platform/internal/admin -run 'TestImagePromptTemplatesServiceCRUDThumbnailAndCompose|TestImagePromptTemplateTagValidation' -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit platform tag persistence**

Run:

```bash
git add platform/migrations/039_image_prompt_template_tags.sql platform/migrations/postgres/039_image_prompt_template_tags.sql platform/internal/model/models.go platform/internal/admin/types.go platform/internal/admin/service.go platform/internal/admin/service_test.go
git commit -m "feat: persist image template tags"
```

## Task 3: Preserve tags through private copies, publication, routes, and agent bridge

**Files:**

- Modify: `officecli-internal/platform/internal/admin/service.go`
- Modify: `officecli-internal/platform/internal/admin/service_test.go`
- Modify: `officecli-internal/platform/internal/app/application_image_templates_routes_test.go`
- Modify: `officecli-internal/internal/cli/types.go`
- Modify: `officecli-internal/internal/cli/agent_bridge_test.go`

- [ ] **Step 1: Write failing lifecycle tests**

Extend the existing private-copy/publication test so the public source has tags and assert both derived templates inherit them:

```go
public, err := svc.CreateImagePromptTemplate(context.Background(), UpsertImagePromptTemplateRequest{
	Slug: "public-poster", Title: "Public Poster", PromptPreset: "public prompt",
	Tags: []string{"Ecommerce", "Studio"}, Enabled: true,
})
require.NoError(t, err)

privateCopy, err := svc.CreateUserImagePromptTemplate(context.Background(), 42, CreateUserImagePromptTemplateRequest{
	SourceTemplateID: public.ID,
	Slug:             "private-poster",
	Title:            "Private Poster",
})
require.NoError(t, err)
require.Equal(t, []string{"Ecommerce", "Studio"}, privateCopy.Tags)
```

After approval creates the public template, assert:

```go
require.Equal(t, []string{"Ecommerce", "Studio"}, published.Tags)
```

Also add a local-style private create assertion where `CreateUserImagePromptTemplateRequest.Tags` is explicitly supplied:

```go
privateFromLocal, err := svc.CreateUserImagePromptTemplate(context.Background(), 42, CreateUserImagePromptTemplateRequest{
	Slug:         "local-import",
	Title:        "Local Import",
	PromptPreset: "local prompt",
	Tags:         []string{"Ecommerce", "Social Media"},
})
require.NoError(t, err)
require.Equal(t, []string{"Ecommerce", "Social Media"}, privateFromLocal.Tags)
```

- [ ] **Step 2: Add failing route and agent-bridge assertions**

In `application_image_templates_routes_test.go`, create a template with:

```go
Tags: []string{"Ecommerce", "Promotion"},
```

and assert the decoded route response contains those two tags.

In the existing `image_templates/list` agent-bridge test, return:

```json
"tags": ["Ecommerce", "Promotion"]
```

and assert:

```go
require.Equal(t, []string{"Ecommerce", "Promotion"}, result[0].Tags)
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
env -u GOROOT go test ./platform/internal/admin ./platform/internal/app ./internal/cli -run 'ImagePromptTemplate|ImageTemplates' -count=1
```

Expected: failures show tags are not inherited and the CLI type drops the response field.

- [ ] **Step 4: Implement private-copy tag inheritance**

In `CreateUserImagePromptTemplate`, resolve the request/source tags before constructing the model:

```go
tags := req.Tags
if source != nil && tags == nil {
	tags = parseImagePromptTags(source.TagsJSON)
}
tagsJSON, err := marshalImagePromptTags(tags)
if err != nil {
	return nil, err
}
```

Assign:

```go
TagsJSON: tagsJSON,
```

- [ ] **Step 5: Preserve tags on publication approval**

Add this field to `publicTemplate` in `ReviewImageTemplatePublishRequest`:

```go
TagsJSON: privateTemplate.TagsJSON,
```

- [ ] **Step 6: Add tags to the OfficeCLI bridge types**

Add to both `internal/cli.ImagePromptTemplate` and `internal/cli.CreateUserImagePromptTemplateRequest`:

```go
Tags []string `json:"tags,omitempty"`
```

No custom mapping is needed in `generate_runner.go`; `platformJSON` decodes and encodes these structs directly.

- [ ] **Step 7: Run lifecycle, route, and bridge tests**

Run:

```bash
env -u GOROOT go test ./platform/internal/admin ./platform/internal/app ./internal/cli -run 'ImagePromptTemplate|ImageTemplates' -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit lifecycle propagation**

Run:

```bash
git add platform/internal/admin/service.go platform/internal/admin/service_test.go platform/internal/app/application_image_templates_routes_test.go internal/cli/types.go internal/cli/agent_bridge_test.go
git commit -m "feat: propagate image template tags"
```

## Task 4: Add tag editing and JSON support to OfficeCLI Admin

**Files:**

- Modify: `officecli-internal/platform/web/admin/src/types.ts`
- Modify: `officecli-internal/platform/web/admin/src/pages/ImageTemplatesPage.tsx`
- Test: `officecli-internal/platform/web/admin/src/pages/ImageTemplatesPage.test.tsx`

- [ ] **Step 1: Write failing admin create/import/export tests**

Update the create test to enter two tags and require the POST body:

```ts
expect(JSON.parse(String(init.body))).toMatchObject({
  slug: 'liblib-poster',
  title: 'Liblib Poster',
  prompt_preset: 'preset prompt',
  tags: ['Ecommerce', 'Studio'],
  enabled: true,
})
```

Interact with the tags control:

```ts
fireEvent.mouseDown(screen.getAllByLabelText('Tags')[0])
fireEvent.change(screen.getAllByRole('combobox', { name: 'Tags' })[0], { target: { value: 'Ecommerce' } })
fireEvent.keyDown(screen.getAllByRole('combobox', { name: 'Tags' })[0], { key: 'Enter' })
fireEvent.change(screen.getAllByRole('combobox', { name: 'Tags' })[0], { target: { value: 'Studio' } })
fireEvent.keyDown(screen.getAllByRole('combobox', { name: 'Tags' })[0], { key: 'Enter' })
```

Add `tags: ['Ecommerce', 'Infographic']` to the export fixture and assert exported/copied JSON retains the array. Add tags to the import JSON and assert each POST body retains them.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```bash
npm --prefix platform/web/admin test -- src/pages/ImageTemplatesPage.test.tsx
```

Expected: tests fail because no Tags control or JSON field exists.

- [ ] **Step 3: Add the TypeScript field and normalization helper**

Add to `ImagePromptTemplate`:

```ts
tags?: string[]
```

Add to `ImageTemplatesPage.tsx`:

```ts
const MAX_TEMPLATE_TAGS = 10
const MAX_TEMPLATE_TAG_LENGTH = 32

function normalizeTags(raw: unknown, path = 'tags'): string[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new Error(`${path} must be an array.`)
  const seen = new Set<string>()
  const tags: string[] = []
  raw.forEach((value, index) => {
    if (typeof value !== 'string') throw new Error(`${path}[${index}] must be a string.`)
    const tag = value.trim()
    if (!tag) return
    if ([...tag].length > MAX_TEMPLATE_TAG_LENGTH) throw new Error(`${path}[${index}] must contain at most 32 characters.`)
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    tags.push(tag)
  })
  if (tags.length > MAX_TEMPLATE_TAGS) throw new Error(`${path} must contain at most 10 items.`)
  return tags
}
```

- [ ] **Step 4: Preserve tags in normalization and JSON flows**

Add this property to `normalizeTemplate`, `normalizeImportedTemplate`, and `editableTemplate`:

```ts
tags: normalizeTags(template.tags),
```

For imported raw data use:

```ts
tags: normalizeTags(raw.tags, `template[${index}].tags`),
```

For exported objects use:

```ts
...(template.tags?.length ? { tags: normalizeTags(template.tags) } : {}),
```

- [ ] **Step 5: Add the admin tag editor**

Extend the Ant Design import:

```ts
import { App as AntApp, Input, Modal, Select } from 'antd'
```

Add a reusable control:

```tsx
function TagsField({ value, onChange }: { value?: string[]; onChange: (value: string[]) => void }) {
  return (
    <label className="text-sm text-outline">Tags
      <Select
        aria-label="Tags"
        className="mt-2 w-full"
        mode="tags"
        tokenSeparators={[',']}
        value={value ?? []}
        onChange={(next) => onChange(normalizeTags(next))}
        maxCount={MAX_TEMPLATE_TAGS}
        placeholder="Ecommerce, Studio"
      />
    </label>
  )
}
```

Render it in the create form:

```tsx
<TagsField value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
```

Render it in each edit form:

```tsx
<TagsField value={activeDraft.tags} onChange={(tags) => setTemplateDraft(id, { ...activeDraft, tags })} />
```

Below each configured title block, render saved tags as compact tokens:

```tsx
{template.tags?.length ? (
  <div className="flex flex-wrap gap-2 md:col-span-2">
    {template.tags.map((tag) => <span key={tag.toLocaleLowerCase()} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{tag}</span>)}
  </div>
) : null}
```

- [ ] **Step 6: Run focused admin tests and lint**

Run:

```bash
npm --prefix platform/web/admin test -- src/pages/ImageTemplatesPage.test.tsx
npm --prefix platform/web/admin run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the Admin UI**

Run:

```bash
git add platform/web/admin/src/types.ts platform/web/admin/src/pages/ImageTemplatesPage.tsx platform/web/admin/src/pages/ImageTemplatesPage.test.tsx
git commit -m "feat: configure image template tags in admin"
```

## Task 5: Map tags through the OfficeDex bridge

**Files:**

- Modify: `officedex/src/shared/types.ts`
- Modify: `officedex/internal/types/types.go`
- Modify: `officedex/internal/bridge/client.go`
- Test: `officedex/internal/bridge/client_test.go`

- [ ] **Step 1: Write failing list and create bridge tests**

Add `tags` to the `TestListImageTemplatesMapsBridgeResponse` fixture:

```go
"tags": []string{"Ecommerce", "Studio"},
```

Add:

```go
if !reflect.DeepEqual(result.items[0].Tags, []string{"Ecommerce", "Studio"}) {
	t.Fatalf("Tags = %#v", result.items[0].Tags)
}
```

Add a create test that calls:

```go
client.CreateImageTemplate(context.Background(), types.CreateUserImageTemplateInput{
	Slug: "local-poster", Title: "Local Poster", PromptPreset: "prompt",
	Tags: []string{"Ecommerce", "Promotion"},
})
```

Assert request params contain:

```go
tags, ok := params["tags"].([]any)
if !ok || len(tags) != 2 || tags[0] != "Ecommerce" || tags[1] != "Promotion" {
	t.Fatalf("tags = %#v", params["tags"])
}
```

Return tags in the fake response and assert the mapped result keeps them.

- [ ] **Step 2: Run the bridge tests and verify RED**

Run:

```bash
env -u GOROOT go test ./internal/bridge -run 'TestListImageTemplatesMapsBridgeResponse|TestCreateImageTemplate.*Tags' -count=1
```

Expected: compile failures because the OfficeDex types do not contain `Tags`.

- [ ] **Step 3: Add renderer and Go type fields**

Add to `ImagePromptTemplate`:

```ts
tags?: string[];
```

Add to `CreateUserImageTemplateInput`:

```ts
tags?: string[];
```

Add to Go `ImagePromptTemplate`:

```go
Tags []string `json:"tags,omitempty"`
```

Add to Go `CreateUserImageTemplateInput`:

```go
Tags []string `json:"tags,omitempty"`
```

- [ ] **Step 4: Map list and create fields**

Add to `bridgeImagePromptTemplate`:

```go
Tags []string `json:"tags,omitempty"`
```

Add to both renderer-facing mapped values:

```go
Tags: append([]string(nil), item.Tags...),
```

In `CreateImageTemplate`, include tags only when present:

```go
if len(input.Tags) > 0 {
	params["tags"] = append([]string(nil), input.Tags...)
}
```

- [ ] **Step 5: Run bridge tests and verify GREEN**

Run:

```bash
env -u GOROOT go test ./internal/bridge -run 'TestListImageTemplatesMapsBridgeResponse|TestCreateImageTemplate.*Tags' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit the bridge mapping**

Run:

```bash
git add src/shared/types.ts internal/types/types.go internal/bridge/client.go internal/bridge/client_test.go
git commit -m "feat: map image template tags into officedex"
```

## Task 6: Normalize local tags and aggregate filter metadata

**Files:**

- Create: `officedex/src/renderer/imageTemplateTags.ts`
- Create: `officedex/src/renderer/imageTemplateTags.test.ts`
- Modify: `officedex/src/renderer/localImageTemplates.ts`
- Modify: `officedex/src/renderer/localImageTemplates.test.ts`

- [ ] **Step 1: Write failing pure tag tests**

Create `imageTemplateTags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ImagePromptTemplate } from "../shared/types";
import { buildImageTemplateTagFilters, imageTemplateMatchesTag, normalizeImageTemplateTags } from "./imageTemplateTags";

const template = (id: number, title: string, tags: string[]): ImagePromptTemplate => ({
  id, slug: title.toLowerCase(), title, description: "", promptPreset: "prompt",
  sortOrder: id, enabled: true, tags,
});

describe("image template tags", () => {
  it("trims, removes blanks, and deduplicates without changing first spelling", () => {
    expect(normalizeImageTemplateTags([" Ecommerce ", "studio", "STUDIO", ""], "tags"))
      .toEqual(["Ecommerce", "studio"]);
  });

  it("rejects malformed and oversized tag values", () => {
    expect(() => normalizeImageTemplateTags("Ecommerce", "template[0].tags")).toThrow(/must be an array/);
    expect(() => normalizeImageTemplateTags(["x".repeat(33)], "template[0].tags")).toThrow(/32 characters/);
    expect(() => normalizeImageTemplateTags(Array.from({ length: 11 }, (_, index) => `tag-${index}`), "template[0].tags")).toThrow(/10 items/);
  });

  it("aggregates case-insensitive counts and sorts display labels", () => {
    const filters = buildImageTemplateTagFilters([
      template(1, "Hero", ["Studio", "Ecommerce"]),
      template(2, "Macro", ["studio", "Product Detail"]),
      template(3, "UGC", ["Social Media"]),
    ]);
    expect(filters).toEqual([
      { key: "ecommerce", label: "Ecommerce", count: 1 },
      { key: "product detail", label: "Product Detail", count: 1 },
      { key: "social media", label: "Social Media", count: 1 },
      { key: "studio", label: "Studio", count: 2 },
    ]);
    expect(imageTemplateMatchesTag(template(1, "Hero", ["Studio"]), "studio")).toBe(true);
  });
});
```

- [ ] **Step 2: Extend local JSON tests before implementation**

Add tags to the import fixture:

```ts
tags: [" Ecommerce ", "Studio", "studio"],
```

Expect:

```ts
tags: ["Ecommerce", "Studio"],
```

Add tags to the persistence fixture and expect the exported file to retain them. Add:

```ts
expect(() => importLocalImageTemplatesJSON(JSON.stringify({
  templates: [{ title: "Bad tags", promptPreset: "prompt", tags: ["x".repeat(33)] }],
}))).toThrow(/template\[0\]\.tags/);
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npx vitest run src/renderer/imageTemplateTags.test.ts src/renderer/localImageTemplates.test.ts
```

Expected: missing-module failure and local JSON tag assertions fail.

- [ ] **Step 4: Implement the pure tag module**

Create `imageTemplateTags.ts`:

```ts
import type { ImagePromptTemplate } from "../shared/types";

export const MAX_IMAGE_TEMPLATE_TAGS = 10;
export const MAX_IMAGE_TEMPLATE_TAG_LENGTH = 32;

export interface ImageTemplateTagFilter {
  key: string;
  label: string;
  count: number;
}

export function imageTemplateTagKey(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}

export function normalizeImageTemplateTags(raw: unknown, path: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`${path} must be an array.`);
  const seen = new Set<string>();
  const tags: string[] = [];
  raw.forEach((value, index) => {
    if (typeof value !== "string") throw new Error(`${path}[${index}] must be a string.`);
    const tag = value.trim();
    if (!tag) return;
    if ([...tag].length > MAX_IMAGE_TEMPLATE_TAG_LENGTH) throw new Error(`${path}[${index}] must contain at most 32 characters.`);
    const key = imageTemplateTagKey(tag);
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });
  if (tags.length > MAX_IMAGE_TEMPLATE_TAGS) throw new Error(`${path} must contain at most 10 items.`);
  return tags;
}

export function buildImageTemplateTagFilters(templates: ImagePromptTemplate[]): ImageTemplateTagFilter[] {
  const filters = new Map<string, ImageTemplateTagFilter>();
  for (const template of templates) {
    const templateKeys = new Set<string>();
    for (const label of template.tags ?? []) {
      const key = imageTemplateTagKey(label);
      if (!key || templateKeys.has(key)) continue;
      templateKeys.add(key);
      const existing = filters.get(key);
      if (existing) existing.count += 1;
      else filters.set(key, { key, label: label.trim(), count: 1 });
    }
  }
  return [...filters.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

export function imageTemplateMatchesTag(template: ImagePromptTemplate, selectedTag: string): boolean {
  if (!selectedTag) return true;
  return (template.tags ?? []).some((tag) => imageTemplateTagKey(tag) === selectedTag);
}
```

- [ ] **Step 5: Integrate tags into local JSON**

Import `normalizeImageTemplateTags`, then add to normalized templates:

```ts
tags: normalizeImageTemplateTags(raw.tags, `template[${index}].tags`),
```

Add to stored templates:

```ts
...(template.tags?.length ? { tags: normalizeImageTemplateTags(template.tags, `template[${index}].tags`) } : {}),
```

Change `toStoredTemplate` to accept `index` so the field path is stable:

```ts
function toStoredTemplate(template: ImagePromptTemplate, index: number): ImagePromptTemplate
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/renderer/imageTemplateTags.test.ts src/renderer/localImageTemplates.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit local tag behavior**

Run:

```bash
git add src/renderer/imageTemplateTags.ts src/renderer/imageTemplateTags.test.ts src/renderer/localImageTemplates.ts src/renderer/localImageTemplates.test.ts
git commit -m "feat: normalize local image template tags"
```

## Task 7: Add the OfficeDex tag filter UI

**Files:**

- Modify: `officedex/src/renderer/screens/DialogueScreens.tsx`
- Modify: `officedex/src/renderer/screens/DialogueScreens.test.tsx`
- Modify: `officedex/src/renderer/styles/dialogue.css`
- Modify: `officedex/src/renderer/i18n/en.ts`
- Modify: `officedex/src/renderer/i18n/zh.ts`

- [ ] **Step 1: Write failing gallery filter tests**

Add a test using three templates:

```ts
it("aggregates and filters image templates by one tag", async () => {
  listImageTemplatesSpy.mockResolvedValueOnce([
    { id: 1, slug: "hero", title: "Hero", description: "", promptPreset: "hero", sortOrder: 1, enabled: true, tags: ["Ecommerce", "Studio"] },
    { id: 2, slug: "macro", title: "Macro", description: "", promptPreset: "macro", sortOrder: 2, enabled: true, tags: ["studio", "Product Detail"] },
    { id: 3, slug: "ugc", title: "UGC", description: "", promptPreset: "ugc", sortOrder: 3, enabled: true, tags: ["Social Media"] },
  ]);
  render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

  expect(await screen.findByRole("button", { name: /All.*3/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Studio.*2/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Studio.*2/i }));
  expect(screen.getByText("Hero")).toBeTruthy();
  expect(screen.getByText("Macro")).toBeTruthy();
  expect(screen.queryByText("UGC")).toBeNull();
});
```

Add a state-preservation test:

```ts
fireEvent.click(screen.getByRole("button", { name: /^Hero$/i }));
const textarea = screen.getByPlaceholderText(/Enter what you want to generate/i) as HTMLTextAreaElement;
fireEvent.change(textarea, { target: { value: "edited prompt" } });
fireEvent.click(screen.getByRole("button", { name: /Social Media.*1/i }));
expect(textarea.value).toBe("edited prompt");
expect(screen.getByText(/Template text has been inserted/i)).toBeTruthy();
```

Add this refresh-fallback test:

```ts
it("returns to All when refresh removes the selected tag", async () => {
  listImageTemplatesSpy
    .mockResolvedValueOnce([
      { id: 1, slug: "hero", title: "Hero", description: "", promptPreset: "hero", sortOrder: 1, enabled: true, tags: ["Studio"] },
    ])
    .mockResolvedValueOnce([
      { id: 2, slug: "ugc", title: "UGC", description: "", promptPreset: "ugc", sortOrder: 2, enabled: true, tags: ["Social Media"] },
    ]);
  render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

  fireEvent.click(await screen.findByRole("button", { name: /Studio.*1/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Refresh$/i }));

  expect(await screen.findByText("UGC")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: /All.*1/i })).toHaveAttribute("aria-pressed", "true"));
  expect(screen.queryByRole("button", { name: /Studio.*1/i })).toBeNull();
});
```

- [ ] **Step 2: Run the Dialogue screen tests and verify RED**

Run:

```bash
npx vitest run src/renderer/screens/DialogueScreens.test.tsx
```

Expected: filter buttons cannot be found.

- [ ] **Step 3: Add i18n strings**

Add to English:

```ts
"dialogue.imageTemplates.tags.aria": "Filter image templates by tag",
"dialogue.imageTemplates.tags.all": "All",
"dialogue.imageTemplates.tags.empty": "No image templates match this tag.",
```

Add to Chinese:

```ts
"dialogue.imageTemplates.tags.aria": "按标签筛选图片模板",
"dialogue.imageTemplates.tags.all": "全部",
"dialogue.imageTemplates.tags.empty": "该标签下暂无图片模板。",
```

- [ ] **Step 4: Implement picker state, aggregation, and filtering**

Import:

```ts
import { buildImageTemplateTagFilters, imageTemplateMatchesTag } from "../imageTemplateTags";
```

At the start of `ImageTemplatePicker` add:

```ts
const [selectedTag, setSelectedTag] = useState("");
const tagFilters = useMemo(() => buildImageTemplateTagFilters(templates), [templates]);
const visibleTemplates = useMemo(
  () => templates.filter((template) => imageTemplateMatchesTag(template, selectedTag)),
  [templates, selectedTag],
);

useEffect(() => {
  if (selectedTag && !tagFilters.some((filter) => filter.key === selectedTag)) setSelectedTag("");
}, [selectedTag, tagFilters]);
```

Build masonry columns from `visibleTemplates`, not `templates`.

Wrap the existing picker head and the optional filters in one toolbar so the gallery remains the only flexible grid row:

```tsx
<div className="image-template-picker-toolbar">
  <div className="image-template-picker-head">
    <span>{t("dialogue.imageTemplates.label")}</span>
    <div className="image-template-picker-actions">
      <button
        type="button"
        className="image-template-refresh"
        onClick={() => onRefresh()}
        disabled={loading}
        aria-label={t("dialogue.imageTemplates.refresh")}
        title={t("dialogue.imageTemplates.refresh")}
      >
        <MaterialSymbol name="refresh" />
      </button>
    </div>
  </div>
  {tagFilters.length ? (
    <div className="image-template-tag-filters" aria-label={t("dialogue.imageTemplates.tags.aria")}>
      <button type="button" className={selectedTag === "" ? "is-selected" : ""} aria-pressed={selectedTag === ""} onClick={() => setSelectedTag("")}>
        <span>{t("dialogue.imageTemplates.tags.all")}</span><b>{templates.length}</b>
      </button>
      {tagFilters.map((filter) => (
        <button type="button" key={filter.key} className={selectedTag === filter.key ? "is-selected" : ""} aria-pressed={selectedTag === filter.key} onClick={() => setSelectedTag(filter.key)}>
          <span>{filter.label}</span><b>{filter.count}</b>
        </button>
      ))}
    </div>
  ) : null}
</div>
```

Use this defensive empty branch around the complete masonry grid:

```tsx
{selectedTag && visibleTemplates.length === 0 ? (
  <div className="image-template-status">{t("dialogue.imageTemplates.tags.empty")}</div>
) : (
  <div className="image-template-grid image-template-vertical-wall">
    {templateColumns.map((column, columnIndex) => (
      <div className="image-template-masonry-column" key={columnIndex}>
        {column.map((template) => {
          const id = String(template.id);
          const selected = selectedId === id;
          return (
            <div key={id} className={`image-template-card ${selected ? "image-template-card-selected" : ""}`}>
              <button type="button" className="image-template-card-main" aria-pressed={selected} onClick={() => onSelect(template)}>
                <ImageTemplateThumbnail src={template.thumbnailUrl} />
                <strong className="image-template-card-title">{template.title}</strong>
              </button>
              {selected ? <span className="image-template-card-selected-badge">{t("dialogue.imageTemplates.selectedLabel")}</span> : null}
            </div>
          );
        })}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Style the filter row**

Add:

```css
.image-template-picker-toolbar {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.image-template-tag-filters {
  display: flex;
  min-width: 0;
  gap: 8px;
  overflow-x: auto;
  padding: 0 1px 2px;
  scrollbar-width: thin;
}

.image-template-tag-filters button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border: 1px solid var(--n-hairline);
  border-radius: var(--radius-full);
  background: var(--n-canvas);
  color: var(--n-slate);
  padding: 4px 10px;
  font: inherit;
  cursor: pointer;
}

.image-template-tag-filters button b {
  color: inherit;
  font-size: 11px;
}

.image-template-tag-filters button:hover,
.image-template-tag-filters button.is-selected {
  border-color: var(--n-primary);
  background: var(--n-primary-soft);
  color: var(--n-primary);
}
```

Keep the existing three picker rows (`scratch`, `toolbar`, and flexible gallery`). When the filter is absent, the toolbar contains only the existing heading and refresh action.

- [ ] **Step 6: Run screen and i18n tests**

Run:

```bash
npx vitest run src/renderer/screens/DialogueScreens.test.tsx src/renderer/i18n/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the filter UI**

Run:

```bash
git add src/renderer/screens/DialogueScreens.tsx src/renderer/screens/DialogueScreens.test.tsx src/renderer/styles/dialogue.css src/renderer/i18n/en.ts src/renderer/i18n/zh.ts
git commit -m "feat: filter image templates by tag"
```

## Task 8: Tag the ecommerce starter templates

**Files:**

- Modify: `officedex/examples/image-templates/ecommerce-starter.json`

- [ ] **Step 1: Run a failing artifact assertion before editing**

Run:

```bash
node -e 'const fs=require("fs");const p="examples/image-templates/ecommerce-starter.json";const x=JSON.parse(fs.readFileSync(p,"utf8"));if(x.templates.length!==12)throw new Error("expected 12 templates");for(const t of x.templates){if(!Array.isArray(t.tags)||!t.tags.includes("Ecommerce"))throw new Error(`${t.title}: missing Ecommerce tag`)}'
```

Expected: FAIL on the first template because the JSON has no `tags` fields yet.

- [ ] **Step 2: Add the approved tags**

Add these exact arrays to the corresponding template objects:

```json
"Clean Product Hero": ["Ecommerce", "Studio"],
"Lifestyle Scene": ["Ecommerce", "Lifestyle"],
"Flat Lay Arrangement": ["Ecommerce", "Studio"],
"Material Detail Macro": ["Ecommerce", "Studio", "Product Detail"],
"Model Showcase": ["Ecommerce", "Lifestyle"],
"Feature Infographic": ["Ecommerce", "Infographic"],
"Size and Specification Guide": ["Ecommerce", "Infographic"],
"Product Bundle Display": ["Ecommerce", "Studio"],
"Promotional Poster / Banner": ["Ecommerce", "Promotion"],
"Social Media Product Story": ["Ecommerce", "Lifestyle", "Social Media"],
"Authentic UGC / Customer Snapshot": ["Ecommerce", "Lifestyle", "Social Media"],
"Luxury Brand Atmosphere": ["Ecommerce", "Studio", "Premium"]
```

The labels above are a mapping reference; each actual template object receives a normal `"tags": [...]` property.

- [ ] **Step 3: Verify the complete mapping and English-only artifact**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = 'examples/image-templates/ecommerce-starter.json';
const file = JSON.parse(fs.readFileSync(path, 'utf8'));
const expected = new Map([
  ['Clean Product Hero', ['Ecommerce', 'Studio']],
  ['Lifestyle Scene', ['Ecommerce', 'Lifestyle']],
  ['Flat Lay Arrangement', ['Ecommerce', 'Studio']],
  ['Material Detail Macro', ['Ecommerce', 'Studio', 'Product Detail']],
  ['Model Showcase', ['Ecommerce', 'Lifestyle']],
  ['Feature Infographic', ['Ecommerce', 'Infographic']],
  ['Size and Specification Guide', ['Ecommerce', 'Infographic']],
  ['Product Bundle Display', ['Ecommerce', 'Studio']],
  ['Promotional Poster / Banner', ['Ecommerce', 'Promotion']],
  ['Social Media Product Story', ['Ecommerce', 'Lifestyle', 'Social Media']],
  ['Authentic UGC / Customer Snapshot', ['Ecommerce', 'Lifestyle', 'Social Media']],
  ['Luxury Brand Atmosphere', ['Ecommerce', 'Studio', 'Premium']],
]);
if (file.templates.length !== expected.size) throw new Error(`template count ${file.templates.length}`);
for (const template of file.templates) {
  const wanted = expected.get(template.title);
  if (!wanted || JSON.stringify(template.tags) !== JSON.stringify(wanted)) throw new Error(`${template.title}: ${JSON.stringify(template.tags)}`);
}
if (/\p{Script=Han}/u.test(fs.readFileSync(path, 'utf8'))) throw new Error('CJK text found');
NODE
```

Expected: exits 0 with no output.

- [ ] **Step 4: Commit the tagged starter pack**

Run:

```bash
git add examples/image-templates/ecommerce-starter.json
git commit -m "feat: tag ecommerce image templates"
```

## Task 9: Run cross-repository verification

**Files:** No new files expected. Fix only failures caused by this feature and commit each fix in the repository where it belongs.

- [ ] **Step 1: Verify OfficeCLI backend and bridge packages**

Run from the OfficeCLI worktree:

```bash
env -u GOROOT go test ./platform/internal/admin ./platform/internal/app ./platform/internal/store/sqlstore ./internal/cli -count=1
```

Expected: PASS.

- [ ] **Step 2: Verify OfficeCLI Admin**

Run:

```bash
npm --prefix platform/web/admin run lint
npm --prefix platform/web/admin run test
npm --prefix platform/web/admin run build
```

Expected: typecheck, all Vitest tests, Vite build, and Tailwind build verification pass.

- [ ] **Step 3: Verify OfficeDex focused behavior**

Run from the OfficeDex worktree:

```bash
npx vitest run src/renderer/imageTemplateTags.test.ts src/renderer/localImageTemplates.test.ts src/renderer/screens/DialogueScreens.test.tsx src/renderer/i18n/i18n.test.ts
env -u GOROOT go test ./internal/bridge -count=1
```

Expected: PASS.

- [ ] **Step 4: Verify OfficeDex release paths**

Run:

```bash
npm run lint
npm test
npm run test:go
npx vite build
UI_KIT=weboffice npx vite build
```

Expected: default Ant Design and WebOffice build-time backend paths both compile; renderer and Go tests pass.

- [ ] **Step 5: Run diff hygiene checks in both repositories**

Run:

```bash
git -C /Users/luyang/.config/superpowers/worktrees/officecli-internal/image-template-tags diff --check
git -C /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags diff --check
git -C /Users/luyang/.config/superpowers/worktrees/officecli-internal/image-template-tags status --short --branch
git -C /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags status --short --branch
```

Expected: no whitespace errors and no uncommitted feature files.

- [ ] **Step 6: Review final commit series**

Run:

```bash
git -C /Users/luyang/.config/superpowers/worktrees/officecli-internal/image-template-tags log --oneline origin/main..
git -C /Users/luyang/.config/superpowers/worktrees/officedex/image-template-tags log --oneline 9aaddca..
```

Expected OfficeCLI commits:

```text
feat: persist image template tags
feat: propagate image template tags
feat: configure image template tags in admin
```

Expected OfficeDex commits:

```text
feat: map image template tags into officedex
feat: normalize local image template tags
feat: filter image templates by tag
feat: tag ecommerce image templates
```

## Task 10: Prepare completion options

**Files:** None.

- [ ] **Step 1: Read and follow the branch-finishing skill**

Run:

```bash
sed -n '1,320p' /Users/luyang/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/finishing-a-development-branch/SKILL.md
```

Expected: present verified integration choices without merging, pushing, or deleting worktrees unless the user authorizes that action.

- [ ] **Step 2: Report the two-repository result**

The handoff must include:

- OfficeCLI and OfficeDex branch names and worktree paths.
- Exact verification commands and outcomes.
- Migration number `039` and the tag limits.
- The tagged 12-template JSON artifact path.
- Any baseline failures clearly separated from feature regressions.
- Options to merge locally, push/create PRs, retain branches, or clean up.
