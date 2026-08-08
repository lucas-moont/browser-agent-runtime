import type { PageContextInspection, PageSnapshot } from '../../messaging'

export function extractPageSnapshotInPage(): PageSnapshot {
  const selection = window.getSelection()?.toString() ?? ''
  const mainText = document.body?.innerText ?? ''
  return {
    title: document.title,
    url: location.href,
    selection,
    mainText,
  }
}

export function inspectPageContextInPage(): PageContextInspection {
  const selection = window.getSelection()?.toString() ?? ''
  const mainText = document.body?.innerText ?? ''
  return {
    title: document.title,
    url: location.href,
    hasSelection: selection.length > 0,
    selectionLength: selection.length,
    mainTextLength: mainText.length,
  }
}
