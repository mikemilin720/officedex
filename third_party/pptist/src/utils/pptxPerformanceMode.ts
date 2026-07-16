export const PPTX_PERFORMANCE_FILE_SIZE = 50 * 1024 * 1024

export type PptxImageMode = 'base64' | 'blob' | 'both' | 'none'
export type PptxVideoMode = 'blob' | 'none'
export type PptxAudioMode = 'blob' | 'none'

export interface PptxParseOptions {
  imageMode: PptxImageMode
  videoMode: PptxVideoMode
  audioMode: PptxAudioMode
}

export interface PptxThumbnailLoadConfig {
  initialLimit: number
  batchSize: number
  delayMs: number
  resetOnSlidesChange: boolean
  maxVisible: number
  neighborRange: number
}

export interface PptxPerformanceConfig {
  enabled: boolean
  reason: 'default' | 'large-file' | 'url-param' | 'embed'
  parseOptions: PptxParseOptions
  thumbnailLoad: PptxThumbnailLoadConfig
  staticCanvas: boolean
  maxCanvasPercentage: number | null
  maxImageDimension: number | null
}

interface GetPptxPerformanceConfigOptions {
  fileSize?: number
  search?: string
  embedMode?: boolean
}

export const DEFAULT_PPTX_PARSE_OPTIONS: PptxParseOptions = {
  imageMode: 'base64',
  videoMode: 'blob',
  audioMode: 'blob',
}

export const PERFORMANCE_PPTX_PARSE_OPTIONS: PptxParseOptions = {
  imageMode: 'blob',
  videoMode: 'none',
  audioMode: 'none',
}

export const DEFAULT_THUMBNAIL_LOAD: PptxThumbnailLoadConfig = {
  initialLimit: 50,
  batchSize: 20,
  delayMs: 600,
  resetOnSlidesChange: false,
  maxVisible: 50,
  neighborRange: 0,
}

export const PERFORMANCE_THUMBNAIL_LOAD: PptxThumbnailLoadConfig = {
  initialLimit: 3,
  batchSize: 2,
  delayMs: 900,
  resetOnSlidesChange: true,
  maxVisible: 20,
  neighborRange: 1,
}

const truthyParamValues = new Set(['1', 'true', 'yes', 'on'])
const falsyParamValues = new Set(['0', 'false', 'no', 'off'])

const getPerformanceParam = (search = '') => {
  const params = new URLSearchParams(search)
  const value = params.get('pptxPerformance') ?? params.get('pptxPerf')
  if (!value) return null

  const normalized = value.toLowerCase()
  if (truthyParamValues.has(normalized)) return true
  if (falsyParamValues.has(normalized)) return false
  return null
}

export const getPptxPerformanceConfig = (options: GetPptxPerformanceConfigOptions = {}): PptxPerformanceConfig => {
  const forced = getPerformanceParam(options.search)

  let enabled = false
  let reason: PptxPerformanceConfig['reason'] = 'default'

  if (forced !== null) {
    enabled = forced
    reason = forced ? 'url-param' : 'default'
  }
  else if (options.embedMode) {
    enabled = true
    reason = 'embed'
  }
  else if ((options.fileSize ?? 0) >= PPTX_PERFORMANCE_FILE_SIZE) {
    enabled = true
    reason = 'large-file'
  }

  return {
    enabled,
    reason,
    parseOptions: enabled ? PERFORMANCE_PPTX_PARSE_OPTIONS : DEFAULT_PPTX_PARSE_OPTIONS,
    thumbnailLoad: enabled ? PERFORMANCE_THUMBNAIL_LOAD : DEFAULT_THUMBNAIL_LOAD,
    staticCanvas: enabled,
    maxCanvasPercentage: enabled ? 100 : null,
    maxImageDimension: enabled ? 1280 : null,
  }
}

export const getMediaSrc = (media: { base64?: string; blob?: string; picBase64?: string; picBlob?: string } | null | undefined) => {
  if (!media) return ''
  return media.base64 || media.blob || media.picBase64 || media.picBlob || ''
}

type SlideLike = {
  id: string
  background?: unknown
  elements?: Array<Record<string, any>>
}

export const getFastCanvasSlide = <T extends SlideLike>(slide: T | null | undefined) => {
  const fallbackSlide = {
    id: 'fast-empty',
    background: {
      type: 'solid',
      color: '#fff',
    },
    elements: [],
  }
  if (!slide) return fallbackSlide

  return {
    ...slide,
    id: `${slide.id}-fast`,
    background: slide.background || fallbackSlide.background,
    elements: slide.elements || [],
  }
}

interface ImageDownsampleOptions {
  width: number
  height: number
  maxDimension: number
}

export const getImageDownsampleSize = (options: ImageDownsampleOptions) => {
  const width = Math.max(1, Math.round(options.width))
  const height = Math.max(1, Math.round(options.height))
  const maxOriginalDimension = Math.max(width, height)

  if (maxOriginalDimension <= options.maxDimension) {
    return { width, height, shouldDownsample: false }
  }

  const scale = options.maxDimension / maxOriginalDimension
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    shouldDownsample: true,
  }
}
