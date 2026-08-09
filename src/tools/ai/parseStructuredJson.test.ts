import { describe, expect, it } from 'vitest'
import { parseStructuredJson } from './parseStructuredJson'

describe('parseStructuredJson', () => {
  it('parses plain JSON', () => {
    expect(parseStructuredJson('{"reply":"hi"}')).toEqual({ reply: 'hi' })
  })

  it('parses fenced JSON', () => {
    expect(parseStructuredJson('```json\n{"reply":"hi"}\n```')).toEqual({ reply: 'hi' })
  })

  it('extracts the first object from prose', () => {
    expect(parseStructuredJson('Sure:\n{"reply":"ok"}\nThanks')).toEqual({ reply: 'ok' })
  })

  it('throws on empty or non-json text', () => {
    expect(() => parseStructuredJson('')).toThrow(/Empty|valid JSON/i)
    expect(() => parseStructuredJson('not json at all')).toThrow()
  })
})
