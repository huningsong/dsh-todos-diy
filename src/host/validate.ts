/**
 * Validation of user-supplied task input (§7.4 field constraints).
 *
 * Pure: no IO, no clock. Every error carries the §7.12 code the API and the
 * agent tools return, so the two callers cannot drift apart (F7.11).
 */

import { CronError, parseCron } from './rules/cron.js'
import { isValidCivilDate, parseLocalDate } from './rules/timezone.js'
import type { Channel, RecurrenceRule, RulePreset } from './rules/types.js'
import { ValidationError } from './validationError.js'

export { ValidationError, type ErrorCode } from './validationError.js'
export { validateOnce, parseInstant } from './validateTime.js'
export { validateSettingsPatch } from './validateSettings.js'

/**
 * Reject fields removed from the v2 task model (F4.11).
 *
 * An unknown property is ignored by TypeScript at compile time only; an HTTP or
 * tool caller can still send it, so the boundary has to say no explicitly.
 * @param body - Raw request/tool input.
 * @throws ValidationError when `dueDate` is present.
 */
export function rejectLegacyFields(body: Record<string, unknown>): void {
  if (Object.hasOwn(body, 'dueDate') && body['dueDate'] !== undefined) {
    throw new ValidationError(
      'invalid_argument',
      'dueDate was removed in schema v2; use once.endAt (one-off) or rule.time (recurring)',
      { field: 'dueDate' },
    )
  }
}

/** Limits from §7.4. */
export const LIMITS = {
  titleMin: 1,
  titleMax: 200,
  descriptionMax: 2000,
  skipDatesMax: 366,
  advanceMinutesMax: 1440,
  templateMax: 1000,
  maxTasksPerTick: 200,
} as const

/**
 * Validate and trim a title.
 * @param value - Candidate.
 * @returns Trimmed title.
 * @throws ValidationError when empty or too long.
 */
export function validateTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('invalid_argument', 'title is required', { field: 'title' })
  const trimmed = value.trim()
  if (trimmed.length < LIMITS.titleMin) {
    throw new ValidationError('invalid_argument', 'title must not be empty', { field: 'title' })
  }
  if (trimmed.length > LIMITS.titleMax) {
    throw new ValidationError('invalid_argument', `title must be at most ${String(LIMITS.titleMax)} characters`, {
      field: 'title',
    })
  }
  return trimmed
}

/**
 * Validate an optional description.
 * @param value - Candidate.
 * @returns The description, or an empty string.
 */
export function validateDescription(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new ValidationError('invalid_argument', 'description must be a string', { field: 'description' })
  }
  if (value.length > LIMITS.descriptionMax) {
    throw new ValidationError(
      'invalid_argument',
      `description must be at most ${String(LIMITS.descriptionMax)} characters`,
      { field: 'description' },
    )
  }
  return value
}

/**
 * Validate an IANA time zone.
 * @param value - Candidate.
 * @returns The zone identifier.
 * @throws ValidationError with `invalid_timezone`.
 */
export function validateTimeZone(value: unknown, fallback?: string): string {
  const candidate = value === undefined || value === null ? fallback : value
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new ValidationError('invalid_timezone', 'timeZone is required', { field: 'timeZone' })
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
  } catch {
    throw new ValidationError('invalid_timezone', `timeZone ${JSON.stringify(candidate)} is not a resolvable IANA zone`, {
      field: 'timeZone',
    })
  }
  return candidate
}

/**
 * Validate a `YYYY-MM-DD` list (skipDates / extraWorkdays).
 * @param value - Candidate.
 * @param field - Field name for the error.
 * @returns De-duplicated, ascending list.
 */
export function validateDateList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new ValidationError('invalid_argument', `${field} must be an array of YYYY-MM-DD strings`, { field })
  }
  if (value.length > LIMITS.skipDatesMax) {
    throw new ValidationError('invalid_argument', `${field} must contain at most ${String(LIMITS.skipDatesMax)} dates`, {
      field,
    })
  }
  const set = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new ValidationError('invalid_argument', `${field} entries must be strings`, { field })
    }
    const parsed = parseLocalDate(entry)
    if (parsed === undefined || !isValidCivilDate(parsed.year, parsed.month, parsed.day)) {
      throw new ValidationError('invalid_argument', `${field} entry ${JSON.stringify(entry)} is not a real date`, { field })
    }
    set.add(entry)
  }
  return [...set].sort()
}

