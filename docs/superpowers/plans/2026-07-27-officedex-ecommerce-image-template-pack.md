# OfficeDex Ecommerce Image Template Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a directly importable OfficeDex local-template JSON pack containing 12 curated ecommerce image-generation templates with guided Chinese fields and newly written English prompts.

**Architecture:** Keep the feature entirely within the existing local-template contract: a versioned JSON file is parsed by `importLocalImageTemplatesJSON()` and rendered by the current guided-slot UI. Add a focused Vitest contract test for schema, marker coverage, import compatibility, and representative prompt assembly, plus a Chinese usage guide; do not change renderer, bridge, server, or package metadata.

**Tech Stack:** JSON, Markdown, TypeScript, Vitest, existing OfficeDex `importLocalImageTemplatesJSON()` and `assembleSlots()` helpers.

---

## File Structure

- Create `examples/image-templates/ecommerce-starter.json`: the user-importable pack and its 12 templates.
- Create `examples/image-templates/README.zh-CN.md`: import instructions, catalog, reference-image guidance, and usage boundaries.
- Create `src/renderer/ecommerceImageTemplatePack.test.ts`: pack schema, import, slot-marker, and representative prompt-assembly regression tests.

No application source, `package.json`, `package-lock.json`, backend code, or platform template data changes are required.

### Task 1: Define the pack contract with a failing test

**Files:**
- Create: `src/renderer/ecommerceImageTemplatePack.test.ts`

- [ ] **Step 1: Create the contract test**

