/**
 * The shared error type for user-input failures (§7.12).
 *
 * Lives in its own module so both `validate.ts` and `validateTime.ts` can throw
 * it without a circular import.
 */

/** Envelope error code shared by HTTP and agent tools (§7.12). */
export type ErrorCode =
  | 'invalid_argument'
  | 'invalid_cron'
  | 'invalid_timezone'
  | 'not_found'
  | 'invalid_state'
  | 'no_occurrence'
  | 'conflict'
  | 'read_only'
  | 'schema_mismatch'
  | 'storage_error'
  | 'forbidden'
  | 'internal_error'
  | 'payload_too_large'
  | 'unauthorized'

/** A validation failure carrying its envelope code. */
export class ValidationError extends Error {
  /** Envelope code. */
  readonly code: ErrorCode
  /** Field-level details for the UI to attach to an input. */
  readonly details: { field?: string; [key: string]: unknown } | undefined

  /**
   * @param code - Envelope code.
   * @param message - Diagnostic.
   * @param details - Optional field-level context.
   */
  constructor(code: ErrorCode, message: string, details?: { field?: string; [key: string]: unknown }) {
    super(message)
    this.name = 'ValidationError'
    this.code = code
    this.details = details
  }
}
