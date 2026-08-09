/**
 * Built-in models sometimes emit HTML line breaks / emphasis instead of Markdown.
 * The UI renders Markdown only (no raw HTML), so normalize common HTML artifacts first.
 */
export function normalizeAssistantMarkdown(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n')

  // Line breaks (including the common malformed </br>)
  text = text.replace(/<\s*\/?\s*br\s*\/?\s*>/gi, '\n')

  // Block closers → paragraph breaks
  text = text.replace(/<\s*\/\s*p\s*>/gi, '\n\n')
  text = text.replace(/<\s*p\b[^>]*>/gi, '\n\n')
  text = text.replace(/<\s*\/?\s*div\b[^>]*>/gi, '\n')

  // Inline emphasis → Markdown
  text = text.replace(/<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
  text = text.replace(/<\s*(em|i)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
  text = text.replace(/<\s*code\s*>([\s\S]*?)<\s*\/\s*code\s*>/gi, '`$1`')

  // Drop leftover simple tags; keep inner text for paired tags, remove orphans
  text = text.replace(/<\s*\/?\s*[a-z][a-z0-9]*\b[^>]*>/gi, '')

  // Collapse excessive blank lines / spaces around newlines
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}
