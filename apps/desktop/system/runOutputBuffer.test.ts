import { describe, expect, it } from 'vitest'
import {
  RUN_OUTPUT_HEAD_CHARS,
  RUN_OUTPUT_TAIL_CHARS,
  RUN_OUTPUT_TRUNCATION_MARKER,
  appendRunOutput,
  createRunOutputBuffer,
  runOutputWasTruncated,
  serializeRunOutput,
} from './runOutputBuffer'

const CAP_CHARS = RUN_OUTPUT_HEAD_CHARS + RUN_OUTPUT_TAIL_CHARS
const MAX_SERIALIZED_CHARS =
  RUN_OUTPUT_HEAD_CHARS + RUN_OUTPUT_TRUNCATION_MARKER.length + RUN_OUTPUT_TAIL_CHARS

function fill(buffer: ReturnType<typeof createRunOutputBuffer>, chunks: string[]): void {
  for (const chunk of chunks) {
    appendRunOutput(buffer, chunk)
  }
}

describe('runOutputBuffer', () => {
  it.each([
    { name: 'empty stream', chunks: [] as string[], expected: '' },
    { name: 'empty chunks only', chunks: ['', '', ''], expected: '' },
    { name: 'small single chunk', chunks: ['hello\nworld'], expected: 'hello\nworld' },
    { name: 'small split chunks', chunks: ['hel', 'lo', '\n', 'world'], expected: 'hello\nworld' },
    { name: 'unicode', chunks: ['café ', 'résumé ', '你好'], expected: 'café résumé 你好' },
  ])('serializes $name unchanged and not truncated', ({ chunks, expected }) => {
    const buffer = createRunOutputBuffer()
    fill(buffer, chunks)
    expect(serializeRunOutput(buffer)).toBe(expected)
    expect(runOutputWasTruncated(buffer)).toBe(false)
    expect(buffer.truncated).toBe(false)
    expect(buffer.totalChars).toBe(expected.length)
  })

  it('treats empty chunks as no-ops', () => {
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, 'ab')
    appendRunOutput(buffer, '')
    appendRunOutput(buffer, 'c')
    expect(serializeRunOutput(buffer)).toBe('abc')
    expect(buffer.totalChars).toBe(3)
    expect(runOutputWasTruncated(buffer)).toBe(false)
  })

  it('does not truncate output just at HEAD+TAIL', () => {
    const input = 'a'.repeat(CAP_CHARS)
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, input)
    expect(runOutputWasTruncated(buffer)).toBe(false)
    expect(serializeRunOutput(buffer)).toBe(input)
    expect(serializeRunOutput(buffer).includes(RUN_OUTPUT_TRUNCATION_MARKER)).toBe(false)
  })

  it('does not truncate when split chunks sum to exactly HEAD+TAIL', () => {
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, 'H'.repeat(RUN_OUTPUT_HEAD_CHARS))
    appendRunOutput(buffer, 'T'.repeat(RUN_OUTPUT_TAIL_CHARS))
    expect(runOutputWasTruncated(buffer)).toBe(false)
    expect(serializeRunOutput(buffer)).toBe(
      'H'.repeat(RUN_OUTPUT_HEAD_CHARS) + 'T'.repeat(RUN_OUTPUT_TAIL_CHARS)
    )
  })

  it('truncates output exceeding HEAD+TAIL with frozen head, marker, and last TAIL', () => {
    const extra = 97
    const full =
      'H'.repeat(RUN_OUTPUT_HEAD_CHARS) + 'M'.repeat(1000) + 'T'.repeat(RUN_OUTPUT_TAIL_CHARS + extra)
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, full)

    const serialized = serializeRunOutput(buffer)
    expect(runOutputWasTruncated(buffer)).toBe(true)
    expect(buffer.head).toBe(full.slice(0, RUN_OUTPUT_HEAD_CHARS))
    expect(serialized.startsWith(full.slice(0, RUN_OUTPUT_HEAD_CHARS))).toBe(true)
    expect(serialized.endsWith(full.slice(-RUN_OUTPUT_TAIL_CHARS))).toBe(true)
    expect(serialized.split(RUN_OUTPUT_TRUNCATION_MARKER)).toHaveLength(2)
    expect(serialized.length).toBe(MAX_SERIALIZED_CHARS)
    expect(serialized.length).toBeLessThanOrEqual(MAX_SERIALIZED_CHARS)
  })

  it('keeps original head frozen and tail equal to last TAIL chars across later appends', () => {
    const first = 'A'.repeat(CAP_CHARS + 10)
    const second = 'B'.repeat(200)
    const third = 'C'.repeat(50)
    const full = first + second + third

    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, first)
    const frozenHead = buffer.head
    expect(runOutputWasTruncated(buffer)).toBe(true)

    appendRunOutput(buffer, second)
    appendRunOutput(buffer, third)

    expect(buffer.head).toBe(frozenHead)
    expect(buffer.head).toBe(full.slice(0, RUN_OUTPUT_HEAD_CHARS))
    expect(runOutputWasTruncated(buffer)).toBe(true)

    const serialized = serializeRunOutput(buffer)
    expect(serialized.startsWith(full.slice(0, RUN_OUTPUT_HEAD_CHARS))).toBe(true)
    expect(serialized.endsWith(full.slice(-RUN_OUTPUT_TAIL_CHARS))).toBe(true)
    expect(serialized.split(RUN_OUTPUT_TRUNCATION_MARKER)).toHaveLength(2)
    expect(serialized.length).toBeLessThanOrEqual(MAX_SERIALIZED_CHARS)
  })

  it('inserts the truncation marker only once', () => {
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, 'x'.repeat(CAP_CHARS + 1))
    appendRunOutput(buffer, 'y'.repeat(1024))
    const serialized = serializeRunOutput(buffer)
    const first = serialized.indexOf(RUN_OUTPUT_TRUNCATION_MARKER)
    const last = serialized.lastIndexOf(RUN_OUTPUT_TRUNCATION_MARKER)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(last).toBe(first)
  })

  it('bounds serialized length by HEAD + marker + TAIL', () => {
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, 'n'.repeat(CAP_CHARS * 3))
    appendRunOutput(buffer, 'o'.repeat(RUN_OUTPUT_TAIL_CHARS))
    const serialized = serializeRunOutput(buffer)
    expect(serialized.length).toBeLessThanOrEqual(MAX_SERIALIZED_CHARS)
    expect(serialized.length).toBe(MAX_SERIALIZED_CHARS)
  })

  it('yields correct head/tail when appending many 1-char chunks totaling > HEAD+TAIL', () => {
    const extra = 32
    const full =
      'H'.repeat(RUN_OUTPUT_HEAD_CHARS) + 'T'.repeat(RUN_OUTPUT_TAIL_CHARS) + 'X'.repeat(extra)
    const buffer = createRunOutputBuffer()
    for (let i = 0; i < full.length; i += 1) {
      appendRunOutput(buffer, full[i] as string)
    }

    expect(runOutputWasTruncated(buffer)).toBe(true)
    expect(buffer.head).toBe(full.slice(0, RUN_OUTPUT_HEAD_CHARS))
    expect(buffer.totalChars).toBe(full.length)

    const serialized = serializeRunOutput(buffer)
    expect(serialized.startsWith(full.slice(0, RUN_OUTPUT_HEAD_CHARS))).toBe(true)
    expect(serialized.endsWith(full.slice(-RUN_OUTPUT_TAIL_CHARS))).toBe(true)
    expect(serialized.split(RUN_OUTPUT_TRUNCATION_MARKER)).toHaveLength(2)
    expect(serialized.length).toBeLessThanOrEqual(MAX_SERIALIZED_CHARS)
  })

  it('preserves the truncated flag once set', () => {
    const buffer = createRunOutputBuffer()
    appendRunOutput(buffer, 'z'.repeat(CAP_CHARS + 1))
    expect(runOutputWasTruncated(buffer)).toBe(true)
    appendRunOutput(buffer, '')
    appendRunOutput(buffer, 'more')
    expect(runOutputWasTruncated(buffer)).toBe(true)
  })
})
