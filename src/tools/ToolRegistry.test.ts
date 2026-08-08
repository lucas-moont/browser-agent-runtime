import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createFakeMessagingTransport } from '../messaging'
import {
  DuplicateToolError,
  ToolInputValidationError,
  ToolRegistry,
  UnknownToolError,
  createExtractPageTool,
  createInspectPageContextTool,
  createToolRegistry,
  registerPageTools,
  type AgentTool,
  type ToolContext,
} from './index'

const pageSnapshot = {
  title: 'Example',
  url: 'https://example.com/',
  selection: 'hello',
  mainText: 'hello world',
}

const pageInspection = {
  title: 'Example',
  url: 'https://example.com/',
  hasSelection: true,
  selectionLength: 5,
  mainTextLength: 11,
}

const toolContext: ToolContext = { tabId: 42 }

function sampleTool(name: string): AgentTool {
  return {
    name,
    description: `${name} tool`,
    capabilities: [],
    dataBoundary: 'LOCAL',
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({ ok: z.literal(true) }),
    async execute() {
      return { ok: true as const }
    },
  }
}

describe('ToolRegistry seam', () => {
  it('registers, lists, and gets tools by name', () => {
    const registry = createToolRegistry()
    const tool = sampleTool('alpha')

    registry.register(tool)

    expect(registry.get('alpha')).toBe(tool)
    expect(registry.list().map((entry) => entry.name)).toEqual(['alpha'])
  })

  it('rejects duplicate tool names', () => {
    const registry = createToolRegistry()
    registry.register(sampleTool('alpha'))

    expect(() => registry.register(sampleTool('alpha'))).toThrow(DuplicateToolError)
  })

  it('fails execute for an unknown tool without invoking adapters', async () => {
    const registry = createToolRegistry()

    await expect(registry.execute('missing', {}, toolContext)).rejects.toBeInstanceOf(UnknownToolError)
  })

  it('extractPage returns the Messaging port snapshot without Chrome transport', async () => {
    const transport = createFakeMessagingTransport({
      async onExtensionToContent(message, tabId) {
        expect(tabId).toBe(42)
        expect(message.type).toBe('extractPage.request')
        return {
          type: 'extractPage.response',
          id: message.id,
          page: pageSnapshot,
        }
      },
    })

    const registry = createToolRegistry()
    registerPageTools(registry, { transport })

    const tool = registry.get('extractPage')
    expect(tool?.dataBoundary).toBe('BROWSER')
    expect(tool?.capabilities).toEqual([])

    const result = await registry.execute('extractPage', {}, toolContext)

    expect(result).toEqual(pageSnapshot)
    expect(transport.sentToContentScript).toHaveLength(1)
    expect(transport.sentToContentScript[0]?.message.type).toBe('extractPage.request')
  })

  it('inspectPageContext returns inspection via Messaging port with dataBoundary BROWSER', async () => {
    const transport = createFakeMessagingTransport({
      async onExtensionToContent(message, tabId) {
        expect(tabId).toBe(42)
        expect(message.type).toBe('inspectPageContext.request')
        return {
          type: 'inspectPageContext.response',
          id: message.id,
          context: pageInspection,
        }
      },
    })

    const registry = createToolRegistry()
    registry.register(createExtractPageTool({ transport }))
    registry.register(createInspectPageContextTool({ transport }))

    const tool = registry.get('inspectPageContext')
    expect(tool?.dataBoundary).toBe('BROWSER')

    await expect(registry.execute('inspectPageContext', {}, toolContext)).resolves.toEqual(pageInspection)
  })

  it('rejects invalid extractPage input before calling Messaging', async () => {
    const onExtensionToContent = vi.fn()
    const transport = createFakeMessagingTransport({ onExtensionToContent })
    const registry = createToolRegistry()
    registerPageTools(registry, { transport })

    await expect(registry.execute('extractPage', { unexpected: true }, toolContext)).rejects.toBeInstanceOf(
      ToolInputValidationError,
    )
    expect(onExtensionToContent).not.toHaveBeenCalled()
  })

  it('rejects invalid inspectPageContext input before calling Messaging', async () => {
    const onExtensionToContent = vi.fn()
    const transport = createFakeMessagingTransport({ onExtensionToContent })
    const registry = new ToolRegistry()
    registerPageTools(registry, { transport })

    await expect(
      registry.execute('inspectPageContext', { tabId: 1 }, toolContext),
    ).rejects.toBeInstanceOf(ToolInputValidationError)
    expect(onExtensionToContent).not.toHaveBeenCalled()
  })
})
