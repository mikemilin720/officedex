import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PptistEditOp, PptistElementSelection } from "../../shared/pptistProtocol";
import type { Artifact } from "../../shared/types";
import { officecli } from "../bridge";
import { LocaleProvider } from "../i18n";
import {
  clearPptistParsedSlidesMemoryCacheForTests,
  PptistEmbedPanel,
  setPptistParsedSlidesPersistentCacheForTests,
  type PptistEmbedPanelHandle,
} from "./PptistEmbedPanel";

vi.mock("../bridge", () => ({
  officecli: {
    issuePreviewToken: vi.fn(),
    readArtifactFile: vi.fn(),
    revokePreviewToken: vi.fn(),
    recordRendererLog: vi.fn(),
    savePptx: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

function dispatchEmbedReady(iframe: HTMLIFrameElement) {
  window.dispatchEvent(new MessageEvent("message", {
    data: { type: "pptist:embed-ready" },
    source: iframe.contentWindow,
  }));
}

async function dispatchLatestSlidesCacheMiss(iframe: HTMLIFrameElement, postMessage: any) {
  let cacheMessage: { importRunId?: string; cacheKey?: string } | undefined;
  await waitFor(() => {
    cacheMessage = postMessage.mock.calls.find(([msg]: [{ type?: string }]) => msg.type === "pptist:load-slides-cache")?.[0] as { importRunId?: string; cacheKey?: string } | undefined;
    expect(cacheMessage?.importRunId).toEqual(expect.any(String));
  });
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: {
        type: "pptist:slides-cache-miss",
        importRunId: cacheMessage?.importRunId,
        cacheKey: cacheMessage?.cacheKey,
      },
    }));
  });
}

