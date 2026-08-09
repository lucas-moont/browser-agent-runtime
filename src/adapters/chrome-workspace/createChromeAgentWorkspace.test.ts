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
  it('reuses an existing titled group', async () => {
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
      tabGroups: {
        query: vi.fn(async () => [{ id: 9, title: AGENT_WORKSPACE_TITLE, color: 'blue' }]),
        update: vi.fn(async () => undefined),
      },
      tabs: {
        query: vi.fn(),
        group: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.ensureWorkspace()).resolves.toBe(9)
  })

  it('creates a group from the active tab when none exists', async () => {
    const group = vi.fn(async () => 42)
    const update = vi.fn(async () => undefined)
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
      tabGroups: {
        query: vi.fn(async () => []),
        update,
      },
      tabs: {
        query: vi.fn(async () => [{ id: 7, active: true }]),
        get: vi.fn(async () => ({ id: 7, status: 'complete' })),
        group,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.ensureWorkspace()).resolves.toBe(42)
    expect(group).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(42, {
      title: AGENT_WORKSPACE_TITLE,
      color: 'blue',
    })
  })

  it('rejects non-http open and out-of-group close', async () => {
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(async () => [{ id: 2 }]),
        get: vi.fn(),
        group: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    await expect(workspace.openTab(1, 'chrome://version')).rejects.toThrow(/http/)
    await expect(workspace.closeTab(1, 99)).rejects.toThrow(/not in the AgentWorkspace/)
  })

  it('opens a search results page inside the workspace', async () => {
    const create = vi.fn(async () => ({ id: 8 }))
    const group = vi.fn(async () => 1)
    const get = vi.fn(async () => ({ id: 8, status: 'complete' }))
    const workspace = createChromeAgentWorkspace({
      windows: { getCurrent: vi.fn() },
      tabGroups: { query: vi.fn(), update: vi.fn() },
      tabs: {
        query: vi.fn(),
        get,
        group,
        create,
        update: vi.fn(),
        remove: vi.fn(),
      },
    } as never)

    const result = await workspace.searchWeb(1, 'agent runtime')
    expect(result.tabId).toBe(8)
    expect(result.url).toContain('google.com/search')
    expect(result.url).toContain('agent')
    expect(create).toHaveBeenCalled()
  })
})
