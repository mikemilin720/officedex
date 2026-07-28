import type { ImagePromptSlot, ImagePromptTemplate } from "../shared/types";
import { normalizeImageTemplateTags } from "./imageTemplateTags";

const STORAGE_KEY = "officedex:local-image-templates";
const FILE_VERSION = 1;
const LOCAL_ID_BASE = -1;

type RawTemplate = Record<string, unknown>;

interface LocalImageTemplatesFile {
  version: number;
  templates: ImagePromptTemplate[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadLocalImageTemplates(): ImagePromptTemplate[] {
  const store = storage();
  const raw = store?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return importLocalImageTemplatesJSON(raw);
  } catch {
    return [];
  }
}

export function saveLocalImageTemplates(templates: ImagePromptTemplate[]): void {
  const store = storage();
  if (!store) return;
  store.setItem(STORAGE_KEY, exportLocalImageTemplatesJSON(templates));
}

export function importLocalImageTemplatesJSON(raw: string): ImagePromptTemplate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rawTemplates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { templates?: unknown }).templates)
      ? (parsed as { templates: unknown[] }).templates
      : null;
  if (!rawTemplates) throw new Error("Local template JSON must be an array or an object with a templates array.");

  return rawTemplates.map((item, index) => normalizeTemplate(item, index));
}

export function exportLocalImageTemplatesJSON(templates: ImagePromptTemplate[]): string {
  const file: LocalImageTemplatesFile = {
    version: FILE_VERSION,
    templates: templates.map((template, index) => toStoredTemplate(normalizeTemplate(template, index), index)),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function normalizeTemplate(item: unknown, index: number): ImagePromptTemplate {
  if (typeof item !== "object" || item === null) {
    throw new Error(`template[${index}] must be an object.`);
  }
  const raw = item as RawTemplate;
  const title = stringValue(raw.title).trim();
  const promptPreset = stringValue(raw.promptPreset ?? raw.prompt_preset).trim();
  const slug = slugify(stringValue(raw.slug).trim() || title);
  if (!title) throw new Error(`template[${index}].title is required.`);
  if (!promptPreset) throw new Error(`template[${index}].promptPreset is required.`);

  return {
    id: LOCAL_ID_BASE - index,
    slug,
    title,
    description: stringValue(raw.description).trim(),
    promptPreset,
    thumbnailUrl: stringValue(raw.thumbnailUrl ?? raw.thumbnail_url).trim() || undefined,
    sortOrder: numberValue(raw.sortOrder ?? raw.sort_order, index),
    enabled: booleanValue(raw.enabled, true),
    visibility: "local",
    tags: normalizeImageTemplateTags(raw.tags, `template[${index}].tags`),
    slots: normalizeSlots(raw.slots),
  };
}

function normalizeSlots(raw: unknown): ImagePromptSlot[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const seen = new Set<string>();
  return raw.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`slot[${index}] must be an object.`);
    }
    const slot = item as RawTemplate;
    const key = stringValue(slot.key).trim();
    const label = stringValue(slot.label).trim();
    if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`slot key "${key}" must match ^[a-z0-9_]+$.`);
    if (seen.has(key)) throw new Error(`slot key "${key}" is duplicated.`);
    if (!label) throw new Error(`slot "${key}" label is required.`);
    seen.add(key);
    return {
      key,
      label,
      defaultValue: stringValue(slot.defaultValue ?? slot.default_value).trim() || undefined,
      helpText: stringValue(slot.helpText ?? slot.help_text).trim() || undefined,
      required: booleanValue(slot.required, false),
      multiline: booleanValue(slot.multiline, false),
    };
  });
}

function toStoredTemplate(template: ImagePromptTemplate, index: number): ImagePromptTemplate {
  return {
    slug: template.slug,
    title: template.title,
    description: template.description,
    promptPreset: template.promptPreset,
    sortOrder: template.sortOrder,
    enabled: template.enabled,
    ...(template.thumbnailUrl ? { thumbnailUrl: template.thumbnailUrl } : {}),
    ...(template.tags?.length ? { tags: normalizeImageTemplateTags(template.tags, `template[${index}].tags`) } : {}),
    ...(template.slots?.length ? { slots: toStoredSlots(template.slots) } : {}),
  } as ImagePromptTemplate;
}

function toStoredSlots(slots: ImagePromptSlot[]): ImagePromptSlot[] {
  return slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    ...(slot.defaultValue ? { defaultValue: slot.defaultValue } : {}),
    ...(slot.helpText ? { helpText: slot.helpText } : {}),
    ...(slot.required ? { required: slot.required } : {}),
    ...(slot.multiline ? { multiline: slot.multiline } : {}),
  }));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "local-image-template";
}
