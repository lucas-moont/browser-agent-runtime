import { describe, expect, it, vi } from 'vitest'
import { createChromeAgentWorkspace } from './createChromeAgentWorkspace'
import { AGENT_WORKSPACE_TITLE, isAllowedWorkspaceUrl } from './types'

describe('isAllowedWorkspaceUrl', () => {
  it('allows http(s) only', () => {
    expect(isAllowedWorkspaceUrl('https://example.com')).toBe(true)
    expect(isAllowedWorkspaceUrl('http://example.com')).toBe(true)
    expect(isAllowedWorkspaceUrl('chrome://extensions')).toBe(false)
    expect(isAllowedWorkspaceUrl('not a url')).toBe(false)
  })
})

describe('createChromeAgentWorkspace', () => {
  it('createSession always groups the seed tab into a new titled workspace', async () => {
    const group = vi.fn(async () => 42)
    const update = vi.fn(async () => undefined)
    const get = vi.fn(async () => ({
      id: 7,
      windowId: 1,
      url: 'https://example.com/docs',
      status: 'complete',
    }))
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: {
        query: vi.fn(),
        update,
      },
      tabs: {
        query: vi.fn(),
        get,
        group,
        ungroup: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.createSession(7)).resolves.toBe(42)
    expect(group).toHaveBeenCalledWith({
      tabIds: 7,
      createProperties: { windowId: 1 },
    })
    expect(update).toHaveBeenCalledWith(42, {
      title: AGENT_WORKSPACE_TITLE,
      color: 'blue',
    })
  })

  it('createSession rejects non-http seed tabs', async () => {
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(),
        get: vi.fn(async () => ({ id: 3, url: 'chrome://extensions', windowId: 1 })),
        group: vi.fn(),
        ungroup: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.createSession(3)).rejects.toThrow(/http\(s\)/)
  })

  it('endSession ungroups member tabs without closing them', async () => {
    const ungroup = vi.fn(async () => undefined)
    const remove = vi.fn(async () => undefined)
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(async () => [{ id: 7 }, { id: 8 }]),
        get: vi.fn(),
        group: vi.fn(),
        ungroup,
        create: vi.fn(),
        update: vi.fn(),
        remove,
      },
    } as never)

    await workspace.endSession(42)
    expect(ungroup).toHaveBeenCalledWith([7, 8])
    expect(remove).not.toHaveBeenCalled()
  })

  it('endSession is a no-op when the group has no tabs', async () => {
    const ungroup = vi.fn(async () => undefined)
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(async () => []),
        get: vi.fn(),
        group: vi.fn(),
        ungroup,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await workspace.endSession(99)
    expect(ungroup).not.toHaveBeenCalled()
  })

  it('rejects non-http open and out-of-group close', async () => {
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(async () => [{ id: 2 }]),
        get: vi.fn(),
        group: vi.fn(),
        ungroup: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.openTab(1, 'chrome://version')).rejects.toThrow(/http/)
    await expect(workspace.closeTab(1, 99)).rejects.toThrow(/not in the AgentWorkspace/)
  })

  it('fetches DuckDuckGo SERP without opening a tab', async () => {
    const create = vi.fn(async () => ({ id: 8 }))
    const html = `
      <div class="result results_links">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=${encodeURIComponent('https://example.com/a')}">Alpha Title</a>
        <a class="result__snippet">Alpha snippet</a>
      </div>
    `
    const fetchImpl = vi.fn(async () =>
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    const workspace = createChromeAgentWorkspace(
      {
        windows: { getCurrent: vi.fn() },
        tabGroups: { query: vi.fn(), update: vi.fn() },
        tabs: {
          query: vi.fn(),
          get: vi.fn(),
          group: vi.fn(),
          ungroup: vi.fn(),
          create,
          update: vi.fn(),
          remove: vi.fn(),
        },
      } as never,
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )

    const result = await workspace.searchWeb(1, 'agent runtime')
    expect(result.mode).toBe('fetch')
    expect(result.tabId).toBeUndefined()
    expect(result.mainText).toContain('Alpha Title')
    expect(result.results[0]?.url).toContain('example.com/a')
    expect(create).not.toHaveBeenCalled()
  })

  it('falls back to Google tab extract when DuckDuckGo returns empty', async () => {
    const create = vi.fn(async () => ({ id: 8 }))
    const group = vi.fn(async () => 1)
    const remove = vi.fn(async () => undefined)
    const get = vi.fn(async () => ({ id: 8, status: 'complete' }))
    const executeScript = vi.fn(async () => [{ result: 'Google SERP body text' }])
    const fetchImpl = vi.fn(async () =>
      new Response('<html><body>no results</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    const workspace = createChromeAgentWorkspace(
      {
        windows: { getCurrent: vi.fn() },
        tabGroups: { query: vi.fn(), update: vi.fn() },
        tabs: {
          query: vi.fn(async () => [{ id: 8 }]),
          get,
          group,
          ungroup: vi.fn(),
          create,
          update: vi.fn(),
          remove,
        },
        scripting: { executeScript },
      } as never,
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )

    const result = await workspace.searchWeb(1, 'agent runtime')
    expect(result.mode).toBe('tab')
    expect(result.mainText).toContain('Google SERP body text')
    expect(result.url).toContain('google.com/search')
    expect(create).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(8)
  })
})
