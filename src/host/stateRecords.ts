/**
 * Coercion for the small records stored next to tasks: delivery rows and
 * recovery notices. Split from `state.ts` to stay inside the NF5 budget.
 */

import type { CompletionEvent, DeliveryRecord, IdempotencyRecord, RecoveryRecord } from './state.js'

/** Whether a value is a plain object (not an array, not null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a nullable ISO string; anything unparseable becomes null. */
function nullableIso(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/** Read a string or fall back. */
function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/** Coerce a delivery record; invalid entries are dropped silently. */
export function coerceDelivery(raw: unknown): DeliveryRecord | null {
  if (!isRecord(raw)) return null
  const key = raw['occurrenceKey']
  const channel = raw['channel']
  const status = raw['status']
  const at = nullableIso(raw['at'])
  if (typeof key !== 'string' || at === null) return null
  if (channel !== 'overlay' && channel !== 'system') return null
  if (status !== 'ok' && status !== 'failed' && status !== 'skipped') return null
  return {
    occurrenceKey: key,
    channel,
    status,
    at,
    readAt: nullableIso(raw['readAt']),
    ignoredAt: nullableIso(raw['ignoredAt']),
    dismissedAt: nullableIso(raw['dismissedAt']),
    error: typeof raw['error'] === 'string' ? raw['error'] : null,
  }
}

/** Coerce a recovery record. */
export function coerceRecovery(raw: unknown): RecoveryRecord | null {
  if (!isRecord(raw)) return null
  const reason = raw['reason']
  if (reason !== 'corrupt' && reason !== 'unsupported-version' && reason !== 'migration-failed' && reason !== 'missing') {
    return null
  }
  return {
    at: nullableIso(raw['at']) ?? new Date(0).toISOString(),
    reason,
    message: str(raw['message'], ''),
    backupFile: typeof raw['backupFile'] === 'string' ? raw['backupFile'] : null,
  }
}

/**
 * Coerce one completion event; malformed entries are dropped.
 * @param raw - Candidate from a stored file.
 * @returns A clean event, or null.
 */
export function coerceCompletionEvent(raw: unknown): CompletionEvent | null {
  if (!isRecord(raw)) return null
  const id = raw['id']
  const taskId = raw['taskId']
  const taskTitle = raw['taskTitle']
  const kind = raw['kind']
  const occurrenceKey = raw['occurrenceKey']
  const completedAt = nullableIso(raw['completedAt'])
  const dueAt = nullableIso(raw['dueAt'])
  const timeZone = raw['timeZone']
  if (typeof id !== 'string' || id === '') return null
  if (typeof taskId !== 'string' || taskId === '') return null
  if (typeof taskTitle !== 'string') return null
  if (kind !== 'once' && kind !== 'recurring') return null
  if (typeof occurrenceKey !== 'string' || occurrenceKey === '') return null
  if (completedAt === null) return null
  return {
    id,
    taskId,
    taskTitle,
    kind,
    occurrenceKey,
    completedAt,
    dueAt,
    timeZone: typeof timeZone === 'string' && timeZone !== '' ? timeZone : 'Asia/Shanghai',
  }
}
/**
 * Coerce the idempotency index, dropping malformed entries.
 * @param raw - Candidate map from a stored file.
 * @returns A clean map (empty when absent).
 */
export function coerceIdempotency(raw: unknown): Record<string, IdempotencyRecord> {
  if (!isRecord(raw)) return {}
  const out: Record<string, IdempotencyRecord> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    const taskId = value['taskId']
    const fingerprint = value['fingerprint']
    const at = nullableIso(value['at'])
    if (typeof taskId !== 'string' || taskId === '') continue
    if (typeof fingerprint !== 'string' || fingerprint === '') continue
    if (at === null) continue
    out[key] = { taskId, fingerprint, at }
  }
  return out
}
