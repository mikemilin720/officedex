import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAnimatedTextEditFrames,
  getAnimatedTextEditTiming,
  getElementTextEditContent,
} from '../src/utils/embedTextAnimation.ts'

test('builds typewriter frames that clear visible text while preserving text markup', () => {
  const frames = buildAnimatedTextEditFrames('<p><span style="color:#f00">Old</span></p>', 'New')

  assert.equal(frames[0], '<p><span style="color:#f00"></span></p>')
  assert.equal(frames.at(-1), '<p><span style="color:#f00">New</span></p>')
})

test('builds an empty final frame when replacement text is empty', () => {
  const frames = buildAnimatedTextEditFrames('<p><strong>Old</strong></p>', '')

  assert.equal(frames.length, 1)
  assert.equal(frames[0], '<p><strong></strong></p>')
})

test('keeps short typewriter edits visible long enough to perceive', () => {
  const timing = getAnimatedTextEditTiming(6, { clearFirst: true, reducedMotion: false })

  assert.ok(timing.clearHoldMs >= 200)
  assert.ok(timing.frameDelayMs >= 90)
  assert.ok(timing.finalHoldMs >= 300)
})

test('skips typewriter delays for reduced motion users', () => {
  const timing = getAnimatedTextEditTiming(6, { clearFirst: true, reducedMotion: true })

  assert.deepEqual(timing, { clearHoldMs: 0, frameDelayMs: 0, finalHoldMs: 0 })
})

test('reads text-editable content from text elements and shape text', () => {
  assert.equal(
    getElementTextEditContent({ id: 'title', type: 'text', content: '<p>Title</p>' }),
    '<p>Title</p>',
  )
  assert.equal(
    getElementTextEditContent({
      id: 'shape',
      type: 'shape',
      text: { content: '<p>Shape text</p>' },
    }),
    '<p>Shape text</p>',
  )
})
