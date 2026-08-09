import { describe, expect, it, vi } from 'vitest'
import { createFakeMessagingTransport } from '../../messaging/fake-transport'
import { createToolRegistry } from '../ToolRegistry'
import { registerPageTools } from './registerPageTools'

describe('extractWorkspacePages', () => {
  it('extracts multiple WorkspaceTabs and joins mainText with partial errors', async () => {
    const transport = createFakeMessagingTransport({
      async onExtensionToContent(message, tabId) {
        if (tabId === 2) {
          throw new Error('Cannot access a chrome:// URL')
        }
        return {
          type: 'extractPage.response',
          id: message.id,
          page: {
            title: `T${tabId}`,
            url: `https://example.com/${tabId}`,
            selection: '',
            mainText: `body-${tabId}`,
          },
        }
      },
    })

    const workspace = {
      createSession: vi.fn(),
      endSession: vi.fn(),
      listTabs: vi.fn(async () => [
        { tabId: 1, title: 'One', url: 'https://example.com/1', active: true },
        { tabId: 2, title: 'Two', url: 'chrome://version', active: false },
        { tabId: 3, title: 'Three', url: 'https://example.com/3', active: false },
      ]),
      inviteTab: vi.fn(),
      openTab: vi.fn(),
      navigateTab: vi.fn(),
      closeTab: vi.fn(),
      searchWeb: vi.fn(async () => ({
        query: 'x',
        url: 'https://html.duckduckgo.com/html/?q=x',
        mainText: 'results',
        results: [],
        mode: 'fetch' as const,
      })),
    }

    const registry = createToolRegistry()
    registerPageTools(registry, { transport, workspace })

    const result = (await registry.execute(
      'extractWorkspacePages',
      { maxTabs: 5, maxCharsPerTab: 100 },
      { groupId: 9, tabId: 1 },
    )) as {
      pages: unknown[]
      errors: Array<{ tabId: number }>
      mainText: string
    }

    expect(result.pages).toHaveLength(2)
    expect(result.errors).toEqual([{ tabId: 2, message: 'Cannot access a chrome:// URL' }])
    expect(result.mainText).toContain('body-1')
    expect(result.mainText).toContain('body-3')
    expect(result.mainText).toContain('---')
  })
})
