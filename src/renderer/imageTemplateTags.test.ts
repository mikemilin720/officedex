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
