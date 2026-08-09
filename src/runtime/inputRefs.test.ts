import { describe, expect, it } from 'vitest'
import { resolveStepInput } from './inputRefs'

describe('resolveStepInput', () => {
  it('resolves $from against context and prior outputs', () => {
    expect(
      resolveStepInput({ $from: 'context.mainText' }, {}, { mainText: 'hello' }),
    ).toBe('hello')
    expect(
      resolveStepInput({ $from: 'summarize.summary' }, { summarize: { summary: 's' } }, null),
    ).toBe('s')
  })

  it('joins $concat parts after resolving nested refs', () => {
    const resolved = resolveStepInput(
      {
        $concat: [
          'User: ask\nSummary:\n',
          { $from: 'summarize.summary' },
          '\nEnd',
        ],
      },
      { summarize: { summary: 'page bits' } },
      null,
    )
    expect(resolved).toBe('User: ask\nSummary:\npage bits\nEnd')
  })

  it('truncates $truncate refs for prompt-sized context', () => {
    const long = 'x'.repeat(100)
    const resolved = resolveStepInput(
      { $truncate: { $from: 'extract.mainText' }, maxChars: 10 },
      { extract: { mainText: long } },
      null,
    )
    expect(resolved).toBe(`${'x'.repeat(10)}\n…[truncated]`)
  })
})
