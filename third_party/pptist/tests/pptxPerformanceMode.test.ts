import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PPTX_PERFORMANCE_FILE_SIZE,
  getFastCanvasSlide,
  getImageDownsampleSize,
  getPptxPerformanceConfig,
} from '../src/utils/pptxPerformanceMode.ts'

test('keeps the default import and thumbnail behavior for normal files', () => {
  const config = getPptxPerformanceConfig({
    fileSize: PPTX_PERFORMANCE_FILE_SIZE - 1,
    search: '',
    embedMode: false,
  })

  assert.equal(config.enabled, false)
  assert.equal(config.reason, 'default')
  assert.deepEqual(config.parseOptions, {
    imageMode: 'base64',
    videoMode: 'blob',
    audioMode: 'blob',
  })
  assert.deepEqual(config.thumbnailLoad, {
    initialLimit: 50,
    batchSize: 20,
    delayMs: 600,
    resetOnSlidesChange: false,
    maxVisible: 50,
    neighborRange: 0,
  })
  assert.equal(config.staticCanvas, false)
  assert.equal(config.maxCanvasPercentage, null)
  assert.equal(config.maxImageDimension, null)
})

test('enables performance mode automatically for large PPTX files', () => {
  const config = getPptxPerformanceConfig({
    fileSize: PPTX_PERFORMANCE_FILE_SIZE,
    search: '',
    embedMode: false,
  })

  assert.equal(config.enabled, true)
  assert.equal(config.reason, 'large-file')
  assert.deepEqual(config.parseOptions, {
    imageMode: 'blob',
    videoMode: 'none',
    audioMode: 'none',
  })
  assert.deepEqual(config.thumbnailLoad, {
    initialLimit: 3,
    batchSize: 2,
    delayMs: 900,
    resetOnSlidesChange: true,
    maxVisible: 20,
    neighborRange: 1,
  })
  assert.equal(config.staticCanvas, true)
  assert.equal(config.maxCanvasPercentage, 100)
  assert.equal(config.maxImageDimension, 1280)
})

test('allows URL params to force performance mode on or off', () => {
  assert.equal(getPptxPerformanceConfig({
    fileSize: 1024,
    search: '?pptxPerformance=1',
    embedMode: false,
  }).enabled, true)

  assert.deepEqual(getPptxPerformanceConfig({
    fileSize: PPTX_PERFORMANCE_FILE_SIZE * 2,
    search: '?pptxPerformance=0',
    embedMode: false,
  }).parseOptions, {
    imageMode: 'base64',
    videoMode: 'blob',
    audioMode: 'blob',
  })
})

test('uses performance thumbnail loading in embedded mode', () => {
  const config = getPptxPerformanceConfig({
    fileSize: 1024,
    search: '',
    embedMode: true,
  })

  assert.equal(config.enabled, true)
  assert.equal(config.reason, 'embed')
  assert.equal(config.thumbnailLoad.maxVisible, 20)
  assert.equal(config.staticCanvas, true)
  assert.equal(config.maxCanvasPercentage, 100)
  assert.equal(config.maxImageDimension, 1280)
})

test('fast canvas preserves slide content while dropping edit chrome', () => {
  const slide = {
    id: 'slide-1',
    background: {
      type: 'image',
      image: {
        src: 'blob:background',
        size: 'cover',
      },
    },
    elements: [
      { id: 'text-1', type: 'text', left: 0, top: 0, width: 100, height: 20 },
    ],
  }

  const fastSlide = getFastCanvasSlide(slide, { viewportSize: 1000, viewportRatio: 0.5625 })

  assert.equal(fastSlide.id, 'slide-1-fast')
  assert.deepEqual(fastSlide.background, slide.background)
  assert.deepEqual(fastSlide.elements, slide.elements)
})

test('downsample sizing preserves aspect ratio and skips small images', () => {
  assert.deepEqual(getImageDownsampleSize({
    width: 4000,
    height: 2000,
    maxDimension: 1280,
  }), {
    width: 1280,
    height: 640,
    shouldDownsample: true,
  })

  assert.deepEqual(getImageDownsampleSize({
    width: 800,
    height: 600,
    maxDimension: 1280,
  }), {
    width: 800,
    height: 600,
    shouldDownsample: false,
  })
})