/**
 * Validate notification settings.
 * @param value - Candidate.
 * @param defaults - Subscription defaults from settings.
 * @returns Normalized notify settings.
 */
export function validateNotify(
  value: unknown,
  defaults: {
    channels: Channel[]
    template: string
    endReminder?: boolean
    advanceMinutes?: number
    sound?: boolean
  },
): { channels: Channel[]; template: string; advanceMinutes: number; sound: boolean; endReminder: boolean } {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  let channels: Channel[] = [...defaults.channels]
  if (raw['channels'] !== undefined) {
    if (!Array.isArray(raw['channels'])) {
      throw new ValidationError('invalid_argument', 'notify.channels must be an array', { field: 'notify.channels' })
    }
    const filtered = raw['channels'].filter(
      (channel): channel is Channel => channel === 'overlay' || channel === 'system',
    )
    if (filtered.length === 0) {
      throw new ValidationError('invalid_argument', 'notify.channels must not be empty', { field: 'notify.channels' })
    }
    if (!filtered.includes('overlay')) {
      throw new ValidationError('invalid_argument', 'notify.channels must include "overlay"', {
        field: 'notify.channels',
      })
    }
    channels = [...new Set(filtered)]
  }
  if (!channels.includes('overlay')) channels = ['overlay', ...channels]

  let template = defaults.template
  if (raw['template'] !== undefined) {
    if (typeof raw['template'] !== 'string' || raw['template'].trim() === '') {
      throw new ValidationError('invalid_argument', 'notify.template must be a non-empty string', {
        field: 'notify.template',
      })
    }
    if (raw['template'].length > LIMITS.templateMax) {
      throw new ValidationError('invalid_argument', `notify.template must be at most ${String(LIMITS.templateMax)} characters`, {
        field: 'notify.template',
      })
    }
    template = raw['template']
  }

  let advanceMinutes = defaults.advanceMinutes ?? 0
  if (raw['advanceMinutes'] !== undefined) {
    const parsed = Number(raw['advanceMinutes'])
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > LIMITS.advanceMinutesMax) {
      throw new ValidationError(
        'invalid_argument',
        `notify.advanceMinutes must be an integer between 0 and ${String(LIMITS.advanceMinutesMax)}`,
        { field: 'notify.advanceMinutes' },
      )
    }
    advanceMinutes = parsed
  }

  const sound = raw['sound'] === undefined ? (defaults.sound ?? false) : raw['sound'] === true
  let endReminder = defaults.endReminder !== false
  if (raw['endReminder'] !== undefined) {
    if (typeof raw['endReminder'] !== 'boolean') {
      throw new ValidationError('invalid_argument', 'notify.endReminder must be a boolean', {
        field: 'notify.endReminder',
      })
    }
    endReminder = raw['endReminder']
  }
  return { channels, template, advanceMinutes, sound, endReminder }
}

/**
 * Build a canonical rule from a preset plus its preset-specific fields.
 *
 * The cron is always derived here, never accepted from the client, so a stored
 * `rule.cron` can be trusted as canonical (F2.1–F2.4).
 * @param value - Candidate rule.
 * @param defaultTimeZone - Zone inherited when the rule omits one.
 * @returns Normalized rule.
 */
export function validateRule(value: unknown, defaultTimeZone: string): RecurrenceRule {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const preset = raw['preset']
  if (preset !== 'workdays' && preset !== 'weekly' && preset !== 'monthly' && preset !== 'custom') {
    throw new ValidationError('invalid_argument', 'rule.preset must be workdays, weekly, monthly or custom', {
      field: 'rule.preset',
    })
  }
  const timeZone = validateTimeZone(raw['timeZone'], defaultTimeZone)
  const cron = buildCron(preset, raw, timeZone)
  const holidayCalendar = raw['holidayCalendar'] === 'none' ? 'none' : 'CN'
  const monthlyOverflow = raw['monthlyOverflow'] === 'skip' ? 'skip' : 'lastDay'
  return {
    preset,
    cron,
    timeZone,
    skipDates: validateDateList(raw['skipDates'], 'rule.skipDates'),
    extraWorkdays: validateDateList(raw['extraWorkdays'], 'rule.extraWorkdays'),
    holidayCalendar,
    monthlyOverflow,
  }
}

