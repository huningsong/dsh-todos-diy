/**
 * Normalize a model answer into a draft (F10.4–F10.6).
 *
 * The model may be vague or wrong; this layer enforces the D-25 invariants that
 * matter before the form is shown, and records which fields were guessed so the
 * editor can mark them.
 */

import { parseInstant } from '../validateTime.js'
import { emptyNlpDraft } from './prompt.js'
import type { NlpDraft, NlpFieldSource } from './types.js'

/** Result of a successful normalization. */
export interface NormalizedNlp {
  draft: NlpDraft
  fieldStatus: Record<string, NlpFieldSource>
  missingRequired: string[]
  unsupported: string[]
  confidence: number
}

/** Title prefixes that carry no task meaning. */
const TITLE_PREFIXES = ['提醒我', '记得', '别忘了', '请提醒我', '帮我']

/**
 * Clean a title: strip filler prefixes and clamp to the API limit.
 * @param raw - Candidate title.
 * @param fallback - Text to use when the model gave nothing usable.
 * @returns Title within 1–200 characters.
 */
export function cleanTitle(raw: unknown, fallback: string): string {
  const source = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : fallback
  let title = source
  for (const prefix of TITLE_PREFIXES) {
    if (title.startsWith(prefix)) title = title.slice(prefix.length).trim()
  }
  return title.slice(0, 200) || fallback.slice(0, 200)
}

/** Whether a value looks like a local `YYYY-MM-DDTHH:mm` value. */
export function isLocalDateTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
}

/**
 * Format a local wall-clock value plus an offset in minutes.
 * @param value - `YYYY-MM-DDTHH:mm`.
 * @param minutes - Minutes to add.
 * @returns New local value.
 */
