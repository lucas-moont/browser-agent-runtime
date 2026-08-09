import { z } from 'zod'
import {
  decodeInboundFromContentScript,
  encodeOutboundToContentScript,
  pageSnapshotSchema,
  type MessagingTransport,
  type PageSnapshot,
} from '../../messaging'
import type { AgentTool } from '../types'
import { ToolError } from '../types'

const extractPageInputSchema = z.strictObject({
  tabId: z.number().int().nonnegative().optional(),
})

export type ExtractPageInput = z.infer<typeof extractPageInputSchema>
export type ExtractPageOutput = PageSnapshot

export type ExtractPageToolDeps = {
  transport: MessagingTransport
  createRequestId?: () => string
}

function resolveTabId(
  input: ExtractPageInput,
  context: { tabId?: number } | undefined,
): number {
  const tabId = input.tabId ?? context?.tabId
  if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) {
    throw new ToolError('adapter_error', 'extractPage requires tabId in input or ToolContext')
  }
  return tabId
}

export function createExtractPageTool(
  deps: ExtractPageToolDeps,
): AgentTool<ExtractPageInput, ExtractPageOutput> {
  const createRequestId = deps.createRequestId ?? (() => crypto.randomUUID())

  return {
    name: 'extractPage',
    description: 'Extract title, URL, selection, and main text from a page tab',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: extractPageInputSchema,
    outputSchema: pageSnapshotSchema,
    async execute(input, context) {
      const tabId = resolveTabId(input, context)
      const id = createRequestId()
      const encoded = encodeOutboundToContentScript({
        type: 'extractPage.request',
        id,
      })
      if (!encoded.ok) {
        throw new ToolError('adapter_error', encoded.error.message, { issues: encoded.error })
      }

      let raw: unknown
      try {
        raw = await deps.transport.sendToContentScript(tabId, encoded.value)
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'Failed to extract page via messaging'
        throw new ToolError('adapter_error', detail, { cause })
      }

      const decoded = decodeInboundFromContentScript(raw)
      if (!decoded.ok) {
        throw new ToolError('adapter_error', decoded.error.message, { issues: decoded.error })
      }
      if (decoded.value.type !== 'extractPage.response') {
        throw new ToolError('adapter_error', 'Unexpected messaging response for extractPage')
      }
      if (decoded.value.id !== id) {
        throw new ToolError('adapter_error', 'extractPage response id mismatch')
      }

      return decoded.value.page
    },
  }
}