/**
 * Derive the canonical cron for a preset.
 * @param preset - Rule preset.
 * @param raw - Raw rule fields.
 * @param timeZone - Validated zone (for error context only).
 * @returns Canonical 5-field expression.
 */
function buildCron(preset: RulePreset, raw: Record<string, unknown>, timeZone: string): string {
  if (preset === 'workdays') {
    // The cron is always Mon–Fri; the holiday table is applied at solve time.
    const time = readTimeOfDay(raw['time'], 'rule.time')
    return canonicalize(`${String(time.minute)} ${String(time.hour)} * * 1-5`)
  }
  if (preset === 'weekly') {
    const days = raw['weekdays']
    if (!Array.isArray(days) || days.length === 0) {
      throw new ValidationError('invalid_argument', 'rule.weekdays must be a non-empty array of 1-7', {
        field: 'rule.weekdays',
      })
    }
    const set = new Set<number>()
    for (const entry of days) {
      const day = Number(entry)
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        throw new ValidationError('invalid_argument', 'rule.weekdays entries must be integers 1-7 (ISO weekday)', {
          field: 'rule.weekdays',
        })
      }
      set.add(day === 7 ? 0 : day)
    }
    const list = [...set].sort((left, right) => left - right).join(',')
    const time = readTimeOfDay(raw['time'], 'rule.time')
    return canonicalize(`${String(time.minute)} ${String(time.hour)} * * ${list}`)
  }
  if (preset === 'monthly') {
    const days = raw['monthDays']
    if (!Array.isArray(days) || days.length === 0) {
      throw new ValidationError('invalid_argument', 'rule.monthDays must be a non-empty array of 1-31', {
        field: 'rule.monthDays',
      })
    }
    const set = new Set<number>()
    for (const entry of days) {
      const day = Number(entry)
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new ValidationError('invalid_argument', 'rule.monthDays entries must be integers 1-31', {
          field: 'rule.monthDays',
        })
      }
      set.add(day)
    }
    const list = [...set].sort((left, right) => left - right).join(',')
    const time = readTimeOfDay(raw['time'], 'rule.time')
    return canonicalize(`${String(time.minute)} ${String(time.hour)} ${list} * *`)
  }
  // custom
  const expression = raw['cron']
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new ValidationError('invalid_cron', 'rule.cron is required for a custom rule', { field: 'rule.cron' })
  }
  try {
    return parseCron(expression).expression
  } catch (error) {
    if (error instanceof CronError) {
      throw new ValidationError('invalid_cron', `cron.expression ${error.field}: ${error.message}`, {
        field: 'rule.cron',
        cronField: error.field,
      })
    }
    throw new ValidationError('invalid_cron', String(error), { field: 'rule.cron' })
  }
}

/** Canonicalize a generated expression, reporting a bug rather than a user error. */
function canonicalize(expression: string): string {
  try {
    return parseCron(expression).expression
  } catch (error) {
    // Only reachable if the presets above generate nonsense, which is a bug.
    throw new ValidationError('internal_error', `generated cron is invalid: ${String(error)}`, { field: 'rule' })
  }
}

/**
 * Read an `HH:mm` wall clock.
 * @param value - Candidate time.
 * @param field - Field name for errors.
 * @returns Hour and minute.
 */
function readTimeOfDay(value: unknown, field: string): { hour: number; minute: number } {
  const text = typeof value === 'string' ? value : '09:00'
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (match === null) {
    throw new ValidationError('invalid_argument', `${field} must be HH:mm`, { field })
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    throw new ValidationError('invalid_argument', `${field} must be a valid 24-hour time`, { field })
  }
  return { hour, minute }
}
