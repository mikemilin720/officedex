import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PptxViewer from "./PptxViewer";

vi.mock("../../bridge", () => ({
  officecli: {
    readArtifactFile: vi.fn(async () => ({ data: new Uint8Array([1, 2, 3, 4]) })),
    openPath: vi.fn(async () => undefined),
  },
}));

afterEach(() => {
  cleanup();
});

describe("PptxViewer", () => {
  it("renders the PPTist preview without the outer placeholder thumbnail rail", () => {
    render(<PptxViewer previewToken="preview-token" fileName="deck.pptx" documentType="pptx" />);

    expect(screen.queryByLabelText("Slide thumbnails")).toBeNull();
    expect(document.querySelector(".pptx-deck-layout")).toBeTruthy();
    expect(document.querySelector(".pptx-thumb-rail")).toBeNull();
    expect(document.querySelector(".pptx-embed-frame")?.getAttribute("src")).toContain("mode=embed");
  });
});