export function addMinutesLocal(value: string, minutes: number): string {
  const [date, time] = value.split('T')
  const [hour, minute] = (time ?? '00:00').split(':').map(Number)
  const stamp = new Date(Date.UTC(Number(date?.slice(0, 4)), Number(date?.slice(5, 7)) - 1, Number(date?.slice(8, 10)), hour ?? 0, (minute ?? 0) + minutes))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(stamp.getUTCFullYear())}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}:${pad(stamp.getUTCMinutes())}`
}

/** Read a record or return an empty one. */
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Read an integer in range, or null. */
function intOrNull(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const rounded = Math.trunc(parsed)
  return rounded >= min && rounded <= max ? rounded : null
}

/**
 * Normalize one model answer.
 * @param raw - Parsed JSON from the model.
 * @param options - Clock and target zone.
 * @returns A usable draft plus provenance.
 */
export function normalizeNlpOutput(
  raw: unknown,
  options: { now: Date; timeZone: string; fallbackTitle?: string },
): NormalizedNlp {
  const body = record(raw)
  const draft = emptyNlpDraft(options.timeZone)
  const status: Record<string, NlpFieldSource> = {}
  const missingRequired: string[] = []
  const unsupported = Array.isArray(body['unsupported']) ? body['unsupported'].filter((x): x is string => typeof x === 'string') : []
  const confidenceRaw = Number(body['confidence'])
  const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0.5
  for (const item of Array.isArray(body['missing']) ? body['missing'] : []) {
    if (typeof item === 'string' && item !== '') missingRequired.push(item)
  }

  const fallbackTitle = options.fallbackTitle ?? ''
  draft.title = cleanTitle(body['title'], fallbackTitle)
  status.title = draft.title !== '' ? (typeof body['title'] === 'string' && body['title'].trim() !== '' ? 'explicit' : 'default') : 'missing'
  if (typeof body['description'] === 'string') draft.description = body['description'].slice(0, 2000)

  const kind = body['kind'] === 'once' || body['kind'] === 'recurring' ? body['kind'] : null
  if (kind === null) {
    // Without a kind the safest interpretation is a one-off that still needs a date.
    draft.kind = 'once'
    status.kind = 'missing'
    missingRequired.push('kind')
  } else {
    draft.kind = kind
    status.kind = 'explicit'
  }

  const notify = record(body['notify'])
  const advance = intOrNull(notify['advanceMinutes'], 0, 1440)
  if (advance !== null) {
    draft.advanceMinutes = advance
    status.advanceMinutes = 'explicit'
  }
  if (typeof notify['sound'] === 'boolean') draft.sound = notify['sound']

  if (draft.kind === 'once') {
    applyOnce(draft, status, missingRequired, record(body['once']), options, body['singleTime'] === true)
  } else {
    applyRecurring(draft, status, missingRequired, record(body['rule']))
  }
  return { draft, fieldStatus: status, missingRequired: [...new Set(missingRequired)], unsupported, confidence }
}

/** Fill the one-off window (D-25: endAt is the only deadline). */
function applyOnce(
  draft: NlpDraft,
  status: Record<string, NlpFieldSource>,
  missingRequired: string[],
  once: Record<string, unknown>,
  options: { now: Date; timeZone: string },
  singleTime = false,
): void {
  const start = isLocalDateTime(once['startAt']) ? once['startAt'] : null
  const end = isLocalDateTime(once['endAt']) ? once['endAt'] : null
  if (start === null && end === null) {
    draft.startAt = ''
    draft.endAt = ''
    draft.startAtSource = 'created'
    status.startAt = 'missing'
    status.endAt = 'missing'
    missingRequired.push('startAt', 'endAt')
    return
  }
  if (start === null && end !== null) {
    // Only a deadline was given: keep the created-time start, no start reminder.
    draft.startAt = ''
    draft.endAt = end
    draft.startAtSource = 'created'
    draft.endReminder = true
    status.startAt = 'default'
    status.endAt = 'explicit'
    return
  }
  const base = start as string
  let finish = end
  if (finish === null) {
    finish = addMinutesLocal(base, 60)
    draft.endReminder = false
    status.endAt = 'default'
  } else {
    status.endAt = 'explicit'
  }
  // Reject a reversed window by falling back to the default hour.
  try {
    if (parseInstant(finish, options.timeZone, 'endAt').getTime() <= parseInstant(base, options.timeZone, 'startAt').getTime()) {
      finish = addMinutesLocal(base, 60)
      status.endAt = 'default'
      draft.endReminder = false
    }
  } catch {
    draft.endAt = ''
    status.endAt = 'missing'
    missingRequired.push('endAt')
    return
  }
  draft.startAt = base
  draft.endAt = finish
  draft.startAtSource = 'explicit'
  status.startAt = 'explicit'
  if (singleTime) {
    // F10.4: the end was inferred from a single spoken time.
    status.endAt = 'default'
    draft.endReminder = false
  }
}

/** Fill the recurring rule fields. */
function applyRecurring(
  draft: NlpDraft,
  status: Record<string, NlpFieldSource>,
  missingRequired: string[],
  rule: Record<string, unknown>,
): void {
  const preset = rule['preset']
  if (preset === 'workdays' || preset === 'weekly' || preset === 'monthly' || preset === 'custom') {
    draft.preset = preset
    status.preset = 'explicit'
  } else {
    draft.preset = 'workdays'
    status.preset = 'missing'
    missingRequired.push('preset')
  }
  if (typeof rule['time'] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(rule['time'])) {
    draft.time = rule['time']
    status.time = 'explicit'
  } else {
    draft.time = '09:00'
    status.time = 'default'
  }
  const weekdays = Array.isArray(rule['weekdays'])
    ? rule['weekdays'].map((d) => intOrNull(d, 1, 7)).filter((d): d is number => d !== null)
    : []
  draft.weekdays = [...new Set(weekdays)]
  if (draft.preset === 'weekly') {
    if (draft.weekdays.length === 0) missingRequired.push('weekdays')
    else status.weekdays = 'explicit'
  }
  const monthDays = Array.isArray(rule['monthDays'])
    ? rule['monthDays'].map((d) => intOrNull(d, 1, 31)).filter((d): d is number => d !== null)
    : []
  draft.monthDays = [...new Set(monthDays)]
  if (draft.preset === 'monthly') {
    if (draft.monthDays.length === 0) missingRequired.push('monthDays')
    else status.monthDays = 'explicit'
  }
  draft.holidayCalendar = rule['holidayCalendar'] === 'none' ? 'none' : 'CN'
  draft.monthlyOverflow = rule['monthlyOverflow'] === 'skip' ? 'skip' : 'lastDay'
}
