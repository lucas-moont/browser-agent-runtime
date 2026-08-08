export type MessagingValidationKind =
  | 'schema'
  | 'disallowed_type'
  | 'privilege'
  | 'not_serializable'

export type MessagingValidationError = {
  kind: MessagingValidationKind
  message: string
  issues?: unknown
}

export type MessagingResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MessagingValidationError }

export function ok<T>(value: T): MessagingResult<T> {
  return { ok: true, value }
}

export function err<T = never>(error: MessagingValidationError): MessagingResult<T> {
  return { ok: false, error }
}
