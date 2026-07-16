type TextEditableElement = {
  type?: string
  content?: string
  text?: {
    content?: string
  }
}

type HtmlSegment = {
  type: 'tag' | 'text'
  value: string
}

const HTML_TAG_RE = /<[^>]*>/g
const CLEAR_HOLD_MS = 260
const FINAL_HOLD_MS = 360
const MIN_FRAME_DELAY_MS = 34
const MAX_FRAME_DELAY_MS = 360
const SHORT_EDIT_TYPING_WINDOW_MS = 580

type AnimatedTextEditTimingOptions = {
  clearFirst?: boolean
  reducedMotion?: boolean
}

export function getAnimatedTextEditTiming(frameCount: number, options: AnimatedTextEditTimingOptions = {}) {
  if (options.reducedMotion) return { clearHoldMs: 0, frameDelayMs: 0, finalHoldMs: 0 }

  const typingFrameCount = Math.max(1, frameCount - 1)
  const frameDelayMs = clamp(
    Math.ceil(SHORT_EDIT_TYPING_WINDOW_MS / typingFrameCount),
    MIN_FRAME_DELAY_MS,
    MAX_FRAME_DELAY_MS,
  )

  return {
    clearHoldMs: options.clearFirst === false ? 0 : CLEAR_HOLD_MS,
    frameDelayMs,
    finalHoldMs: FINAL_HOLD_MS,
  }
}

export function getElementTextEditContent(element: TextEditableElement | null | undefined): string | null {
  if (!element) return null
  if (element.type === 'text' && typeof element.content === 'string') return element.content
  if (element.type === 'shape' && element.text && typeof element.text.content === 'string') return element.text.content
  return null
}

export function buildAnimatedTextEditFrames(sourceHtml: string, finalText: string): string[] {
  const chars = Array.from(finalText)
  return Array.from({ length: chars.length + 1 }, (_, index) => {
    return replaceHTMLVisibleTextPreservingMarkup(sourceHtml, chars.slice(0, index).join(''))
  })
}

export function replaceHTMLVisibleTextPreservingMarkup(sourceHtml: string, text: string): string {
  const html = sourceHtml || '<p></p>'
  const escapedText = escapeHTMLText(text)
  const segments = tokenizeHTML(html)
  const textIndexes = segments
    .map((segment, index) => segment.type === 'text' ? index : -1)
    .filter(index => index >= 0)

  if (textIndexes.length > 0) {
    return segments.map((segment, index) => {
      if (index === textIndexes[0]) return escapedText
      if (textIndexes.includes(index)) return ''
      return segment.value
    }).join('')
  }

  const closingTagIndex = html.search(/<\/[^>]+>/)
  if (closingTagIndex >= 0) {
    return `${html.slice(0, closingTagIndex)}${escapedText}${html.slice(closingTagIndex)}`
  }
  return `<p>${escapedText}</p>`
}

function tokenizeHTML(html: string): HtmlSegment[] {
  const segments: HtmlSegment[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  HTML_TAG_RE.lastIndex = 0

  while ((match = HTML_TAG_RE.exec(html)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: html.slice(cursor, match.index) })
    }
    segments.push({ type: 'tag', value: match[0] })
    cursor = match.index + match[0].length
  }

  if (cursor < html.length) {
    segments.push({ type: 'text', value: html.slice(cursor) })
  }
  return segments
}

function escapeHTMLText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
