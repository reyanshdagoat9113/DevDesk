/**
 * Bounded command-run output buffer.
 *
 * Limits are character-length (UTF-16 code units / JS string `.length`),
 * matching `runner.ts` maxBuffer — not UTF-8 byte length.
 *
 * While the stream fits in HEAD+TAIL characters, serialize returns the full
 * concatenation (no marker). Once exceeded, serialize is the first HEAD chars
 * of the entire stream, a truncation marker, and the last TAIL chars. Head is
 * frozen after truncation; only the tail ring is updated.
 */

/** First 64 KiB of the stream, in JS string characters. */
export const RUN_OUTPUT_HEAD_CHARS = 65_536
/** Last 512 KiB of the stream, in JS string characters. */
export const RUN_OUTPUT_TAIL_CHARS = 524_288
export const RUN_OUTPUT_TRUNCATION_MARKER =
  '\n...[output truncated: kept first 64KB and last 512KB]...\n'

const CAP_CHARS = RUN_OUTPUT_HEAD_CHARS + RUN_OUTPUT_TAIL_CHARS
/** Allow the tail string to grow past TAIL before slicing, so chatty 1-char appends stay cheap. */
const TAIL_COMPACT_AT = RUN_OUTPUT_TAIL_CHARS * 2

export type RunOutputBuffer = {
  /** First HEAD characters of the stream (frozen after truncation). */
  head: string
  /** Sliding window of recent output; last TAIL chars after compaction. */
  tail: string
  truncated: boolean
  totalChars: number
}

export function createRunOutputBuffer(): RunOutputBuffer {
  return {
    head: '',
    tail: '',
    truncated: false,
    totalChars: 0,
  }
}

export function appendRunOutput(buffer: RunOutputBuffer, chunk: string): void {
  if (chunk.length === 0) {
    return
  }

  buffer.totalChars += chunk.length

  if (buffer.truncated) {
    appendTailRing(buffer, chunk)
    return
  }

  const headRoom = RUN_OUTPUT_HEAD_CHARS - buffer.head.length
  if (headRoom > 0) {
    if (chunk.length <= headRoom) {
      buffer.head += chunk
      maybeTruncate(buffer)
      return
    }
    buffer.head += chunk.slice(0, headRoom)
    chunk = chunk.slice(headRoom)
  }

  buffer.tail += chunk
  maybeTruncate(buffer)
}

export function serializeRunOutput(buffer: RunOutputBuffer): string {
  if (!buffer.truncated) {
    return buffer.head + buffer.tail
  }
  return buffer.head + RUN_OUTPUT_TRUNCATION_MARKER + compactedTail(buffer)
}

export function runOutputWasTruncated(buffer: RunOutputBuffer): boolean {
  return buffer.truncated
}

function maybeTruncate(buffer: RunOutputBuffer): void {
  if (buffer.totalChars <= CAP_CHARS) {
    return
  }
  buffer.truncated = true
  if (buffer.tail.length > RUN_OUTPUT_TAIL_CHARS) {
    buffer.tail = buffer.tail.slice(-RUN_OUTPUT_TAIL_CHARS)
  }
}

function appendTailRing(buffer: RunOutputBuffer, chunk: string): void {
  buffer.tail += chunk
  if (buffer.tail.length > TAIL_COMPACT_AT) {
    buffer.tail = buffer.tail.slice(-RUN_OUTPUT_TAIL_CHARS)
  }
}

function compactedTail(buffer: RunOutputBuffer): string {
  if (buffer.tail.length > RUN_OUTPUT_TAIL_CHARS) {
    return buffer.tail.slice(-RUN_OUTPUT_TAIL_CHARS)
  }
  return buffer.tail
}
