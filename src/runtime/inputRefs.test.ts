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
})
