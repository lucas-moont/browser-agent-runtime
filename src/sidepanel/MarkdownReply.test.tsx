import { createRoot, type Root } from 'react-dom/client'
import { act, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownReply } from './MarkdownReply'
import { ResultView } from './ResultView'

function mount(ui: ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return { container, root }
}

describe('MarkdownReply', () => {
  const mounts: Array<{ container: HTMLDivElement; root: Root }> = []

  afterEach(() => {
    for (const entry of mounts.splice(0)) {
      act(() => {
        entry.root.unmount()
      })
      entry.container.remove()
    }
  })

  it('renders bold and list markers as HTML instead of raw ** / *', () => {
    const markdown = `Focus on these areas:

1. **Deepening Understanding:** Minimize polling.
2. **Mastering Delegation:** Keep subagents disposable.

* **Advanced Resource Management:** Shrink working memory.
* **Strategic Subagent Design:** Avoid context contamination.`

    const { container, root } = mount(<MarkdownReply markdown={markdown} />)
    mounts.push({ container, root })

    expect(container.textContent).not.toContain('**')
    expect(container.querySelectorAll('strong')).toHaveLength(4)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.textContent).toContain('Deepening Understanding')
    expect(container.textContent).toContain('Advanced Resource Management')
  })

  it('opens links in a new tab with noopener', () => {
    const { container, root } = mount(
      <MarkdownReply markdown={'See [docs](https://example.com/path).'} />,
    )
    mounts.push({ container, root })

    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://example.com/path')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('does not show literal br tags from model HTML', () => {
    const { container, root } = mount(
      <MarkdownReply
        markdown={
          'Define Core Terms: Identify unfamiliar words.</br> Look them up.<br/>Next step.'
        }
      />,
    )
    mounts.push({ container, root })

    expect(container.textContent).not.toMatch(/<\/?br/i)
    expect(container.textContent).toContain('words.')
    expect(container.textContent).toContain('Look them up.')
    expect(container.textContent).toContain('Next step.')
  })
})

describe('ResultView conversational markdown', () => {
  const mounts: Array<{ container: HTMLDivElement; root: Root }> = []

  afterEach(() => {
    for (const entry of mounts.splice(0)) {
      act(() => {
        entry.root.unmount()
      })
      entry.container.remove()
    }
  })

  it('renders conversational reply through MarkdownReply', () => {
    const { container, root } = mount(
      <ResultView
        workflowId="conversational"
        result={{
          reply: 'Use **bold** terms in lists:\n\n- one\n- two',
          language: 'en',
          preferredLanguage: 'en',
        }}
        compact
      />,
    )
    mounts.push({ container, root })

    expect(container.querySelector('[data-workflow="conversational"]')).not.toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.textContent).not.toContain('**')
  })
})
