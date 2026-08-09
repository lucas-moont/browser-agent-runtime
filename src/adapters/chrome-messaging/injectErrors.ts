/** Map Chrome scripting failures to an actionable Error for page tools. */
export function wrapScriptInjectionError(cause: unknown, tabId: number): Error {
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : 'Unknown scripting error'

  const lower = detail.toLowerCase()
  if (
    lower.includes('cannot access') ||
    lower.includes('chrome://') ||
    lower.includes('chrome-extension://') ||
    lower.includes('restricted')
  ) {
    return new Error(
      `Cannot extract this page (tab ${tabId}): open an http(s) article/docs tab — chrome:// and other restricted URLs are blocked. ${detail}`,
      { cause },
    )
  }

  if (lower.includes('permission') || lower.includes('host')) {
    return new Error(
      `Missing host permission to inject into tab ${tabId}. Reload the unpacked extension after updating host_permissions. ${detail}`,
      { cause },
    )
  }

  return new Error(`Failed to inject into tab ${tabId}: ${detail}`, { cause })
}
