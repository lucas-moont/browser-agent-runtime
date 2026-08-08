import { z } from 'zod'

export const pageSnapshotSchema = z.strictObject({
  title: z.string(),
  url: z.string(),
  selection: z.string(),
  mainText: z.string(),
})

export const pageContextInspectionSchema = z.strictObject({
  title: z.string(),
  url: z.string(),
  hasSelection: z.boolean(),
  selectionLength: z.number().int().nonnegative(),
  mainTextLength: z.number().int().nonnegative(),
})

export const extractPageRequestSchema = z.strictObject({
  type: z.literal('extractPage.request'),
  id: z.string().min(1),
})

export const extractPageResponseSchema = z.strictObject({
  type: z.literal('extractPage.response'),
  id: z.string().min(1),
  page: pageSnapshotSchema,
})

export const inspectPageContextRequestSchema = z.strictObject({
  type: z.literal('inspectPageContext.request'),
  id: z.string().min(1),
})

export const inspectPageContextResponseSchema = z.strictObject({
  type: z.literal('inspectPageContext.response'),
  id: z.string().min(1),
  context: pageContextInspectionSchema,
})

export const extensionToContentMessageSchema = z.discriminatedUnion('type', [
  extractPageRequestSchema,
  inspectPageContextRequestSchema,
])

export const contentToExtensionMessageSchema = z.discriminatedUnion('type', [
  extractPageResponseSchema,
  inspectPageContextResponseSchema,
])

export const protocolMessageSchema = z.discriminatedUnion('type', [
  extractPageRequestSchema,
  extractPageResponseSchema,
  inspectPageContextRequestSchema,
  inspectPageContextResponseSchema,
])

export type PageSnapshot = z.infer<typeof pageSnapshotSchema>
export type PageContextInspection = z.infer<typeof pageContextInspectionSchema>
export type ExtractPageRequest = z.infer<typeof extractPageRequestSchema>
export type ExtractPageResponse = z.infer<typeof extractPageResponseSchema>
export type InspectPageContextRequest = z.infer<typeof inspectPageContextRequestSchema>
export type InspectPageContextResponse = z.infer<typeof inspectPageContextResponseSchema>
export type ExtensionToContentMessage = z.infer<typeof extensionToContentMessageSchema>
export type ContentToExtensionMessage = z.infer<typeof contentToExtensionMessageSchema>
export type ProtocolMessage = z.infer<typeof protocolMessageSchema>

export const CONTENT_SCRIPT_OUTBOUND_TYPES = [
  'extractPage.response',
  'inspectPageContext.response',
] as const

export const EXTENSION_TO_CONTENT_TYPES = [
  'extractPage.request',
  'inspectPageContext.request',
] as const

export const FORBIDDEN_OUTBOUND_TO_CONTENT_KEYS = [
  'secret',
  'token',
  'apiKey',
  'authorization',
  'cookie',
  'password',
  'accessToken',
  'refreshToken',
] as const
