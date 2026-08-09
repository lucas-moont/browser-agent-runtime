import { describe, expect, it } from 'vitest'
import { normalizeAssistantMarkdown } from './normalizeAssistantMarkdown'

describe('normalizeAssistantMarkdown', () => {
  it('turns br / </br> tags into newlines so they are not shown literally', () => {
    const raw = `Learning Path:

Define Core Terms: Identify unfamiliar words.</br> Look them up for definitions.</br>
Foundational Overview: Watch a video or read an introductory guide.</br>
Active Recall: Summarize what you learned.<br/>`

    const normalized = normalizeAssistantMarkdown(raw)

    expect(normalized).not.toMatch(/<\/?br/i)
    expect(normalized).toContain('words.\n Look them up')
    expect(normalized).toContain('definitions.\n\nFoundational Overview')
    expect(normalized).toContain('guide.\n\nActive Recall')
  })

  it('converts HTML bold/italic to Markdown', () => {
    expect(normalizeAssistantMarkdown('Use <b>bold</b> and <i>italic</i>.')).toBe(
      'Use **bold** and *italic*.',
    )
    expect(normalizeAssistantMarkdown('<strong>A</strong> / <em>B</em>')).toBe('**A** / *B*')
  })

  it('strips leftover simple HTML tags without leaving angle brackets', () => {
    expect(normalizeAssistantMarkdown('Hello <span>world</span>.')).toBe('Hello world.')
  })
})
