import {
  configureTabScopedSidePanelBehavior,
  syncTabSidePanelOptions,
} from './tabScopedSidePanel'

void configureTabScopedSidePanelBehavior().catch((error: unknown) => {
  console.error(error)
})

function syncFromTab(tabId: number, url: string | undefined): void {
  void syncTabSidePanelOptions(tabId, url).catch((error: unknown) => {
    console.error(error)
  })
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs
    .get(tabId)
    .then((tab) => syncFromTab(tabId, tab.url))
    .catch((error: unknown) => {
      console.error(error)
    })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && changeInfo.url === undefined) {
    return
  }
  syncFromTab(tabId, tab.url)
})

void chrome.tabs
  .query({ active: true, lastFocusedWindow: true })
  .then((tabs) => {
    const tab = tabs[0]
    if (typeof tab?.id === 'number') {
      syncFromTab(tab.id, tab.url)
    }
  })
  .catch((error: unknown) => {
    console.error(error)
  })
