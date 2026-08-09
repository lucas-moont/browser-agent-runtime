export const MAX_SEARCH_QUERY_CHARS = 120

const INSTRUCTIONAL_PHRASE_PATTERNS: RegExp[] = [
  /\bsearch (the )?(web|internet|online) (for (me )?)?(about )?/gi,
  /\bgoogle\b/gi,
  /\blook up (online )?/gi,
  /\bfind online\b/gi,
  /\bsimilar articles like this one\b/gi,
  /\barticles like this( one)?\b/gi,
  /\blike this one\b/gi,
  /\blike this\b/gi,
  /\bmore articles\b/gi,
  /\bthe goal is\b[^.!?]*/gi,
  /\bimprove my knowledge\b[^.!?]*/gi,
  /\binto the subject\b/gi,
  /\bcan you\b/gi,
  /\bcould you\b/gi,
  /\bplease\b/gi,
  /\bfor me\b/gi,
]

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'on',
  'my',
  'me',
  'i',
  'is',
  'are',
  'this',
  'that',
  'with',
  'from',
  'about',
  'into',
  'will',
  'make',
  'want',
  'need',
  'help',
  'subject',
  'knowledge',
  'goal',
  'ones',
  'most',
  'interesting',
  'correlate',
  'depth',
  'deepen',
  'related',
  'reading',
  'bring',
  'think',
  'yourself',
])

export function stripInstructionalSearchProse(text: string): string {
  let cleaned = text.trim()
  for (const pattern of INSTRUCTIONAL_PHRASE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  return cleaned.replace(/[?.!,;:]+$/g, '').replace(/\s+/g, ' ').trim()
}

export function compactSearchQuery(parts: string[], maxChars = MAX_SEARCH_QUERY_CHARS): string {
  const merged = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (merged.length <= maxChars) {
    return merged
  }
  return merged.slice(0, maxChars).replace(/\s+\S*$/, '').trim()
}

export function topicExtrasFromInstruction(instruction: string, title: string): string {
  const cleaned = stripInstructionalSearchProse(instruction)
  const titleLower = title.toLowerCase()
  return cleaned
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter((word) => word.length > 3)
    .filter((word) => !STOPWORDS.has(word.toLowerCase()))
    .filter((word) => !titleLower.includes(word.toLowerCase()))
    .slice(0, 4)
    .join(' ')
}

export type SearchQueryQualityFixture = {
  mustInclude?: string[]
  mustNotInclude?: string[]
  maxChars?: number
}

export type SearchQueryQualityIssue = {
  code: 'empty' | 'too_long' | 'missing_token' | 'forbidden_phrase' | 'trailing_punct'
  detail: string
}

export function evaluateSearchQueryQuality(
  query: string,
  fixture: SearchQueryQualityFixture = {},
): SearchQueryQualityIssue[] {
  const issues: SearchQueryQualityIssue[] = []
  const trimmed = query.trim()
  const maxChars = fixture.maxChars ?? MAX_SEARCH_QUERY_CHARS

  if (!trimmed) {
    issues.push({ code: 'empty', detail: 'Query is empty' })
    return issues
  }

  if (trimmed.length > maxChars) {
    issues.push({
      code: 'too_long',
      detail: `Query length ${trimmed.length} exceeds ${maxChars}`,
    })
  }

  if (/[?.!,;:]{2,}$/.test(trimmed) || /[?.!]{1}$/.test(trimmed)) {
    issues.push({ code: 'trailing_punct', detail: 'Query has trailing punctuation spam' })
  }

  const lower = trimmed.toLowerCase()
  for (const token of fixture.mustInclude ?? []) {
    if (!lower.includes(token.toLowerCase())) {
      issues.push({ code: 'missing_token', detail: `Missing required token: ${token}` })
    }
  }

  for (const phrase of fixture.mustNotInclude ?? []) {
    if (lower.includes(phrase.toLowerCase())) {
      issues.push({ code: 'forbidden_phrase', detail: `Contains forbidden phrase: ${phrase}` })
    }
  }

  return issues
}

export function assertGoodSearchQuery(query: string, fixture: SearchQueryQualityFixture = {}): void {
  const issues = evaluateSearchQueryQuality(query, fixture)
  if (issues.length > 0) {
    throw new Error(
      `Search query failed quality checks:\n${issues.map((issue) => `- ${issue.detail}`).join('\n')}\nQuery: ${JSON.stringify(query)}`,
    )
  }
}
