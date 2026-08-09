/**
 * Parse model structured output. Chrome Prompt may wrap JSON in fences or prose.
 */
export function parseStructuredJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new SyntaxError('Empty structured output')
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim()) as unknown
  }

  const startObj = trimmed.indexOf('{')
  const endObj = trimmed.lastIndexOf('}')
  if (startObj >= 0 && endObj > startObj) {
    return JSON.parse(trimmed.slice(startObj, endObj + 1)) as unknown
  }

  const startArr = trimmed.indexOf('[')
  const endArr = trimmed.lastIndexOf(']')
  if (startArr >= 0 && endArr > startArr) {
    return JSON.parse(trimmed.slice(startArr, endArr + 1)) as unknown
  }

  throw new SyntaxError('Structured output is not valid JSON')
}
