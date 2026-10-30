/**
 * Instant and one-off-window validation.
 *
 * Split from `validate.ts` to stay inside the NF5 line budget. Pure: the only
 * time-zone lookup is `Intl`, and "now" is never read here.
 */

import { ValidationError } from './validationError.js'
import type { OnceWindow } from './rules/types.js'

/**
 * Validate a one-off window for the D-25 model.
 *
 * - `startAt` is **optional**: when omitted it defaults to the task's
 *   `createdAt` and `startAtSource="created"` (no `#start` reminder);
 * - `endAt` is mandatory and is the only deadline (F3.2);
 * - a date-only `endAt` means "end of that day" in the task zone
 *   (`23:59:59.999`), so the whole day still counts as in term;
 * - `endReminder=false` requires an explicit `startAt`, otherwise the task
 *   would have no reminder at all (F3.3).
 * @param value - Candidate `{startAt?, endAt}`.
 * @param timeZone - Zone used for offset-less values.
 * @param createdAt - Creation instant, used when `startAt` is omitted.
 * @param endReminder - Task-level "remind at the end" flag (default true).
 * @returns Normalized window in UTC ISO.
 */
export function validateOnce(
  value: unknown,
  timeZone: string,
  createdAt: Date = new Date(0),
  endReminder = true,
): OnceWindow {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  // F2.6 / F9.1: a one-off task carries its own zone. It may be supplied either
  // at the top level (legacy callers) or inside `once` (the documented API
  // shape), so the inner value wins when both are present.
  const zone = resolveZone(raw['timeZone'], timeZone)
  const startText = raw['startAt']
  const explicitStart = typeof startText === 'string' && startText.trim() !== ''
  if (startText !== undefined && startText !== null && typeof startText !== 'string') {
    throw new ValidationError('invalid_argument', 'once.startAt must be an ISO 8601 string', { field: 'once.startAt' })
  }
  const endText = raw['endAt']
  if (typeof endText !== 'string' || endText.trim() === '') {
    throw new ValidationError('invalid_argument', 'once.endAt is required (D-25: the only deadline)', {
      field: 'once.endAt',
    })
  }
  if (!endReminder && !explicitStart) {
    throw new ValidationError(
      'invalid_argument',
      'notify.endReminder=false requires an explicit once.startAt; otherwise the task would have no reminder',
      { field: 'notify.endReminder' },
    )
  }
  const start = explicitStart ? parseInstant(startText, zone, 'once.startAt') : createdAt
  const end = parseInstant(normalizeEndText(endText), zone, 'once.endAt')
  if (end.getTime() <= start.getTime()) {
    throw new ValidationError('invalid_argument', 'once.endAt must be strictly later than once.startAt', {
      field: 'once.endAt',
    })
  }
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    startAtSource: explicitStart ? 'explicit' : 'created',
    timeZone: zone,
  }
}

/**
 * Expand a date-only `endAt` to the last millisecond of that day.
 * @param text - Candidate end text.
 * @returns The text to parse as an instant.
 */
function normalizeEndText(text: string): string {
  const trimmed = text.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999` : trimmed
}

/**
 * Parse an ISO instant, interpreting an offset-less value in the task zone.
 * @param text - ISO 8601 string.
 * @param timeZone - Task zone.
 * @param field - Field name for errors.
 * @returns Parsed instant.
 */
export function parseInstant(text: string, timeZone: string, field: string): Date {
  const trimmed = text.trim()
  // A date-only value has no wall-clock time, so it cannot express a reminder
  // node; require at least `YYYY-MM-DDTHH:mm`.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    throw new ValidationError('invalid_argument', `${field} must include a time (YYYY-MM-DDTHH:mm...)`, { field })
  }
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  const candidate = hasOffset ? trimmed : `${trimmed}${offsetSuffix(trimmed, timeZone)}`
  const parsed = new Date(candidate)
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('invalid_argument', `${field} is not a valid ISO 8601 instant`, { field })
  }
  return parsed
}

/**
 * Offset suffix (`+08:00`) for an offset-less local date-time in a zone.
 * @param local - `YYYY-MM-DDTHH:mm[:ss]` text.
 * @param timeZone - Task zone.
 * @returns Offset suffix, or `Z` when the zone data is unavailable.
 */
function offsetSuffix(local: string, timeZone: string): string {
  // A date-only `endAt` normalizes to `...T23:59:59.999`, so the fraction must
  // be accepted here too (it does not affect the offset).
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(local)
  if (match === null) return 'Z'
  const [, year, month, day, hour, minute, second] = match
  const guess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0'),
  )
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess))
  const pick = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asLocal = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'), pick('second'))
  const offsetMinutes = Math.round((asLocal - guess) / 60_000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hh = String(Math.floor(absolute / 60)).padStart(2, '0')
  const mm = String(absolute % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

/**
 * Validate an optional IANA zone, falling back to the caller's default.
 * @param value - Candidate zone from the payload.
 * @param fallback - Zone to use when absent.
 * @returns A resolvable IANA zone.
 * @throws ValidationError `invalid_timezone` when the candidate is unusable.
 */
function resolveZone(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') {
    throw new ValidationError('invalid_timezone', 'once.timeZone must be a string', { field: 'once.timeZone' })
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
  } catch {
    throw new ValidationError('invalid_timezone', `timeZone ${JSON.stringify(value)} is not a resolvable IANA zone`, {
      field: 'once.timeZone',
    })
  }
  return value
}
