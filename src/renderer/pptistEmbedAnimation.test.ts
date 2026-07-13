import { describe, expect, it } from "vitest";
import { hasRenderableImages, randomPageRenderDelayMs } from "../../../PPTist/src/embedAnimation";

describe("PPTist embed page render delay", () => {
  it("uses a bounded short random delay for pages without images", () => {
    expect(randomPageRenderDelayMs({ imageRich: false }, () => 0)).toBe(520);
    expect(randomPageRenderDelayMs({ imageRich: false }, () => 1)).toBe(980);
    expect(randomPageRenderDelayMs({ imageRich: false }, () => 0.5)).toBe(750);
  });

  it("uses a longer bounded random delay for pages with images", () => {
    expect(randomPageRenderDelayMs({ imageRich: true }, () => 0)).toBe(1100);
    expect(randomPageRenderDelayMs({ imageRich: true }, () => 1)).toBe(1900);
    expect(randomPageRenderDelayMs({ imageRich: true }, () => 0.5)).toBe(1500);
  });

  it("treats image elements and image backgrounds as image-rich pages", () => {
    expect(hasRenderableImages({ id: "plain", elements: [{ id: "shape-1", type: "shape" }] })).toBe(false);
    expect(hasRenderableImages({ id: "image-el", elements: [{ id: "image-1", type: "image" }] })).toBe(true);
    expect(hasRenderableImages({ id: "image-bg", elements: [], background: { type: "image", image: { src: "cover.png" } } })).toBe(true);
  });
});