Create `src/renderer/ecommerceImageTemplatePack.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ImagePromptSlot } from "../shared/types";
import { importLocalImageTemplatesJSON } from "./localImageTemplates";
import { assembleSlots } from "./screens/DialogueScreens";

interface PackTemplate {
  slug: string;
  title: string;
  description: string;
  promptPreset: string;
  sortOrder: number;
  enabled: boolean;
  thumbnailUrl?: string;
  slots: ImagePromptSlot[];
}

interface TemplatePack {
  version: number;
  templates: PackTemplate[];
}

const packSource = readFileSync("examples/image-templates/ecommerce-starter.json", "utf8");
const pack = JSON.parse(packSource) as TemplatePack;

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

describe("ecommerce starter image-template pack", () => {
  it("matches the local-template schema and imports all 12 templates", () => {
    expect(pack.version).toBe(1);
    expect(pack.templates).toHaveLength(12);

    const slugs = pack.templates.map((template) => template.slug);
    const sortOrders = pack.templates.map((template) => template.sortOrder);
    expect(new Set(slugs).size).toBe(12);
    expect(new Set(sortOrders).size).toBe(12);

    for (const template of pack.templates) {
      expect(template.slug).toMatch(/^ecom-[a-z0-9-]+$/);
      expect(template.title.trim()).not.toBe("");
      expect(template.description.trim()).not.toBe("");
      expect(template.promptPreset.trim()).not.toBe("");
      expect(template.enabled).toBe(true);
      expect(template).not.toHaveProperty("thumbnailUrl");
      expect(template.slots.length).toBeGreaterThanOrEqual(3);
      expect(template.slots.length).toBeLessThanOrEqual(6);

      const slotKeys = template.slots.map((slot) => slot.key);
      expect(new Set(slotKeys).size).toBe(slotKeys.length);
      for (const slot of template.slots) {
        expect(slot.key).toMatch(/^[a-z0-9_]+$/);
        expect(slot.label.trim()).not.toBe("");
      }

      const markerKeys = new Set(
        [...template.promptPreset.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((match) => match[1]),
      );
      expect(sorted(markerKeys)).toEqual(sorted(slotKeys));
      expect(template.promptPreset).not.toMatch(/(^|[^\{])\{[a-z0-9_]+\}([^\}]|$)/);
    }

    const imported = importLocalImageTemplatesJSON(packSource);
    expect(imported).toHaveLength(12);
    expect(imported.map((template) => template.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => -1 - index),
    );
    expect(imported.every((template) => template.visibility === "local")).toBe(true);
  });

  it.each([
    ["ecom-clean-hero", { product_description: "a matte black travel mug", background_color: "#FFFFFF", camera_angle: "front three-quarter view" }],
    ["ecom-feature-infographic", { product_description: "a compact air purifier", headline: "Cleaner air, less effort", key_benefits: "Quiet operation; washable filter; room coverage", brand_colors: "#F5F1E8, #2D2D2D, #4E7A65" }],
    ["ecom-authentic-ugc", { product_description: "a refillable hand cream tube", creator_context: "a commuter getting ready for work", use_moment: "applying the product beside a hallway mirror", camera_character: "recent smartphone main camera, slight warm cast, fine visible noise" }],
  ])("assembles %s without unresolved markers", (slug, values) => {
    const template = importLocalImageTemplatesJSON(packSource).find((item) => item.slug === slug);
    expect(template).toBeDefined();

    const prompt = assembleSlots(template!.promptPreset, template!.slots ?? [], values);
    expect(prompt).not.toContain("{{");
    expect(prompt).toMatch(/preserve the reference product's packaging, colors, proportions, structure, and visible markings/i);
    expect(prompt).toContain("Do not add:");
    for (const value of Object.values(values)) expect(prompt).toContain(value);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing pack fails**

Run:

```bash
npx vitest run src/renderer/ecommerceImageTemplatePack.test.ts
```

Expected: FAIL before tests are collected with `ENOENT` for `examples/image-templates/ecommerce-starter.json`.

### Task 2: Add the 12-template import pack

**Files:**
- Create: `examples/image-templates/ecommerce-starter.json`
- Test: `src/renderer/ecommerceImageTemplatePack.test.ts`

- [ ] **Step 1: Create the template directory**

Run:

```bash
mkdir -p examples/image-templates
```

Expected: directory exists and no tracked file has changed yet.

- [ ] **Step 2: Create the JSON pack**

Create `examples/image-templates/ecommerce-starter.json` with exactly this content:

```json
{
  "version": 1,
  "templates": [
    {
      "slug": "ecom-clean-hero",
      "title": "白底商品主图",
      "description": "生成干净、聚焦的电商首图。建议上传真实产品参考图以保持包装、颜色与结构准确。",
      "promptPreset": "Create a clean ecommerce hero image of {{product_description}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Show the product from a {{camera_angle}}, centered and fully visible, occupying 35–40% of the frame against a solid {{background_color}} background. Use soft diffused studio lighting, natural contact shadows, crisp material detail, and at least 45% clean negative space. Keep the composition platform-ready and visually balanced. Do not add: props, hands, people, invented packaging, changed colors, fake logos, watermarks, text, badges, gradients, reflections that hide details, or cropped product edges.",
      "sortOrder": 10,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "helpText": "写清产品类型、材质、颜色和关键外观。", "required": true, "multiline": true },
        { "key": "background_color", "label": "背景颜色", "defaultValue": "#FFFFFF", "helpText": "建议填写明确的 HEX 色值。", "required": true },
        { "key": "camera_angle", "label": "拍摄角度", "defaultValue": "front three-quarter view", "required": true }
      ]
    },
    {
      "slug": "ecom-lifestyle-scene",
      "title": "生活方式场景",
      "description": "把商品自然放入真实使用环境，突出目标人群、情绪和生活方式。",
      "promptPreset": "Create a believable lifestyle ecommerce photograph featuring {{product_description}} in {{scene}} for {{target_audience}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Make the product naturally integrated but clearly identifiable, occupying about 20–25% of the frame, with at least 50% visual breathing room. Use natural directional light and a {{mood}} atmosphere with realistic surfaces, shadows, and lived-in details. The scene should communicate use and aspiration without looking staged. Do not add: unrelated products, fake logos, watermarks, promotional text, impossible reflections, duplicated objects, distorted hands, or changes to the product design.",
      "sortOrder": 20,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "scene", "label": "使用场景", "helpText": "例如晨间浴室、通勤桌面、周末露营。", "required": true, "multiline": true },
        { "key": "target_audience", "label": "目标人群", "defaultValue": "the intended everyday customer", "required": true },
        { "key": "mood", "label": "氛围", "defaultValue": "warm, natural, and trustworthy", "required": true }
      ]
    },
    {
      "slug": "ecom-flat-lay",
      "title": "平铺俯拍陈列",
      "description": "适合服饰、美妆、配饰和轻量套装的整洁俯拍构图。",
      "promptPreset": "Create a top-down flat-lay ecommerce photograph of {{product_description}} arranged with {{supporting_props}} on {{surface}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use the fixed palette {{brand_colors}}, soft window light from the upper left, restrained contact shadows, and a clean editorial rhythm. Keep the main product dominant but below 35% of the frame and preserve at least 45% negative space. Do not add: excessive props, unrelated brands, fake labels, watermarks, extra text, repeated products, distorted geometry, clutter, or glossy glare that hides product details.",
      "sortOrder": 30,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "supporting_props", "label": "辅助道具", "defaultValue": "two or three category-relevant props", "required": true, "multiline": true },
        { "key": "surface", "label": "平铺表面", "defaultValue": "a matte warm off-white surface", "required": true },
        { "key": "brand_colors", "label": "品牌配色", "defaultValue": "#F5F1E8, #2D2D2D, and one product-matched accent color", "required": true }
      ]
    },
    {
      "slug": "ecom-material-macro",
      "title": "材质细节特写",
      "description": "用微距视角展示面料、纹理、工艺、表面处理或关键结构。",
      "promptPreset": "Create a commercial macro photograph of {{product_description}}, focused tightly on {{focus_area}} and clearly revealing {{material_texture}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use {{lighting_style}} to reveal real texture, edge quality, stitching, grain, finish, or construction without exaggeration. Keep the focal plane precise, the background quiet, and enough negative space for a clean ecommerce crop. Do not add: invented materials, fake defects, impossible microstructure, text, labels, measurement marks, watermarks, dust, fingerprints, excessive sharpening, or changes to the product's actual construction.",
      "sortOrder": 40,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "focus_area", "label": "特写部位", "helpText": "例如织物纹理、瓶盖工艺、金属接口。", "required": true },
        { "key": "material_texture", "label": "材质与纹理", "required": true, "multiline": true },
        { "key": "lighting_style", "label": "光线方式", "defaultValue": "soft raking side light with controlled highlights", "required": true }
      ]
    },
    {
      "slug": "ecom-model-showcase",
      "title": "模特上身展示",
      "description": "展示服装、配饰、美妆或穿戴商品在真人身上的自然效果。",
      "promptPreset": "Create a refined ecommerce model photograph of {{model_description}} naturally wearing or using {{product_description}} in {{setting}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use a {{expression}} expression, realistic posture, natural skin and fabric texture, and soft directional light. Keep the product clearly visible and faithful in scale, fit, placement, and material response, with generous uncluttered space around the subject. Do not add: altered garment cuts, invented accessories, fake logos, watermarks, text, beauty-filter skin, impossible anatomy, duplicated fingers, distorted product placement, or unrelated props.",
      "sortOrder": 50,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "model_description", "label": "模特描述", "helpText": "描述年龄段、整体气质和与产品相关的必要特征。", "required": true, "multiline": true },
        { "key": "setting", "label": "拍摄环境", "defaultValue": "a minimal neutral studio", "required": true },
        { "key": "expression", "label": "神态", "defaultValue": "relaxed, confident, and natural", "required": true }
      ]
    },
    {
      "slug": "ecom-feature-infographic",
      "title": "核心卖点信息图",
      "description": "将产品与 2–4 个核心利益点组合成结构清晰的电商详情页信息图。",
      "promptPreset": "Create a mobile-friendly ecommerce feature infographic for {{product_description}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use the headline “{{headline}}” and present only these supplied benefits: {{key_benefits}}. Use the fixed palette {{brand_colors}}, a clean geometric layout, consistent thin-line icons, and clear three-level information hierarchy. Keep the product at 25–30% of the frame, leave at least 45% open space, and make all supplied text large and legible. Do not add: invented claims, ratings, certifications, statistics, review quotes, extra benefits, fake logos, watermarks, decorative clutter, tiny unreadable copy, or unsupported comparison data.",
      "sortOrder": 60,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "headline", "label": "主标题", "helpText": "建议控制在 15 个字以内。", "required": true },
        { "key": "key_benefits", "label": "核心卖点", "helpText": "填写 2–4 个有依据的短卖点。", "required": true, "multiline": true },
        { "key": "brand_colors", "label": "品牌配色", "defaultValue": "#F5F1E8, #2D2D2D, and one product-matched accent color", "required": true }
      ]
    },
    {
      "slug": "ecom-size-spec-guide",
      "title": "尺寸规格说明",
      "description": "把真实尺寸、规格或使用步骤整理成简洁、可信的说明图。",
      "promptPreset": "Create a clean ecommerce specification guide for {{product_description}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Show only these supplied dimensions or specifications: {{dimensions}}. Include only these supplied usage steps where space allows: {{usage_steps}}. Use the palette {{brand_colors}}, precise leader lines, simple labels, consistent spacing, and a calm technical layout with at least 45% negative space. Do not add: invented measurements, unsupported compatibility, certifications, fake logos, watermarks, extra steps, decorative icons with ambiguous meaning, distorted scale, or illegible small text.",
      "sortOrder": 70,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "dimensions", "label": "尺寸或规格", "helpText": "只填写已经确认的真实数据。", "required": true, "multiline": true },
        { "key": "usage_steps", "label": "使用步骤", "defaultValue": "no usage steps; focus on dimensions and specifications", "multiline": true },
        { "key": "brand_colors", "label": "品牌配色", "defaultValue": "#FFFFFF, #2D2D2D, and one product-matched accent color", "required": true }
      ]
    },
    {
      "slug": "ecom-product-bundle",
      "title": "套装组合展示",
      "description": "清楚展示礼盒、组合装、多 SKU 或搭配销售内容。",
      "promptPreset": "Create a polished ecommerce bundle photograph of {{product_set_description}} arranged as {{arrangement}} against {{background_color}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Make every included item clearly visible, correctly scaled, and easy to count. Let the full set occupy about 55–65% of the frame while keeping at least 35% clean breathing room. Use soft controlled studio light and {{accent_elements}} as restrained support. Do not add: duplicate items, missing items, invented variants, changed packaging, fake logos, watermarks, text, price tags, excessive props, overlapping labels, or cropped products.",
      "sortOrder": 80,
      "enabled": true,
      "slots": [
        { "key": "product_set_description", "label": "套装内容", "helpText": "逐项写清产品数量、规格和颜色。", "required": true, "multiline": true },
        { "key": "arrangement", "label": "陈列方式", "defaultValue": "a balanced stepped composition with the hero item centered", "required": true },
        { "key": "background_color", "label": "背景颜色", "defaultValue": "#F5F1E8", "required": true },
        { "key": "accent_elements", "label": "辅助元素", "defaultValue": "one or two subtle category-relevant accent elements", "required": true }
      ]
    },
    {
      "slug": "ecom-promo-poster",
      "title": "促销海报 / Banner",
      "description": "生成包含商品、短标题、优惠信息和行动按钮的促销视觉。",
      "promptPreset": "Create a conversion-focused ecommerce promotional poster featuring {{product_description}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use the fixed palette {{brand_colors}} and render only this supplied copy: headline “{{headline}}”, offer “{{offer_text}}”, and CTA “{{cta}}”. Keep the product around 40% of the frame, preserve at least 45% clean negative space, and reserve a clear top-center overlay area. Use strong hierarchy, restrained graphic shapes, and commercial studio lighting. Do not add: invented discounts, dates, prices, claims, badges, reviews, fake logos, watermarks, extra copy, unreadable text, random gradients, or changes to the product design.",
      "sortOrder": 90,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "headline", "label": "促销标题", "helpText": "建议控制在 15 个字以内。", "required": true },
        { "key": "offer_text", "label": "优惠信息", "defaultValue": "no offer text", "required": true },
        { "key": "cta", "label": "行动按钮", "defaultValue": "Shop now", "required": true },
        { "key": "brand_colors", "label": "品牌配色", "defaultValue": "#FFFFFF, #2D2D2D, and one bold product-matched accent color", "required": true }
      ]
    },
    {
      "slug": "ecom-social-seeding",
      "title": "社媒种草内容",
      "description": "生成适合社交信息流的真实、清晰、有内容角度的产品视觉。",
      "promptPreset": "Create a native-looking {{platform_context}} featuring {{product_description}} with the content angle {{content_angle}} in {{setting}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use believable available light, a slightly off-center composition, real environmental texture, and enough negative space for platform cropping. Keep the product immediately recognizable without making the image feel like a studio catalog shot. Do not add: platform interface, account names, engagement counts, fake reviews, invented claims, fake logos, watermarks, extra products, beauty-filter smoothing, impossible hands, or overly polished advertising effects.",
      "sortOrder": 100,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "platform_context", "label": "平台画面类型", "defaultValue": "vertical social feed post", "required": true },
        { "key": "content_angle", "label": "内容角度", "helpText": "例如通勤必备、开箱体验、桌面好物。", "required": true, "multiline": true },
        { "key": "setting", "label": "拍摄环境", "defaultValue": "a believable everyday environment relevant to the product", "required": true, "multiline": true }
      ]
    },
    {
      "slug": "ecom-authentic-ugc",
      "title": "真实 UGC / 买家秀",
      "description": "模拟自然手机抓拍感，但不生成虚假评价、账号、评分或平台界面。",
      "promptPreset": "Create an authentic UGC-style snapshot of {{product_description}} showing {{creator_context}} during {{use_moment}}. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use {{camera_character}}, slightly imperfect framing, natural skin or surface texture, mixed practical lighting, and a believable lived-in environment. The image should feel candid and unretouched, not like professional studio photography. Do not add: testimonial text, usernames, platform interface, ratings, review scores, endorsements, invented claims, fake logos, watermarks, duplicated fingers, beauty-filter skin, staged luxury props, or changes to the product.",
      "sortOrder": 110,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "creator_context", "label": "人物与情境", "helpText": "例如准备出门的通勤者、整理书桌的学生。", "required": true, "multiline": true },
        { "key": "use_moment", "label": "使用瞬间", "required": true, "multiline": true },
        { "key": "camera_character", "label": "手机拍摄质感", "defaultValue": "recent smartphone main camera, slight warm cast, fine visible noise", "required": true }
      ]
    },
    {
      "slug": "ecom-luxury-atmosphere",
      "title": "轻奢品牌氛围",
      "description": "用克制的深色棚拍、材质光泽和留白强化高端商品质感。",
      "promptPreset": "Create a restrained luxury ecommerce photograph of {{product_description}} on {{surface}} against a deep {{background_color}} background. If a reference image is provided, preserve the reference product's packaging, colors, proportions, structure, and visible markings exactly. Use {{accent_color}} as the single accent, controlled rim light, soft ambient fill, precise material reflections, and {{atmosphere}}. Keep the product near 30% of the frame with at least 50% negative space and a calm premium composition. Do not add: excessive smoke, floating objects, gemstones, fake logos, watermarks, text, badges, invented packaging, harsh glare, crushed shadow detail, random colors, or changes to the product design.",
      "sortOrder": 120,
      "enabled": true,
      "slots": [
        { "key": "product_description", "label": "产品描述", "required": true, "multiline": true },
        { "key": "surface", "label": "承托材质", "defaultValue": "polished dark stone", "required": true },
        { "key": "background_color", "label": "背景颜色", "defaultValue": "#121212", "required": true },
        { "key": "accent_color", "label": "强调色", "defaultValue": "#D4AF37", "required": true },
        { "key": "atmosphere", "label": "氛围细节", "defaultValue": "a subtle controlled haze and one restrained organic accent", "required": true }
      ]
    }
  ]
}
```

- [ ] **Step 3: Run the contract test**

Run:

```bash
npx vitest run src/renderer/ecommerceImageTemplatePack.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 4: Commit the tested template pack**

