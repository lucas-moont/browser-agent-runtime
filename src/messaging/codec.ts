import {
  CONTENT_SCRIPT_OUTBOUND_TYPES,
  EXTENSION_TO_CONTENT_TYPES,
  FORBIDDEN_OUTBOUND_TO_CONTENT_KEYS,
  contentToExtensionMessageSchema,
  extensionToContentMessageSchema,
  protocolMessageSchema,
  type ContentToExtensionMessage,
  type ExtensionToContentMessage,
  type ProtocolMessage,
} from './schemas'
import { err, ok, type MessagingResult } from './result'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectOwnKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return keys
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOwnKeys(item, keys)
    }
    return keys
  }
  for (const [key, child] of Object.entries(value)) {
    keys.add(key)
    collectOwnKeys(child, keys)
  }
  return keys
}

function isJsonSafeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (value === null) return true
  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return true
  if (valueType === 'number') return Number.isFinite(value)
  if (
    valueType === 'undefined' ||
    valueType === 'function' ||
    valueType === 'symbol' ||
    valueType === 'bigint'
  ) {
    return false
  }
  if (valueType !== 'object') return false
  if (seen.has(value as object)) return false
  seen.add(value as object)
  if (Array.isArray(value)) {
    return value.every((item) => isJsonSafeValue(item, seen))
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    return false
  }
  return Object.values(value as Record<string, unknown>).every((child) =>
    isJsonSafeValue(child, seen),
  )
}

export function assertJsonSerializable(value: unknown): MessagingResult<unknown> {
  if (!isJsonSafeValue(value)) {
    return err({
      kind: 'not_serializable',
      message: 'Payload is not JSON-serializable',
    })
  }
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      return err({
        kind: 'not_serializable',
        message: 'Payload is not JSON-serializable',
      })
    }
    return ok(JSON.parse(serialized) as unknown)
  } catch (cause) {
    return err({
      kind: 'not_serializable',
      message: 'Payload is not JSON-serializable',
      issues: cause instanceof Error ? cause.message : cause,
    })
  }
}

function hasForbiddenOutboundKeys(value: unknown): string | undefined {
  const keys = collectOwnKeys(value)
  for (const forbidden of FORBIDDEN_OUTBOUND_TO_CONTENT_KEYS) {
    if (keys.has(forbidden)) {
      return forbidden
    }
  }
  return undefined
}

function messageTypeOf(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined
  return typeof value.type === 'string' ? value.type : undefined
}

export function decodeMessage(input: unknown): MessagingResult<ProtocolMessage> {
  const parsed = protocolMessageSchema.safeParse(input)
  if (!parsed.success) {
    return err({
      kind: 'schema',
      message: 'Message failed protocol schema validation',
      issues: parsed.error.issues,
    })
  }
  return ok(parsed.data)
}

export function encodeMessage(message: unknown): MessagingResult<ProtocolMessage> {
  const serializable = assertJsonSerializable(message)
  if (!serializable.ok) {
    return serializable
  }
  return decodeMessage(serializable.value)
}

export function encodeOutboundToContentScript(
  message: unknown,
): MessagingResult<ExtensionToContentMessage> {
  const forbidden = hasForbiddenOutboundKeys(message)
  if (forbidden !== undefined) {
    return err({
      kind: 'privilege',
      message: `Outbound content-script message must not include privileged field "${forbidden}"`,
    })
  }

  const type = messageTypeOf(message)
  if (type !== undefined && !(EXTENSION_TO_CONTENT_TYPES as readonly string[]).includes(type)) {
    return err({
      kind: 'disallowed_type',
      message: `Message type "${type}" is not allowlisted for extension→content-script`,
    })
  }

  const serializable = assertJsonSerializable(message)
  if (!serializable.ok) {
    return serializable
  }

  const parsed = extensionToContentMessageSchema.safeParse(serializable.value)
  if (!parsed.success) {
    return err({
      kind: 'schema',
      message: 'Outbound content-script message failed schema validation',
      issues: parsed.error.issues,
    })
  }
  return ok(parsed.data)
}

export function decodeInboundFromContentScript(
  input: unknown,
): MessagingResult<ContentToExtensionMessage> {
  const type = messageTypeOf(input)
  if (type !== undefined && !(CONTENT_SCRIPT_OUTBOUND_TYPES as readonly string[]).includes(type)) {
    return err({
      kind: 'disallowed_type',
      message: `Message type "${type}" is not allowlisted for content-script→extension`,
    })
  }

  const parsed = contentToExtensionMessageSchema.safeParse(input)
  if (!parsed.success) {
    if (type !== undefined && !(CONTENT_SCRIPT_OUTBOUND_TYPES as readonly string[]).includes(type)) {
      return err({
        kind: 'disallowed_type',
        message: `Message type "${type}" is not allowlisted for content-script→extension`,
      })
    }
    return err({
      kind: 'schema',
      message: 'Inbound content-script message failed schema validation',
      issues: parsed.error.issues,
    })
  }
  return ok(parsed.data)
}

export function decodeOutboundToContentScript(
  input: unknown,
): MessagingResult<ExtensionToContentMessage> {
  return encodeOutboundToContentScript(input)
}
