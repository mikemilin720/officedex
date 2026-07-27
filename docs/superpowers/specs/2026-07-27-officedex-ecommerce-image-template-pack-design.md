# OfficeDex Ecommerce Image Template Pack Design

**Date:** 2026-07-27

## Goal

Create a starter pack of 12 high-frequency ecommerce image-generation templates that users can import directly into OfficeDex as local image templates.

The pack is inspired by the scene taxonomy and practical ecommerce prompt guidance in `liangdabiao/ecom-details-image`, but its prompt text and OfficeDex field structure will be newly written. The reference repository does not expose an explicit license file, so this work must not copy its template prompts verbatim.

## Confirmed Scope

- Deliver 12 curated templates rather than adapting all 25 reference scenes.
- Focus on ecommerce product imagery rather than general-purpose marketing design.
- Deliver an OfficeDex local-template JSON pack; do not publish platform templates.
- Use Chinese titles, descriptions, field labels, and documentation.
- Use English `promptPreset` content.
- Do not include thumbnail URLs or generated cover images in the first release.
- Do not modify the OfficeDex template UI, storage format, server API, or publishing workflow.

## Template Catalog

### Product presentation

1. 白底商品主图
2. 生活方式场景
3. 平铺俯拍陈列
4. 材质细节特写
5. 模特上身展示

### Benefits and conversion

6. 核心卖点信息图
7. 尺寸规格说明
8. 套装组合展示
9. 促销海报 / Banner

### Social and brand distribution

10. 社媒种草内容
11. 真实 UGC / 买家秀
12. 轻奢品牌氛围

The first pack intentionally excludes before-and-after claims, livestream screenshots, virtual try-on, exploded technical views, ghost mannequins, storefronts, seasonal grids, and other narrower or higher-risk scenes.

## Artifact Layout

Add two user-facing files:

- `examples/image-templates/ecommerce-starter.json`
- `examples/image-templates/README.zh-CN.md`

The JSON file will use the existing OfficeDex local-template envelope:

```json
{
  "version": 1,
  "templates": []
}
```

Each template will provide:

- a stable `ecom-*` slug;
- a Chinese title and concise Chinese description;
- a newly written English `promptPreset`;
- three to six guided slots;
- a unique sort order in increments of 10;
- `enabled: true`;
- no `thumbnailUrl`.

## Field Design

Each template exposes only inputs that materially change the requested image. Photography mechanics that should remain stable are embedded in the prompt instead of exposed as user fields.

Common field families include:

- `product_description` as the main required product input;
- scene or context fields such as `scene`, `target_audience`, or `use_context`;
- content fields such as `key_benefits`, `headline`, or `cta` only where visible copy is appropriate;
- visual direction fields such as `brand_colors`, `background_color`, or `mood` where they provide meaningful control.

Field labels and help text are Chinese. Slot keys use lowercase ASCII and underscores and must match `^[a-z0-9_]+$`.

The image aspect ratio remains controlled by the existing OfficeDex ratio selector and is not duplicated as a template slot. Reference images remain optional, but every template description or the pack documentation will recommend uploading a real product image when product identity, packaging, color, structure, or labeling must remain accurate.

## Prompt Structure

Every English prompt follows the same order:

1. Product identity and image purpose.
2. Scene and composition.
3. Product scale and whitespace.
4. Lighting, materials, and texture rendering.
5. Visible text rules when relevant.
6. Commercial output requirements.
7. Specific negative constraints.

Stable constraints such as product scale, whitespace, lighting direction, realism, and prohibited artifacts are written directly into the prompt. Users should not need to understand professional photography terminology to use the templates.

Templates must avoid:

- unsupported performance, medical, or certification claims;
- fabricated review text, platform UI, ratings, or user identities;
- invented logos, watermarks, badges, or product variants;
- unnecessary references to named brands, publications, or campaign styles;
- vague quality inflation such as `8K`, `award-winning`, or `Vogue-quality` when it does not improve controllability.

All templates instruct the model to preserve the reference product's packaging, colors, proportions, structure, and visible markings when a reference image is provided.

The UGC template may request phone-camera noise, imperfect framing, natural skin or environmental detail, and a lived-in setting. It must not create fake testimonials, account names, platform chrome, review scores, or implied endorsements.

## Campaign Consistency

The reference project uses a Campaign Style Lock for multi-image sets. This starter pack does not add cross-template state or a campaign-pack workflow because OfficeDex local templates currently represent independent image prompts.

Relevant templates will use consistent slot names for brand colors, audience, and visual direction so users can manually reuse the same values across several images. A future campaign feature can build on those shared concepts without changing this pack's import format.

## Import Flow

The README will direct users through:

1. Open OfficeDex Settings.
2. Find Local Image Templates.
3. Import `ecommerce-starter.json`.
4. Open image generation and select a local template.
5. Fill the guided fields, choose an OfficeDex image ratio, and optionally attach a product reference image.

Imported local templates should appear ahead of platform templates according to the existing OfficeDex behavior.

## Validation

The implementation will verify that:

- the pack parses as JSON and has `version: 1`;
- it contains exactly 12 templates;
- every slug and sort order is unique;
- every template has a non-empty title, description, and prompt preset;
- every slot key matches `^[a-z0-9_]+$` and is unique within its template;
- every `{{slot}}` marker has a corresponding slot definition;
- every defined slot is used in the prompt;
- no legacy single-brace placeholders remain;
- no template contains a thumbnail or external asset dependency;
- the full file is accepted by OfficeDex's existing `importLocalImageTemplatesJSON()` implementation.

Content assembly will be spot-checked for three representative templates:

- 白底商品主图;
- 核心卖点信息图;
- 真实 UGC / 买家秀.

The rendered prompts must contain the supplied values, contain no unresolved double-brace markers, preserve the intended product-consistency instruction, and end with concrete negative constraints.

## Repository Safety

The current OfficeDex checkout already has an unrelated `package-lock.json` modification. The template work and its commits must not overwrite or include that file. Browser brainstorming artifacts under `.superpowers/` are working notes and must not be included in product commits.

## Success Criteria

The work is complete when a user can import the JSON pack into the current OfficeDex local-template settings, see all 12 enabled templates, select any template, fill a small guided form, and obtain a complete English prompt without unresolved placeholders or external dependencies.
