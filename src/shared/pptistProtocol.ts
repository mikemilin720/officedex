export interface PptistGradientColor {
  pos: number;
  color: string;
}

// Matches PPTist's nested SlideBackground schema. Flat fields are silently
// ignored by PPTist (the slide falls back to white), so keep this in sync.
export interface PptistSlideBackground {
  type: "solid" | "image" | "gradient";
  color?: string;
  image?: { src: string; size: "cover" | "contain" | "repeat" };
  gradient?: { type: "linear" | "radial"; colors: PptistGradientColor[]; rotate: number };
}

export interface PptistTextElement {
  type: "text";
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  content: string;
  defaultFontName?: string;
  defaultColor?: string;
}

export interface PptistShapeElement {
  type: "shape";
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  viewBox: [number, number];
  path: string;
  fill?: string;
  fixedRatio?: boolean;
  text?: { content: string; defaultFontName?: string; defaultColor?: string; align?: string };
}

export interface PptistImageElement {
  type: "image";
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  src: string;
  fixedRatio?: boolean;
}

export interface PptistChartData {
  labels: string[];
  legends: string[];
  series: number[][];
}

export interface PptistChartElement {
  type: "chart";
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  chartType: string;
  data: PptistChartData;
  themeColors: string[];
  textColor?: string;
}

export type PptistElement =
  | PptistTextElement
  | PptistShapeElement
  | PptistImageElement
  | PptistChartElement;

export interface PptistSlide {
  id: string;
  elements: PptistElement[];
  background?: PptistSlideBackground;
  [key: string]: unknown;
}

export interface PptistDeckSnapshot {
  slides: PptistSlide[];
  title?: string;
  theme?: Record<string, unknown>;
  viewportSize?: number;
  viewportRatio?: number;
  slideIndex?: number;
  selectedSlideId?: string;
  selectedElementIds?: string[];
}

export interface PptistSelectedElementSummary {
  id: string;
  type: PptistElement["type"] | string;
  textPreview?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fill?: string;
}

export interface PptistElementSelection {
  slideId?: string;
  slideIndex?: number;
  elementIds: string[];
  elements: PptistSelectedElementSummary[];
}

export type PptistEditOp =
  | { type: "deck:update"; title?: string; viewportSize?: number; viewportRatio?: number }
  | { type: "theme:update"; props: Record<string, unknown> }
  | { type: "slide:add"; slide: PptistSlide; index?: number }
  | { type: "slide:replace"; slideId?: string; index?: number; slide: PptistSlide }
  | { type: "slide:update"; slideId?: string; index?: number; props: Partial<PptistSlide> }
  | { type: "slide:delete"; slideId?: string; index?: number }
  | { type: "slide:move"; slideId?: string; fromIndex?: number; toIndex: number }
  | { type: "element:add"; slideId?: string; slideIndex?: number; element: PptistElement; index?: number }
  | { type: "element:update"; slideId?: string; slideIndex?: number; elementId: string; props: Record<string, unknown> }
  | {
      type: "element:update-text";
      slideId?: string;
      slideIndex?: number;
      elementId: string;
      text: string;
      preserveStyle?: boolean;
      animation?: { mode: "typewriter"; clearFirst?: boolean; showCaret?: boolean };
    }
  | { type: "element:delete"; slideId?: string; slideIndex?: number; elementId: string }
  | { type: "element:move"; slideId?: string; slideIndex?: number; elementId: string; toIndex: number }
  | { type: "deck:replace"; snapshot: PptistDeckSnapshot };

export interface PptistEditRunResult {
  ok: boolean;
  applied: number;
  error?: string;
}

// Host → PPTist
export type PptistCommand =
  | { type: "pptist:add-slide"; slide: PptistSlide; index?: number; animate?: boolean }
  | { type: "pptist:update-slide"; slideId: string; slide: Partial<PptistSlide> }
  | { type: "pptist:load-slides"; slides: PptistSlide[]; animate?: boolean; importRunId?: string }
  | { type: "pptist:load-slides-cache"; cacheKey: string; animate?: boolean; importRunId?: string }
  | { type: "pptist:load-pptx"; buffer: ArrayBuffer; fileName?: string; animate?: boolean; slideIds?: string[]; importRunId?: string; cacheKey?: string }
  | { type: "pptist:goto-slide"; index: number }
  | { type: "pptist:select-elements"; slideId?: string; slideIndex?: number; elementIds: string[] }
  | { type: "pptist:get-snapshot"; requestId: string }
  | { type: "pptist:apply-edit-ops"; runId: string; ops: PptistEditOp[] }
  | { type: "pptist:export-pptx"; requestId?: string; fileName?: string; targetFilePath?: string }
  | { type: "pptist:clear" };

// PPTist → Host
export type PptistEvent =
  | { type: "pptist:embed-ready" }
  | { type: "pptist:slide-changing"; index: number; slideId: string }
  | { type: "pptist:slide-changed"; index: number; slideId: string }
  | { type: "pptist:slides-loaded"; count: number; slides?: PptistSlide[]; importRunId?: string }
  | { type: "pptist:slides-cache-miss"; importRunId?: string; cacheKey?: string; error?: string }
  | { type: "pptist:import-log"; event: string; details?: Record<string, unknown>; atMs?: number }
  | { type: "pptist:slide-thumbnail"; slideId: string; dataUrl: string }
  | { type: "pptist:slide-updated"; slideId: string; slide: PptistSlide }
  | { type: "pptist:selection-changed"; selection: PptistElementSelection }
  | { type: "pptist:slide-typed"; index: number; slideId: string }
  | { type: "pptist:snapshot-result"; requestId: string; snapshot?: PptistDeckSnapshot; error?: string }
  | { type: "pptist:edit-op-started"; runId: string; index: number; op: PptistEditOp }
  | { type: "pptist:edit-op-applied"; runId: string; index: number; op: PptistEditOp }
  | { type: "pptist:edit-run-completed"; runId: string; ok: boolean; applied: number; error?: string }
  | { type: "pptist:dirty-changed"; dirty: boolean }
  | { type: "pptist:export-result"; requestId?: string; buffer: ArrayBuffer; fileName?: string; targetFilePath?: string }
  | { type: "pptist:export-error"; requestId?: string; error: string; fileName?: string; targetFilePath?: string };