Run:

```bash
git add examples/image-templates/ecommerce-starter.json src/renderer/ecommerceImageTemplatePack.test.ts
git commit -m "feat: add ecommerce image template starter pack"
```

Expected: commit includes only the JSON pack and its focused contract test.

### Task 3: Document importing and using the pack

**Files:**
- Create: `examples/image-templates/README.zh-CN.md`

- [ ] **Step 1: Write the Chinese usage guide**

Create `examples/image-templates/README.zh-CN.md` with:

```markdown
# OfficeDex 电商生图模板入门包

`ecommerce-starter.json` 包含 12 个可直接导入 OfficeDex 的本地图片模板。模板标题、说明和填写字段为中文，最终交给图片模型的提示词为英文。

## 导入

1. 打开 OfficeDex 设置。
2. 进入“本地图片模板”。
3. 点击“导入 JSON”。
4. 选择本目录中的 `ecommerce-starter.json`。
5. 返回 AI 生图页面，从本地模板列表中选择模板。

导入不会发布到公共模板库，模板仅保存在当前设备。再次导入同一文件时，请先确认是否需要保留之前自行修改过的本地模板。

## 模板清单

| 分类 | 模板 |
| --- | --- |
| 商品展示 | 白底商品主图、生活方式场景、平铺俯拍陈列、材质细节特写、模特上身展示 |
| 卖点与转化 | 核心卖点信息图、尺寸规格说明、套装组合展示、促销海报 / Banner |
| 社媒与品牌 | 社媒种草内容、真实 UGC / 买家秀、轻奢品牌氛围 |

## 使用建议

- 有真实商品图时优先作为参考图上传，尤其是包装、颜色、结构、标签或服装版型必须准确的任务。
- 图片比例由 OfficeDex 生图页面单独选择，不需要写进模板字段。
- 品牌色优先填写明确的 HEX 色值，例如 `#FFFFFF`、`#2D2D2D`、`#D4AF37`。
- 标题尽量控制在 15 个字以内，CTA 尽量控制在 8 个字以内。
- 信息图、规格图和促销图只填写已经确认的数据，不要让模型编造认证、尺寸、折扣、评价或功效。
- 连续生成一组图片时，在多个模板中重复使用相同的品牌色、受众和视觉方向，以减少风格漂移。

