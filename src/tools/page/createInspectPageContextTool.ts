import { z } from 'zod'
import {
  decodeInboundFromContentScript,
  encodeOutboundToContentScript,
  pageContextInspectionSchema,
  type MessagingTransport,
  type PageContextInspection,
} from '../../messaging'
import type { AgentTool } from '../types'
import { ToolError } from '../types'

const inspectPageContextInputSchema = z.strictObject({})

export type InspectPageContextInput = z.infer<typeof inspectPageContextInputSchema>
export type InspectPageContextOutput = PageContextInspection

export type InspectPageContextToolDeps = {
  transport: MessagingTransport
  createRequestId?: () => string
}

function requireTabId(context: { tabId?: number } | undefined): number {
  const tabId = context?.tabId
  if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) {
    throw new ToolError('adapter_error', 'inspectPageContext requires ToolContext.tabId')
  }
  return tabId
}

export function createInspectPageContextTool(
  deps: InspectPageContextToolDeps,
): AgentTool<InspectPageContextInput, InspectPageContextOutput> {
  const createRequestId = deps.createRequestId ?? (() => crypto.randomUUID())

  return {
    name: 'inspectPageContext',
    description: 'Inspect page context metadata without returning full page text',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: inspectPageContextInputSchema,
    outputSchema: pageContextInspectionSchema,
    async execute(_input, context) {
      const tabId = requireTabId(context)
      const id = createRequestId()
      const encoded = encodeOutboundToContentScript({
        type: 'inspectPageContext.request',
        id,
      })
      if (!encoded.ok) {
        throw new ToolError('adapter_error', encoded.error.message, { issues: encoded.error })
      }

      let raw: unknown
      try {
        raw = await deps.transport.sendToContentScript(tabId, encoded.value)
      } catch (cause) {
        throw new ToolError('adapter_error', 'Failed to inspect page context via messaging', {
          cause,
        })
      }

      const decoded = decodeInboundFromContentScript(raw)
      if (!decoded.ok) {
        throw new ToolError('adapter_error', decoded.error.message, { issues: decoded.error })
      }
      if (decoded.value.type !== 'inspectPageContext.response') {
        throw new ToolError('adapter_error', 'Unexpected messaging response for inspectPageContext')
      }
      if (decoded.value.id !== id) {
        throw new ToolError('adapter_error', 'inspectPageContext response id mismatch')
      }

      return decoded.value.context
    },
  }
}
