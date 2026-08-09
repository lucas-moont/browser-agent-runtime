import { describe, expect, it, vi } from 'vitest'
import {
  SIDE_PANEL_PATH,
  configureTabScopedSidePanelBehavior,
  syncTabSidePanelOptions,
} from './tabScopedSidePanel'

describe('tabScopedSidePanel', () => {
  it('disables the global panel and opens the tab panel on action click', async () => {
    const api = {
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        setOptions: vi.fn(async () => undefined),
      },
    }

    await configureTabScopedSidePanelBehavior(api)

    expect(api.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    })
    expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: false })
  })

  it('enables a tab-specific panel path with homeTabId for http(s) tabs', async () => {
    const api = {
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        setOptions: vi.fn(async () => undefined),
      },
    }

    await syncTabSidePanelOptions(42, 'https://example.com/docs', api)

    expect(api.sidePanel.setOptions).toHaveBeenCalledWith({
      tabId: 42,
      path: `${SIDE_PANEL_PATH}?homeTabId=42`,
      enabled: true,
    })
  })

  it('disables the panel on restricted or missing URLs', async () => {
    const api = {
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        setOptions: vi.fn(async () => undefined),
      },
    }

    await syncTabSidePanelOptions(7, 'chrome://extensions', api)
    expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ tabId: 7, enabled: false })

    api.sidePanel.setOptions.mockClear()
    await syncTabSidePanelOptions(8, undefined, api)
    expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ tabId: 8, enabled: false })
  })
})
