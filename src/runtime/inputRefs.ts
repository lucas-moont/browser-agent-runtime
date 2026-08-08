export type StepInputRef = {
  $from: string
}

function isStepInputRef(value: unknown): value is StepInputRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as StepInputRef).$from === 'string' &&
    Object.keys(value as object).length === 1
  )
}

function readPath(root: unknown, path: string): unknown {
  if (!path) {
    return root
  }
  const parts = path.split('.').filter(Boolean)
  let current: unknown = root
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveStepInput(
  input: unknown,
  outputs: Record<string, unknown>,
  context: unknown,
): unknown {
  if (isStepInputRef(input)) {
    const path = input.$from
    if (path === 'context' || path.startsWith('context.')) {
      const rest = path === 'context' ? '' : path.slice('context.'.length)
      return readPath(context, rest)
    }
    const dot = path.indexOf('.')
    if (dot === -1) {
      return outputs[path]
    }
    const stepId = path.slice(0, dot)
    const rest = path.slice(dot + 1)
    return readPath(outputs[stepId], rest)
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveStepInput(item, outputs, context))
  }

  if (input !== null && typeof input === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      result[key] = resolveStepInput(value, outputs, context)
    }
    return result
  }

  return input
}