## 内容边界

本模板包不会主动生成虚假评价、账号、评分、平台界面、认证徽章、医疗或功效承诺。需要文字的模板只要求模型渲染用户明确填写的标题、卖点、优惠信息或 CTA。

本模板包参考了 `liangdabiao/ecom-details-image` 的场景分类与电商视觉经验，但提示词和 OfficeDex 字段结构均为重新设计，没有复制参考仓库的模板文本。
```

- [ ] **Step 2: Check documentation formatting**

Run:

```bash
git diff --check -- examples/image-templates/README.zh-CN.md
```

Expected: exit code 0 and no output.

- [ ] **Step 3: Commit the usage guide**

Run:

```bash
git add examples/image-templates/README.zh-CN.md
git commit -m "docs: explain ecommerce image template pack"
```

Expected: commit includes only the Chinese guide.

### Task 4: Run final verification and inspect repository safety

**Files:**
- Verify: `examples/image-templates/ecommerce-starter.json`
- Verify: `examples/image-templates/README.zh-CN.md`
- Verify: `src/renderer/ecommerceImageTemplatePack.test.ts`

- [ ] **Step 1: Run the focused template tests**

Run:

```bash
npx vitest run src/renderer/ecommerceImageTemplatePack.test.ts src/renderer/localImageTemplates.test.ts
```

Expected: all tests in both files PASS.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Run whitespace and JSON checks**

Run:

```bash
git diff --check HEAD~2..HEAD
node -e 'const p=require("./examples/image-templates/ecommerce-starter.json"); if(p.version!==1||p.templates.length!==12) process.exit(1); console.log(`verified ${p.templates.length} templates`)'
```

Expected: no `git diff --check` output, followed by `verified 12 templates`.

- [ ] **Step 4: Confirm unrelated workspace state remains untouched**

Run:

```bash
git status --short --branch
git log -3 --oneline
```

Expected: the pre-existing `package-lock.json` modification remains unstaged and unchanged; `.superpowers/` remains untracked; the two implementation commits appear above the design and plan commits.
