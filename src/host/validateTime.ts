/**
 * Instant and one-off-window validation.
 *
 * Split from `validate.ts` to stay inside the NF5 line budget. Pure: the only
 * time-zone lookup is `Intl`, and "now" is never read here.
 */

import { ValidationError } from './validationError.js'
import type { OnceWindow } from './rules/types.js'

/**
 * Validate a one-off window (both bounds required, end strictly later).
 * @param value - Candidate `{startAt, endAt}`.
 * @param timeZone - Zone used for offset-less values.
 * @returns Normalized window in UTC ISO.
 */
export function validateOnce(value: unknown, timeZone: string): OnceWindow {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const startText = raw['startAt']
  if (typeof startText !== 'string' || startText.trim() === '') {
    throw new ValidationError('invalid_argument', 'once.startAt is required', { field: 'once.startAt' })
  }
  const endText = raw['endAt']
  if (typeof endText !== 'string' || endText.trim() === '') {
    throw new ValidationError('invalid_argument', 'once.endAt is required (D-03: both nodes remind)', {
      field: 'once.endAt',
    })
  }
  const start = parseInstant(startText, timeZone, 'once.startAt')
  const end = parseInstant(endText, timeZone, 'once.endAt')
  if (end.getTime() <= start.getTime()) {
    throw new ValidationError('invalid_argument', 'once.endAt must be strictly later than once.startAt', {
      field: 'once.endAt',
    })
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() }
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
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
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