describe("PptistEmbedPanel", () => {
  const artifact: Artifact = {
    taskId: "task-pptist-artifact",
    filePath: "/tmp/final.pptx",
    fileName: "final.pptx",
    documentType: "pptx",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(officecli.issuePreviewToken).mockResolvedValue({
      token: "preview-token",
      fileName: artifact.fileName,
      documentType: artifact.documentType,
    });
    vi.mocked(officecli.readArtifactFile).mockResolvedValue({ data: new Uint8Array([1, 2, 3, 4]) });
    vi.mocked(officecli.revokePreviewToken).mockResolvedValue(undefined);
    vi.mocked(officecli.savePptx).mockResolvedValue("/tmp/final.pptx");
  });

  afterEach(() => {
    vi.useRealTimers();
    setPptistParsedSlidesPersistentCacheForTests(null);
    clearPptistParsedSlidesMemoryCacheForTests();
    cleanup();
  });

  it("loads PPTist in editable embed mode and passes the app locale", () => {
    const { container } = render(<PptistEmbedPanel slides={[]} />);

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe("/pptist/index.html?mode=embed&editable=1&lang=en");
  });

  it("passes Chinese locale to the embedded PPTist editor", () => {
    const { container } = render(
      <LocaleProvider value="zh">
        <PptistEmbedPanel slides={[]} />
      </LocaleProvider>,
    );

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe("/pptist/index.html?mode=embed&editable=1&lang=zh");
  });

  it("emits selected PPTist shape context from iframe selection changes", async () => {
    const onSelectionChanged = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        onSelectionChanged={onSelectionChanged}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await act(async () => dispatchEmbedReady(iframe));

    const selection: PptistElementSelection = {
      slideId: "slide-1",
      slideIndex: 0,
      elementIds: ["shape-1"],
      elements: [{
        id: "shape-1",
        type: "shape",
        textPreview: "Main point",
        left: 80,
        top: 120,
        width: 240,
        height: 80,
        fill: "#00aa66",
      }],
    };
    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:selection-changed", selection },
    }));

    expect(onSelectionChanged).toHaveBeenCalledWith(selection);
  });

  it("posts a command to reveal and select referenced PPTist elements", async () => {
    const ref = createRef<PptistEmbedPanelHandle>();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    act(() => {
      (ref.current as unknown as { selectElements?: (selection: PptistElementSelection) => void }).selectElements?.({
        slideId: "slide-2",
        slideIndex: 1,
        elementIds: ["shape-2"],
        elements: [{ id: "shape-2", type: "shape", textPreview: "Revenue block" }],
      });
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "pptist:select-elements",
      slideId: "slide-2",
      slideIndex: 1,
      elementIds: ["shape-2"],
    }, "*");
  });

  it("reloads the PPTist iframe URL when the app locale changes", () => {
    const { container, rerender } = render(
      <LocaleProvider value="en">
        <PptistEmbedPanel slides={[]} />
      </LocaleProvider>,
    );

    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("/pptist/index.html?mode=embed&editable=1&lang=en");

    rerender(
      <LocaleProvider value="zh">
        <PptistEmbedPanel slides={[]} />
      </LocaleProvider>,
    );

    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("/pptist/index.html?mode=embed&editable=1&lang=zh");
  });

  it("normalizes PPTist embed locale query values", async () => {
    const { normalizeEmbedLocale } = await import("../../../third_party/pptist/src/embedLocale");

    expect(normalizeEmbedLocale("en")).toBe("en");
    expect(normalizeEmbedLocale("zh")).toBe("zh");
    expect(normalizeEmbedLocale("fr")).toBe("zh");
    expect(normalizeEmbedLocale(null)).toBe("zh");
  });

  it("translates common PPTist editor UI copy for English embeds", async () => {
    const { translateEmbedUiText } = await import("../../../third_party/pptist/src/embedLocale");

    expect(translateEmbedUiText("en", "设计")).toBe("Design");
    expect(translateEmbedUiText("en", "切换")).toBe("Transition");
    expect(translateEmbedUiText("en", "动画")).toBe("Animation");
    expect(translateEmbedUiText("en", "背景填充")).toBe("Background Fill");
    expect(translateEmbedUiText("en", "背景颜色：")).toBe("Background color:");
    expect(translateEmbedUiText("en", "幻灯片 1 / 10")).toBe("Slide 1 / 10");
    expect(translateEmbedUiText("en", "宽屏 16 : 9")).toBe("Widescreen 16:9");
    expect(translateEmbedUiText("en", "标准 4 : 3")).toBe("Standard 4:3");
    expect(translateEmbedUiText("en", "纸张 A3 / A4")).toBe("Paper A3 / A4");
    expect(translateEmbedUiText("en", "竖向 A3 / A4")).toBe("Portrait A3 / A4");
    expect(translateEmbedUiText("en", "从幻灯片提取主题")).toBe("Extract theme from slide");
    expect(translateEmbedUiText("zh", "设计")).toBe("设计");
  });

  it("translates PPTist transition and animation panel copy for English embeds", async () => {
    const { translateEmbedUiText } = await import("../../../third_party/pptist/src/embedLocale");

    expect(translateEmbedUiText("en", "应用到全部")).toBe("Apply to all");
    expect(translateEmbedUiText("en", "已应用到全部")).toBe("Applied to all");
    expect(translateEmbedUiText("en", "随机")).toBe("Random");
    expect(translateEmbedUiText("en", "左右推移（3D）")).toBe("Horizontal push (3D)");
    expect(translateEmbedUiText("en", "淡入淡出")).toBe("Fade");
    expect(translateEmbedUiText("en", "入场")).toBe("Entrance");
    expect(translateEmbedUiText("en", "退场")).toBe("Exit");
    expect(translateEmbedUiText("en", "强调")).toBe("Emphasis");
    expect(translateEmbedUiText("en", "弹跳：")).toBe("Bounce:");
    expect(translateEmbedUiText("en", "放大滑入：")).toBe("Back in:");
    expect(translateEmbedUiText("en", "旋转进入")).toBe("Rotate in");
    expect(translateEmbedUiText("en", "从右飞出")).toBe("Light speed out from right");
    expect(translateEmbedUiText("en", "心跳（快）")).toBe("Heartbeat (fast)");
    expect(translateEmbedUiText("en", "选中画布中的元素添加动画")).toBe("Select an element on the canvas to add animation");
    expect(translateEmbedUiText("en", "添加动画")).toBe("Add animation");
    expect(translateEmbedUiText("en", "持续时长：")).toBe("Duration:");
    expect(translateEmbedUiText("en", "触发方式：")).toBe("Trigger:");
    expect(translateEmbedUiText("en", "主动触发")).toBe("On click");
    expect(translateEmbedUiText("en", "与上一动画同时")).toBe("With previous");
    expect(translateEmbedUiText("en", "上一动画之后")).toBe("After previous");
    expect(translateEmbedUiText("en", "更换动画")).toBe("Change animation");
    expect(translateEmbedUiText("en", "停止预览")).toBe("Stop preview");
    expect(translateEmbedUiText("en", "预览全部")).toBe("Preview all");
    expect(translateEmbedUiText("en", "「文本」弹入")).toBe("\"Text\" Bounce in");
  });

  it("keeps PPTist animation config labels translatable in English embeds", async () => {
    const { translateEmbedUiText } = await import("../../../third_party/pptist/src/embedLocale");
    const animationSource = readFileSync("third_party/pptist/src/configs/animation.ts", "utf8");
    const elementSource = readFileSync("third_party/pptist/src/configs/element.ts", "utf8");
    const labelMatches = [animationSource, elementSource]
      .join("\n")
      .matchAll(/['"]([^'"]*[\u4e00-\u9fff][^'"]*)['"]/g);
    const labels = Array.from(new Set(Array.from(labelMatches, match => match[1])));

    const untranslated = labels.filter(label => /[\u4e00-\u9fff]/.test(translateEmbedUiText("en", label)));

    expect(untranslated).toEqual([]);
  });

  it("hides PPTist editor chrome by default in embed mode", () => {
    const editorSource = readFileSync("third_party/pptist/src/views/Editor/index.vue", "utf8");

    expect(editorSource).toContain('<EditorHeader v-if="!embedMode" class="layout-header" />');
    expect(editorSource).toContain('<Toolbar v-if="!embedMode" class="layout-content-right" />');
    expect(editorSource).toContain(".is-embed-mode .layout-content");
    expect(editorSource).toContain("height: 100%;");
    expect(editorSource).toContain(".is-embed-editable-mode .layout-content-center");
    expect(editorSource).toContain("width: calc(100% - 128px);");
    expect(editorSource).toContain(".is-embed-editable-mode .layout-content-left");
    expect(editorSource).toContain("width: 128px;");
    expect(editorSource).toContain('v-if="!embedMode"');
  });

  it("localizes the PPTist speaker notes placeholder before ProseMirror renders it", () => {
    const remarkEditorSource = readFileSync("third_party/pptist/src/views/Editor/Remark/Editor.vue", "utf8");

    expect(remarkEditorSource).toContain("translateEmbedUiText");
    expect(remarkEditorSource).toContain("normalizeEmbedLocale");
    expect(remarkEditorSource).toContain("placeholder: speakerNotesPlaceholder");
  });

  it("uses a larger default canvas zoom for editable PPTist embeds", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).toContain("if (isEmbedEditable) mainStore.setCanvasPercentage(96)");
  });

  it("reports embedded goto-slide timing and completion back to the host", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");
    const hostSource = readFileSync("src/renderer/components/PptistEmbedPanel.tsx", "utf8");

    expect(hostSource).toContain("host:goto-slide:post");
    expect(appSource).toContain("case 'pptist:goto-slide'");
    expect(appSource).toContain("iframe:goto-slide:received");
    expect(appSource).toContain("iframe:goto-slide:update-index:end");
    expect(appSource).toContain("iframe:goto-slide:render-frame");
    expect(appSource).toContain("type: 'pptist:slide-changing'");
    expect(appSource).toContain("type: 'pptist:slide-changed'");
  });

  it("supports selecting referenced PPTist elements from the host", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");
    const hostSource = readFileSync("src/renderer/components/PptistEmbedPanel.tsx", "utf8");

    expect(hostSource).toContain('type: "pptist:select-elements"');
    expect(appSource).toContain("case 'pptist:select-elements'");
    expect(appSource).toContain("slidesStore.updateSlideIndex(index)");
    expect(appSource).toContain("mainStore.setActiveElementIdList(elementIds)");
    expect(appSource).toContain("postSelectionForHost()");
  });

  it("logs embedded deck state and first render frame while loading cached slides", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).toContain("iframe:load-slides:set-slides:start");
    expect(appSource).toContain("iframe:load-slides:set-slides:end");
    expect(appSource).toContain("iframe:load-slides:render-frame");
  });

  it("does not deep stringify the whole embedded deck to detect dirty slides", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).not.toContain("JSON.stringify(slidesStore.slides.map");
    expect(appSource).toContain("isEmbedProgrammaticUpdate");
    expect(appSource).toContain("slidesStore.currentSlide");
  });

  it("reports user edits dirty immediately while coalescing the full slide update payload", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");
    const watcherStart = appSource.indexOf("// Notify parent when user edits a slide");
    const watcherEnd = appSource.indexOf("\nonMounted", watcherStart);
    const watcherSource = appSource.slice(watcherStart, watcherEnd);
    const timerStart = watcherSource.indexOf("editNotifyTimer = setTimeout");
    const dirtyEvent = "window.parent?.postMessage({ type: 'pptist:dirty-changed', dirty: true }, '*')";

    expect(watcherStart).toBeGreaterThan(-1);
    expect(watcherEnd).toBeGreaterThan(watcherStart);
    expect(timerStart).toBeGreaterThan(-1);
    expect(watcherSource.indexOf(dirtyEvent)).toBeGreaterThan(-1);
    expect(watcherSource.indexOf(dirtyEvent)).toBeLessThan(timerStart);
    expect(watcherSource.slice(timerStart)).toContain("type: 'pptist:slide-updated'");
    expect(watcherSource.slice(timerStart)).not.toContain(dirtyEvent);
  });

  it("defers editable PPTist controls until after the embedded slide first paints", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).toContain("deferEmbedEditableModeForRender");
    expect(appSource).toContain("restoreEmbedEditableModeAfterRender");
    expect(appSource).toContain("mainStore.setEmbedEditableMode(false)");
    expect(appSource).toContain("mainStore.setEmbedEditableMode(isEmbedEditable)");
  });

  it("hydrates the embedded thumbnail budget before lazily hydrating the rest of the deck", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).toContain("buildEmbedInitialSlides");
    expect(appSource).toContain("getEmbedInitialHydratedSlideCount");
    expect(appSource).toContain("hydrateEmbedSlidesAfterFirstPaint");
    expect(appSource).toContain("iframe:load-slides:hydrate-full-deck");
    expect(appSource).toContain("index < initialHydratedSlideCount ? slide");
  });

  it("hydrates the active slide when PPTist internal thumbnails change slideIndex", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");

    expect(appSource).toContain("watchEmbedSlideIndexForHydration");
    expect(appSource).toContain("slidesStore.slideIndex");
    expect(appSource).toContain("ensureEmbedSlideHydrated(index)");
    expect(appSource).toContain("iframe:slide-index:hydrate-slide");
  });

  it("cancels animated embed slide queues before replacing them with a final PPTX artifact", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");
    const loadSlidesStart = appSource.indexOf("function loadSlidesIntoEmbed");
    const loadPptxStart = appSource.indexOf("case 'pptist:load-pptx'");
    const loadPptxEnd = appSource.indexOf("case 'pptist:goto-slide'", loadPptxStart);

    expect(appSource).toContain("cancelEmbedAnimatedSlideQueue");
    expect(loadSlidesStart).toBeGreaterThan(-1);
    expect(loadPptxStart).toBeGreaterThan(-1);
    expect(loadPptxEnd).toBeGreaterThan(loadPptxStart);
    expect(appSource.slice(loadSlidesStart, loadPptxStart)).toContain("cancelEmbedAnimatedSlideQueue()");
    expect(appSource.slice(loadPptxStart, loadPptxEnd)).toContain("cancelEmbedAnimatedSlideQueue()");
  });

  it("reports synchronous PPTist edit ops as applied before waiting for the next render frame", () => {
    const appSource = readFileSync("third_party/pptist/src/App.vue", "utf8");
    const fnStart = appSource.indexOf("async function applyPptistEditOps");
    const fnEnd = appSource.indexOf("function setupEmbedMode", fnStart);
    const fnSource = appSource.slice(fnStart, fnEnd);
    const appliedPost = fnSource.indexOf("type: 'pptist:edit-op-applied'");
    const firstNextTickAfterApply = fnSource.indexOf("await nextTick()", fnSource.indexOf("syncEmbedFullSlidesFromCurrentStore()"));

    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    expect(appliedPost).toBeGreaterThan(-1);
    expect(firstNextTickAfterApply).toBeGreaterThan(-1);
    expect(appliedPost).toBeLessThan(firstNextTickAfterApply);
  });

  it("loads only the active embedded PPTist thumbnail before progressively rendering the rail", () => {
    const thumbnailsSource = readFileSync("third_party/pptist/src/views/Editor/Thumbnails/index.vue", "utf8");

    expect(thumbnailsSource).toContain("const initialThumbnailLoadConfig = getPptxPerformanceConfig");
    expect(thumbnailsSource).toContain("initialLimit: initialThumbnailLoadConfig.initialLimit");
    expect(thumbnailsSource).toContain("const isThumbnailVisible = (index: number)");
    expect(thumbnailsSource).toContain("return nearCurrentSlide || limitedVisible");
  });

  it("does not reload the same final artifact when parent callbacks or slideIds array identities change", async () => {
    const onExportError = vi.fn();
    const { container, rerender } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
        onExportError={onExportError}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    dispatchEmbedReady(iframe);
    await dispatchLatestSlidesCacheMiss(iframe, postMessage);

    await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));

    rerender(
      <PptistEmbedPanel
        slides={[]}
        artifact={{ ...artifact }}
        slideIds={["generated-slide-01", "generated-slide-02"]}
        onExportError={vi.fn()}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(officecli.issuePreviewToken).toHaveBeenCalledTimes(1);
    expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1);
  });

  it("loads an already animated final artifact without replaying the generation animation", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01"]}
        animateArtifact={false}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    dispatchEmbedReady(iframe);
    await dispatchLatestSlidesCacheMiss(iframe, postMessage);

    await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));
    const loadMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-pptx")?.[0] as { animate?: boolean };
    expect(loadMessage.animate).toBe(false);
  });

  it("keeps a loading overlay visible while PPTist imports a final artifact", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;

    expect(container.querySelector(".living-tree-pptist-loading")).not.toBeNull();

    await act(async () => dispatchEmbedReady(iframe));

    const artifactLoading = container.querySelector(".living-tree-pptist-loading");
    expect(artifactLoading).not.toBeNull();
    expect(artifactLoading?.textContent).toContain("Preparing deck");

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:slides-loaded",
          slides: [{ id: "generated-slide-01", elements: [] }],
        },
      }));
    });

    expect(container.querySelector(".living-tree-pptist-loading")).toBeNull();
  });

  it("logs timing boundaries for final artifact import", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const logArtifact: Artifact = {
      ...artifact,
      taskId: "task-pptist-log-artifact",
      filePath: "/tmp/log-final.pptx",
      fileName: "log-final.pptx",
    };
    try {
      const { container } = render(
        <PptistEmbedPanel
          slides={[]}
          artifact={logArtifact}
          slideIds={["generated-slide-01"]}
        />,
      );
      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

      await act(async () => dispatchEmbedReady(iframe));
      await dispatchLatestSlidesCacheMiss(iframe, postMessage);
      await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));

      await act(async () => {
        window.dispatchEvent(new MessageEvent("message", {
          source: iframe.contentWindow,
          data: {
            type: "pptist:slides-loaded",
            count: 1,
            slides: [{ id: "generated-slide-01", elements: [] }],
          },
        }));
      });

      expect(consoleInfo).toHaveBeenCalledWith(
        "[OfficeDex][PPTistImport]",
        "host:read-artifact:end",
        expect.objectContaining({ byteLength: 4, fileName: logArtifact.fileName }),
      );
      expect(consoleInfo).toHaveBeenCalledWith(
        "[OfficeDex][PPTistImport]",
        "host:slides-loaded",
        expect.objectContaining({ count: 1, fileName: logArtifact.fileName }),
      );
    } finally {
      consoleInfo.mockRestore();
    }
  });

  it("reuses cached parsed slides for the same final artifact instead of reading the PPTX again", async () => {
    const cachedArtifact: Artifact = {
      ...artifact,
      taskId: "task-pptist-cached-artifact",
      filePath: "/tmp/cached-final.pptx",
      fileName: "cached-final.pptx",
    };
    const parsedSlides = [
      { id: "generated-slide-01", elements: [] },
      { id: "generated-slide-02", elements: [] },
    ];
    const first = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={cachedArtifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const firstIframe = first.container.querySelector("iframe") as HTMLIFrameElement;
    const firstPostMessage = vi.spyOn(firstIframe.contentWindow!, "postMessage");
    dispatchEmbedReady(firstIframe);
    await dispatchLatestSlidesCacheMiss(firstIframe, firstPostMessage);

    await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: firstIframe.contentWindow,
        data: {
          type: "pptist:slides-loaded",
          count: parsedSlides.length,
          slides: parsedSlides,
        },
      }));
    });
    first.unmount();

    const second = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={cachedArtifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const secondIframe = second.container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(secondIframe.contentWindow!, "postMessage");
    dispatchEmbedReady(secondIframe);

    await waitFor(() => {
      const loadCacheMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-slides-cache")?.[0];
      expect(loadCacheMessage).toEqual(expect.objectContaining({
        type: "pptist:load-slides-cache",
        cacheKey: expect.stringContaining(cachedArtifact.filePath),
        animate: false,
      }));
    });
    expect(officecli.issuePreviewToken).toHaveBeenCalledTimes(1);
    expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1);
  });

  it("reuses persistent parsed slides when the in-memory final artifact cache is empty", async () => {
    const persistentArtifact: Artifact = {
      ...artifact,
      taskId: "task-pptist-persistent-cache",
      filePath: "/tmp/persistent-cache-final.pptx",
      fileName: "persistent-cache-final.pptx",
    };
    const parsedSlides = [
      { id: "generated-slide-01", elements: [] },
      { id: "generated-slide-02", elements: [] },
    ];
    const persistentStore = new Map<string, typeof parsedSlides>();
    setPptistParsedSlidesPersistentCacheForTests({
      get: async (key) => persistentStore.get(key) ?? null,
      set: async (key, slides) => {
        persistentStore.set(key, slides as typeof parsedSlides);
      },
      delete: async (key) => {
        persistentStore.delete(key);
      },
    });

    const first = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={persistentArtifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const firstIframe = first.container.querySelector("iframe") as HTMLIFrameElement;
    const firstPostMessage = vi.spyOn(firstIframe.contentWindow!, "postMessage");
    dispatchEmbedReady(firstIframe);
    await dispatchLatestSlidesCacheMiss(firstIframe, firstPostMessage);
    await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: firstIframe.contentWindow,
        data: {
          type: "pptist:slides-loaded",
          count: parsedSlides.length,
          slides: parsedSlides,
        },
      }));
    });
    first.unmount();
    clearPptistParsedSlidesMemoryCacheForTests();

    const second = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={persistentArtifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const secondIframe = second.container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(secondIframe.contentWindow!, "postMessage");
    dispatchEmbedReady(secondIframe);

    await waitFor(() => {
      const loadCacheMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-slides-cache")?.[0];
      expect(loadCacheMessage).toEqual(expect.objectContaining({
        type: "pptist:load-slides-cache",
        cacheKey: expect.stringContaining(persistentArtifact.filePath),
        animate: false,
      }));
    });
    expect(officecli.issuePreviewToken).toHaveBeenCalledTimes(1);
    expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1);
  });

  it("asks the embedded PPTist frame to load parsed artifact slides by cache key before reading the PPTX", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    dispatchEmbedReady(iframe);

    await waitFor(() => {
      const cacheMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-slides-cache")?.[0];
      expect(cacheMessage).toEqual(expect.objectContaining({
        type: "pptist:load-slides-cache",
        cacheKey: expect.stringContaining(artifact.filePath),
        animate: false,
      }));
    });
    expect(officecli.issuePreviewToken).not.toHaveBeenCalled();
    expect(officecli.readArtifactFile).not.toHaveBeenCalled();
  });

  it("falls back to sending PPTX bytes when the embedded PPTist parsed-slide cache misses", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    dispatchEmbedReady(iframe);

    await waitFor(() => {
      const cacheMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-slides-cache")?.[0] as { importRunId?: string };
      expect(cacheMessage?.importRunId).toEqual(expect.any(String));
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:slides-cache-miss",
          importRunId: cacheMessage.importRunId,
        },
      }));
    });

    await waitFor(() => expect(officecli.readArtifactFile).toHaveBeenCalledTimes(1));
    const loadPptxMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:load-pptx")?.[0] as { cacheKey?: string };
    expect(loadPptxMessage).toEqual(expect.objectContaining({
      type: "pptist:load-pptx",
      cacheKey: expect.stringContaining(artifact.filePath),
    }));
  });

  it("reveals PPTist's own thumbnail rail inside embed mode", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const iframeDocument = document.implementation.createHTMLDocument("PPTist");
    Object.defineProperty(iframe, "contentDocument", { configurable: true, value: iframeDocument });
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: { document: iframeDocument, postMessage: vi.fn() },
    });

    await act(async () => {
      fireEvent.load(iframe);
      dispatchEmbedReady(iframe);
    });

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    const style = doc?.querySelector<HTMLStyleElement>("style#officedex-pptist-review-styles");
    expect(style?.textContent).toContain(".is-embed-readonly-mode .layout-content-left-offscreen");
    expect(style?.textContent).toContain("position: relative !important");
    expect(style?.textContent).toContain("width: 160px !important");
    expect(style?.textContent).toContain("calc(100% - 160px)");
  });

  it("keeps PPTist thumbnail capture disabled when no host consumer needs thumbnail images", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[{ id: "generated-slide-01", elements: [] }]}
        slideIds={["generated-slide-01"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    await act(async () => dispatchEmbedReady(iframe));

    expect(postMessage).toHaveBeenCalledWith({
      type: "pptist:set-thumbnail-capture-enabled",
      enabled: false,
    }, "*");
  });

  it("enables PPTist thumbnail capture only when the host consumes thumbnail images", async () => {
    const { container } = render(
      <PptistEmbedPanel
        slides={[{ id: "generated-slide-01", elements: [] }]}
        slideIds={["generated-slide-01"]}
        onSlideThumbnail={vi.fn()}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    await act(async () => dispatchEmbedReady(iframe));

    expect(postMessage).toHaveBeenCalledWith({
      type: "pptist:set-thumbnail-capture-enabled",
      enabled: true,
    }, "*");
  });

  it("shows a slide switching overlay until PPTist finishes changing slides", async () => {
    vi.useFakeTimers();
    const onSlideChanged = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01", "generated-slide-02"]}
        onSlideChanged={onSlideChanged}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;

    await act(async () => dispatchEmbedReady(iframe));
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:slides-loaded",
          slides: [
            { id: "generated-slide-01", elements: [] },
            { id: "generated-slide-02", elements: [] },
          ],
        },
      }));
    });
    expect(container.querySelector(".living-tree-pptist-switching")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:slide-changing", index: 1, slideId: "generated-slide-02" },
      }));
    });

    expect(container.querySelector(".living-tree-pptist-switching")).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:slide-changed", index: 1, slideId: "generated-slide-02" },
      }));
    });

    expect(onSlideChanged).toHaveBeenCalledWith(1, "generated-slide-02");
    expect(container.querySelector(".living-tree-pptist-switching")).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(219);
    });
    expect(container.querySelector(".living-tree-pptist-switching")).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(container.querySelector(".living-tree-pptist-switching")).toBeNull();
  });

  it("loads OfficeDex PPTist embed CSS before the PPTist module initializes", () => {
    const html = readFileSync("public/pptist/index.html", "utf8");
    const css = readFileSync("public/pptist/officedex-embed.css", "utf8");

    expect(html.indexOf("officedex-embed.css")).toBeGreaterThan(-1);
    const moduleScript = html.match(/assets\/index-[^"]+\.js/)?.[0] ?? "";
    expect(moduleScript).not.toBe("");
    expect(html.indexOf("officedex-embed.css")).toBeLessThan(html.indexOf(moduleScript));
    expect(css).toContain(".pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen");
    expect(css).toContain(".pptist-editor.is-embed-editable-mode .layout-content-left");
    expect(css).toContain("flex: 0 0 128px !important");
    expect(css).toContain("width: calc(100% - 128px - 260px) !important");
    expect(css).toContain("width: 94px !important");
    expect(css).toContain("position: relative !important");
    expect(css).toContain("width: 160px !important");
    expect(css).toContain(".thumbnail-slide");
    expect(css).toContain("cursor: pointer !important");
    expect(css).toContain("pointer-events: none !important");
  });

  it("requests snapshots, applies AI edit ops, and immediately autosaves the result back to the artifact", async () => {
    const deleteParsedSlides = vi.fn(async () => undefined);
    setPptistParsedSlidesPersistentCacheForTests({
      get: async () => null,
      set: async () => undefined,
      delete: deleteParsedSlides,
    });
    const ref = createRef<PptistEmbedPanelHandle>();
    const onAutosaveStateChange = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    const snapshotPromise = ref.current!.getSnapshot();
    const snapshotMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:get-snapshot")?.[0] as { requestId: string };
    expect(snapshotMessage.requestId).toBeTruthy();
    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: {
        type: "pptist:snapshot-result",
        requestId: snapshotMessage.requestId,
        snapshot: {
          slides: [{ id: "slide-1", elements: [] }],
          title: "Deck",
          theme: {},
          viewportSize: 1000,
          viewportRatio: 0.5625,
          slideIndex: 0,
        },
      },
    }));
    await expect(snapshotPromise).resolves.toMatchObject({ title: "Deck", slides: [{ id: "slide-1" }] });

    const ops: PptistEditOp[] = [{ type: "element:update", slideId: "slide-1", elementId: "title", props: { content: "<p>Updated</p>" } }];
    const applyPromise = ref.current!.applyEditOps(ops);
    const applyMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:apply-edit-ops")?.[0] as { runId: string; ops: PptistEditOp[] };
    expect(applyMessage.ops).toEqual(ops);
    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:edit-run-completed", runId: applyMessage.runId, ok: true, applied: 1 },
    }));
    await expect(applyPromise).resolves.toMatchObject({ ok: true, applied: 1 });

    const exportMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId: string; targetFilePath?: string };
    expect(exportMessage.requestId).toBeTruthy();
    expect(exportMessage.targetFilePath).toBe(artifact.filePath);

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:export-result", requestId: exportMessage.requestId, buffer: new Uint8Array([9, 8, 7]).buffer, fileName: artifact.fileName, targetFilePath: artifact.filePath },
    }));
    await waitFor(() => expect(officecli.savePptx).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]), artifact.fileName, { targetFilePath: artifact.filePath }));
    await waitFor(() => expect(deleteParsedSlides).toHaveBeenCalledWith(expect.stringContaining(artifact.filePath)));
    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saved");
  });

  it("serializes autosaves and coalesces edits during a native write into one follow-up save", async () => {
    let resolveFirstSave!: (filePath: string) => void;
    const firstSave = new Promise<string>((resolve) => {
      resolveFirstSave = resolve;
    });
    vi.mocked(officecli.savePptx)
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce(artifact.filePath);
    const onAutosaveStateChange = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
    });
    const firstExport = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId: string };
    expect(firstExport.requestId).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:export-result",
          requestId: firstExport.requestId,
          buffer: new Uint8Array([1, 2, 3]).buffer,
          fileName: artifact.fileName,
          targetFilePath: artifact.filePath,
        },
      }));
      await Promise.resolve();
    });
    expect(officecli.savePptx).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
    });
    expect(postMessage.mock.calls.filter(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")).toHaveLength(1);

    await act(async () => {
      resolveFirstSave(artifact.filePath);
      await firstSave;
      await Promise.resolve();
    });
    const exportMessages = postMessage.mock.calls.filter(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx");
    expect(exportMessages).toHaveLength(2);
    const secondExport = exportMessages[1][0] as { requestId: string };

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:export-result",
          requestId: secondExport.requestId,
          buffer: new Uint8Array([4, 5, 6]).buffer,
          fileName: artifact.fileName,
          targetFilePath: artifact.filePath,
        },
      }));
    });
    await waitFor(() => expect(officecli.savePptx).toHaveBeenCalledTimes(2));
    expect(postMessage.mock.calls.filter(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")).toHaveLength(2);
    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saved");
  });

  it("resolves an edit run when every op applies but PPTist misses completion", async () => {
    vi.useFakeTimers();
    const ref = createRef<PptistEmbedPanelHandle>();
    const onAutosaveStateChange = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    const ops: PptistEditOp[] = [{
      type: "element:update-text",
      slideId: "slide-1",
      elementId: "title",
      text: "Updated",
      preserveStyle: true,
      animation: { mode: "typewriter", clearFirst: true, showCaret: true },
    }];
    const applyPromise = ref.current!.applyEditOps(ops);
    const applyMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:apply-edit-ops")?.[0] as { runId: string; ops: PptistEditOp[] };
    expect(applyMessage.ops).toEqual(ops);

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:edit-op-applied", runId: applyMessage.runId, index: 0, op: ops[0] },
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await expect(applyPromise).resolves.toMatchObject({ ok: true, applied: 1 });
    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saving");
    expect(postMessage.mock.calls.some(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")).toBe(true);
  });

  it("waits for every edit op index before using applied-event completion fallback", async () => {
    vi.useFakeTimers();
    const ref = createRef<PptistEmbedPanelHandle>();
    const onAutosaveStateChange = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    const ops: PptistEditOp[] = [
      { type: "element:update-text", slideId: "slide-1", elementId: "title", text: "Updated title", preserveStyle: true },
      { type: "element:update-text", slideId: "slide-1", elementId: "subtitle", text: "Updated subtitle", preserveStyle: true },
    ];
    const applyPromise = ref.current!.applyEditOps(ops);
    let resolved = false;
    applyPromise.then(() => {
      resolved = true;
    });
    const applyMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:apply-edit-ops")?.[0] as { runId: string; ops: PptistEditOp[] };
    expect(applyMessage.ops).toEqual(ops);

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:edit-op-applied", runId: applyMessage.runId, index: 1, op: ops[1] },
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(resolved).toBe(false);
    expect(onAutosaveStateChange).not.toHaveBeenCalledWith("dirty");

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: "pptist:edit-op-applied", runId: applyMessage.runId, index: 0, op: ops[0] },
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await expect(applyPromise).resolves.toMatchObject({ ok: true, applied: 2 });
    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saving");
    expect(postMessage.mock.calls.some(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")).toBe(true);
  });

  it("rejects an edit run when PPTist never reports applied or completed", async () => {
    vi.useFakeTimers();
    const ref = createRef<PptistEmbedPanelHandle>();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
        artifact={artifact}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    const ops: PptistEditOp[] = [{ type: "element:update-text", slideId: "slide-1", elementId: "title", text: "Updated", preserveStyle: true }];
    const applyPromise = ref.current!.applyEditOps(ops);
    const applyMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:apply-edit-ops")?.[0] as { runId: string; ops: PptistEditOp[] };
    expect(applyMessage.ops).toEqual(ops);
    const rejection = expect(applyPromise).rejects.toThrow("PPTist edit timed out");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await rejection;
  });

  it("exports PPTX bytes for internal analysis without saving locally", async () => {
    const ref = createRef<PptistEmbedPanelHandle>();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
        artifact={artifact}
        slideIds={["generated-slide-01"]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    await waitFor(() => expect(ref.current).not.toBeNull());
    const promise = ref.current!.exportPptxBytes(artifact.fileName);
    const exportMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId: string; fileName?: string; targetFilePath?: string };
    expect(exportMessage.requestId).toBeTruthy();
    expect(exportMessage.fileName).toBe(artifact.fileName);
    expect(exportMessage.targetFilePath).toBeUndefined();

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:export-result",
          requestId: exportMessage.requestId,
          buffer: new Uint8Array([80, 75, 3, 4]).buffer,
          fileName: artifact.fileName,
        },
      }));
    });

    await expect(promise).resolves.toEqual({ bytes: new Uint8Array([80, 75, 3, 4]), fileName: artifact.fileName });
    expect(officecli.savePptx).not.toHaveBeenCalled();
    expect(officecli.showItemInFolder).not.toHaveBeenCalled();
  });

  it("rejects a snapshot request when the PPTist iframe does not respond quickly", async () => {
    vi.useFakeTimers();
    const ref = createRef<PptistEmbedPanelHandle>();
    const { container } = render(
      <PptistEmbedPanel
        ref={ref}
        slides={[]}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    let rejectedMessage = "";
    void ref.current!.getSnapshot().catch((err) => {
      rejectedMessage = err instanceof Error ? err.message : String(err);
    });
    const snapshotMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:get-snapshot")?.[0] as { requestId: string };
    expect(snapshotMessage.requestId).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
      await Promise.resolve();
    });

    expect(rejectedMessage).toContain("PPTist snapshot timed out");
  });

  it("marks autosave failed when PPTist export never responds", async () => {
    vi.useFakeTimers();
    const onAutosaveStateChange = vi.fn();
    const onExportError = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
        onExportError={onExportError}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
      await vi.advanceTimersByTimeAsync(2000);
    });

    const exportMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId?: string };
    expect(exportMessage.requestId).toBeTruthy();
    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saving");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45000);
    });

    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("failed", expect.stringContaining("timed out"));
    expect(onExportError).toHaveBeenCalledWith(expect.stringContaining("timed out"));
    expect(officecli.savePptx).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("marks autosave failed when native PPTX save does not settle", async () => {
    vi.useFakeTimers();
    vi.mocked(officecli.savePptx).mockReturnValue(new Promise<string>(() => {}));
    const onAutosaveStateChange = vi.fn();
    const onExportError = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
        onExportError={onExportError}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
      await vi.advanceTimersByTimeAsync(2000);
    });
    const exportMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId?: string };
    expect(exportMessage.requestId).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:export-result",
          requestId: exportMessage.requestId,
          buffer: new Uint8Array([9, 8, 7]).buffer,
          fileName: artifact.fileName,
          targetFilePath: artifact.filePath,
        },
      }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(32000);
    });

    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("failed", expect.stringContaining("Saving PPTX locally timed out"));
    expect(onExportError).toHaveBeenCalledWith(expect.stringContaining("Saving PPTX locally timed out"));
    vi.useRealTimers();
  });

  it("allows large exported PPTX files more than 30 seconds to save natively", async () => {
    vi.useFakeTimers();
    vi.mocked(officecli.savePptx).mockReturnValue(new Promise<string>(() => {}));
    const onAutosaveStateChange = vi.fn();
    const onExportError = vi.fn();
    const { container } = render(
      <PptistEmbedPanel
        slides={[]}
        artifact={artifact}
        autosaveEnabled
        onAutosaveStateChange={onAutosaveStateChange}
        onExportError={onExportError}
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    await act(async () => dispatchEmbedReady(iframe));

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "pptist:dirty-changed", dirty: true },
      }));
      await vi.advanceTimersByTimeAsync(2000);
    });
    const exportMessage = postMessage.mock.calls.find(([msg]) => (msg as { type?: string }).type === "pptist:export-pptx")?.[0] as { requestId?: string };
    expect(exportMessage.requestId).toBeTruthy();

    const largePptxBytes = new Uint8Array(16 * 1024 * 1024);
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          type: "pptist:export-result",
          requestId: exportMessage.requestId,
          buffer: largePptxBytes.buffer,
          fileName: artifact.fileName,
          targetFilePath: artifact.filePath,
        },
      }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("saving");
    expect(onExportError).not.toHaveBeenCalledWith(expect.stringContaining("Saving PPTX locally timed out"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(32000);
    });

    expect(onAutosaveStateChange).toHaveBeenLastCalledWith("failed", expect.stringContaining("Saving PPTX locally timed out"));
    expect(onExportError).toHaveBeenCalledWith(expect.stringContaining("Saving PPTX locally timed out"));
    vi.useRealTimers();
  });
});
