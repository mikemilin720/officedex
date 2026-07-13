import type { VibeProjectTreeNode } from "../shared/types";
import type { PptistSlide, PptistTextElement, PptistShapeElement } from "../shared/pptistProtocol";

let counter = 0;
function uid() {
  return `vsc-${++counter}-${Date.now().toString(36)}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function titleElement(title: string): PptistTextElement {
  return {
    type: "text",
    id: uid(),
    left: 50,
    top: 30,
    width: 900,
    height: 80,
    content: `<p style="text-align: center;"><strong>${escapeHtml(title)}</strong></p>`,
    defaultFontName: "Microsoft Yahei",
    defaultColor: "#333333",
  };
}

function subtitleElement(summary: string): PptistTextElement {
  return {
    type: "text",
    id: uid(),
    left: 80,
    top: 100,
    width: 840,
    height: 40,
    content: `<p style="text-align: center;"><em>${escapeHtml(summary)}</em></p>`,
    defaultFontName: "Microsoft Yahei",
    defaultColor: "#666666",
  };
}

function outlineElement(outline: string[], hasSubtitle: boolean): PptistTextElement {
  const top = hasSubtitle ? 150 : 120;
  const height = hasSubtitle ? 360 : 390;
  const html = outline.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return {
    type: "text",
    id: uid(),
    left: 60,
    top,
    width: 580,
    height,
    content: `<ul>${html}</ul>`,
    defaultFontName: "Microsoft Yahei",
    defaultColor: "#444444",
  };
}

function visualAssetPlaceholder(description: string, index: number): PptistShapeElement {
  const top = 150 + index * 110;
  return {
    type: "shape",
    id: uid(),
    left: 670,
    top: Math.min(top, 420),
    width: 280,
    height: 100,
    viewBox: [280, 100],
    path: "M 0 0 L 280 0 L 280 100 L 0 100 Z",
    fill: "#f0eeff",
    fixedRatio: false,
    text: {
      content: `<p style="text-align: center;">${escapeHtml(description)}</p>`,
      defaultFontName: "Microsoft Yahei",
      defaultColor: "#7c6bc4",
    },
  };
}

export function vibeNodeToSlide(node: VibeProjectTreeNode): PptistSlide {
  const elements: (PptistTextElement | PptistShapeElement)[] = [];

  if (node.title) {
    elements.push(titleElement(node.title));
  }

  const hasSubtitle = Boolean(node.summary);
  if (node.summary) {
    elements.push(subtitleElement(node.summary));
  }

  if (node.outline && node.outline.length > 0) {
    elements.push(outlineElement(node.outline, hasSubtitle));
  }

  if (node.visualAssets) {
    node.visualAssets.slice(0, 3).forEach((asset, i) => {
      elements.push(visualAssetPlaceholder(
        `${asset.kind === "chart" ? "📊" : "🖼"} ${asset.description}`,
        i,
      ));
    });
  }

  return {
    id: `generated-${node.id}`,
    elements,
    background: {
      type: "solid",
      color: "#ffffff",
    },
  };
}
