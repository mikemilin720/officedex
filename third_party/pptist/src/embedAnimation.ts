const NORMAL_PAGE_RENDER_DELAY = { min: 520, max: 980 };
const IMAGE_PAGE_RENDER_DELAY = { min: 1100, max: 1900 };

export function hasRenderableImages(slide: {
  id?: string;
  elements?: Array<{ type?: string; [key: string]: unknown }>;
  background?: { type?: string; image?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}): boolean {
  if (slide.background?.type === 'image' || slide.background?.image) return true;
  return (slide.elements || []).some(el => el?.type === 'image');
}

export function randomPageRenderDelayMs(
  options: { imageRich: boolean },
  random: () => number = Math.random,
): number {
  const range = options.imageRich ? IMAGE_PAGE_RENDER_DELAY : NORMAL_PAGE_RENDER_DELAY;
  const ratio = Math.max(0, Math.min(1, random()));
  return Math.round(range.min + (range.max - range.min) * ratio);
}
