import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import { normalizeAssistantMarkdown } from './normalizeAssistantMarkdown'

const components: Components = {
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
}

export function MarkdownReply({ markdown }: { markdown: string }) {
  const normalized = normalizeAssistantMarkdown(markdown)
  if (!normalized) {
    return <p className="result-view__reply-fallback">—</p>
  }

  return (
    <div className="markdown-reply">
      <Markdown components={components}>{normalized}</Markdown>
    </div>
  )
}
