export const SIDE_PANEL_PATH = 'src/sidepanel/index.html'

export type SidePanelChromeApi = {
  sidePanel: {
    setOptions(options: {
      tabId?: number
      path?: string
      enabled?: boolean
    }): Promise<void>
    setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>
  }
}

/**
 * Global panel stays off; toolbar click opens the *tab-specific* panel that
 * `syncTabSidePanelOptions` configured. Avoids `sidePanel.open()` after async
 * work, which drops the user-gesture token.
 * @see https://developer.chrome.com/docs/extensions/reference/api/sidePanel
 */
export async function configureTabScopedSidePanelBehavior(
  api: SidePanelChromeApi = chrome as unknown as SidePanelChromeApi,
): Promise<void> {
  await api.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  await api.sidePanel.setOptions({ enabled: false })
}

/**
 * Enable a tab-specific panel path with `homeTabId`, or disable on restricted URLs.
 * Must run before the user clicks the action (onActivated / onUpdated).
 */
export async function syncTabSidePanelOptions(
  tabId: number,
  tabUrl: string | undefined,
  api: SidePanelChromeApi = chrome as unknown as SidePanelChromeApi,
): Promise<void> {
  let allowed = false
  if (tabUrl) {
    try {
      const parsed = new URL(tabUrl)
      allowed = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      allowed = false
    }
  }

  if (!allowed) {
    await api.sidePanel.setOptions({ tabId, enabled: false })
    return
  }

  await api.sidePanel.setOptions({
    tabId,
    path: `${SIDE_PANEL_PATH}?homeTabId=${tabId}`,
    enabled: true,
  })
}
