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
