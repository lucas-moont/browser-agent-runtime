export type SerpResult = {
  title: string
  url: string
  snippet: string
}

export type ParsedSerp = {
  results: SerpResult[]
  mainText: string
}

export function buildDuckDuckGoSearchUrl(query: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function unwrapDuckRedirect(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com')
    if (url.hostname.includes('duckduckgo.com') && url.pathname.startsWith('/l/')) {
      const uddg = url.searchParams.get('uddg')
      if (uddg) {
        return decodeURIComponent(uddg)
      }
    }
    return url.href
  } catch {
    return href
  }
}

/**
 * Tolerant parser for DuckDuckGo HTML SERP. Uses regex so Vitest/node do not need a DOM.
 */
export function parseDuckDuckGoHtml(html: string): ParsedSerp {
  const results: SerpResult[] = []
  const resultBlock =
    /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*result[^"]*"|<\/body>|$)/gi
  const blocks = html.match(resultBlock) ?? []

  for (const block of blocks) {
    const titleMatch =
      block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
    if (!titleMatch) {
      continue
    }
    const href = unwrapDuckRedirect(decodeBasicEntities(titleMatch[1] ?? ''))
    const title = stripTags(titleMatch[2] ?? '')
    if (!title || !href || href.startsWith('https://duckduckgo.com')) {
      continue
    }
    const snippetMatch =
      block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ??
      block.match(/<td[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const snippet = snippetMatch ? stripTags(snippetMatch[1] ?? '') : ''
    results.push({ title, url: href, snippet })
    if (results.length >= 10) {
      break
    }
  }

  const mainText = results
    .map((result, index) => {
      const lines = [`${index + 1}. ${result.title}`, `URL: ${result.url}`]
      if (result.snippet) {
        lines.push(result.snippet)
      }
      return lines.join('\n')
    })
    .join('\n\n')

  return { results, mainText }
}

export async function fetchDuckDuckGoSerp(
  query: string,
  options?: {
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  },
): Promise<{ url: string; html: string; parsed: ParsedSerp }> {
  const url = buildDuckDuckGoSearchUrl(query)
  const fetchImpl = options?.fetchImpl ?? fetch
  const response = await fetchImpl(url, {
    method: 'GET',
    signal: options?.signal,
    headers: {
      Accept: 'text/html',
    },
  })
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with HTTP ${response.status}`)
  }
  const html = await response.text()
  return { url, html, parsed: parseDuckDuckGoHtml(html) }
}
