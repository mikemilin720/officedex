import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImagePromptTemplate } from "../shared/types";
import {
  exportLocalImageTemplatesJSON,
  importLocalImageTemplatesJSON,
  loadLocalImageTemplates,
  saveLocalImageTemplates,
} from "./localImageTemplates";

describe("local image templates", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("imports slotted templates from versioned JSON and assigns local ids", () => {
    const imported = importLocalImageTemplatesJSON(JSON.stringify({
      version: 1,
      templates: [
        {
          slug: "admission-letter",
          title: "Admission Letter",
          description: "Local admission template",
          prompt_preset: "Show {{university_name}}",
          enabled: true,
          slots: [
            { key: "university_name", label: "University name", required: true },
          ],
        },
      ],
    }));

    expect(imported).toEqual([
      expect.objectContaining({
        id: -1,
        slug: "admission-letter",
        title: "Admission Letter",
        description: "Local admission template",
        promptPreset: "Show {{university_name}}",
        sortOrder: 0,
        enabled: true,
        visibility: "local",
        slots: [
          expect.objectContaining({ key: "university_name", label: "University name", required: true }),
        ],
      }),
    ]);
  });

  it("persists and exports a stable local-template JSON file", () => {
    const templates: ImagePromptTemplate[] = [
      {
        id: -1,
        slug: "local-poster",
        title: "Local Poster",
        description: "Stored locally",
        promptPreset: "Poster prompt",
        sortOrder: 0,
        enabled: true,
        visibility: "local",
      },
    ];

    saveLocalImageTemplates(templates);

    expect(loadLocalImageTemplates()).toEqual(templates);
    expect(JSON.parse(exportLocalImageTemplatesJSON(templates))).toEqual({
      version: 1,
      templates: [
        {
          slug: "local-poster",
          title: "Local Poster",
          description: "Stored locally",
          promptPreset: "Poster prompt",
          sortOrder: 0,
          enabled: true,
        },
      ],
    });
  });

  it("rejects malformed local-template JSON before replacing stored templates", () => {
    saveLocalImageTemplates([
      {
        id: -1,
        slug: "existing",
        title: "Existing",
        description: "",
        promptPreset: "Keep me",
        sortOrder: 0,
        enabled: true,
        visibility: "local",
      },
    ]);

    expect(() => importLocalImageTemplatesJSON(`{"templates":[{"slug":"bad","title":"Bad"}]}`))
      .toThrow(/prompt/i);
    expect(loadLocalImageTemplates()).toEqual([
      expect.objectContaining({ slug: "existing", promptPreset: "Keep me" }),
    ]);
  });
});
