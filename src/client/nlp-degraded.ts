/**
 * NLP degradation helpers (F10.11).
 *
 * Pure mapping from the host `reason` to a localized explanation, plus the
 * merge rule used when a retry succeeds after the user already edited fields.
 */

import type { TaskDraft } from './task-draft.js'

/** Known degraded reasons (unknown values are normalized to `unknown`). */
export type NlpDegradedReason = 'llm_unavailable' | 'timeout' | 'bad_output' | 'unknown'

/** Degraded context carried from the input bar to the editor. */
export interface NlpDegradedContext {
  text: string
  reason: NlpDegradedReason
}

/**
 * Normalize a host reason string.
 * @param reason - Raw reason from `/parse`.
 * @returns A known reason or `unknown`.
 */
export function normalizeDegradedReason(reason: string | undefined): NlpDegradedReason {
  return reason === 'llm_unavailable' || reason === 'timeout' || reason === 'bad_output' ? reason : 'unknown'
}

/**
 * Dictionary key for the reason line.
 * @param reason - Normalized reason.
 * @returns i18n key.
 */
export function degradedReasonKey(reason: NlpDegradedReason): string {
  return `nlp.degraded.reason.${reason}`
}

/** Fields that must be replaced wholesale when the user changed `kind`. */
const KIND_FIELDS: readonly (keyof TaskDraft)[] = [
  'preset',
  'time',
  'weekdays',
  'monthDays',
  'cron',
  'holidayCalendar',
  'monthlyOverflow',
  'skipDates',
  'extraWorkdays',
  'startAt',
  'startAtSource',
  'endAt',
  'endReminder',
]

/** Deep equality for the primitive/array values in a draft. */
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Merge a parsed draft into the current form, keeping user edits.
 *
 * A field is replaced only when the user has not touched it since the degraded
 * form opened (`current[k]` still equals `initial[k]`). When the user changed
 * `kind`, rule/window fields are left untouched.
 * @param current - Current form state.
 * @param parsed - Draft from a successful retry.
 * @param initial - Draft as it was when the degraded form opened.
 * @returns The merged draft plus the fields the user kept.
 */
export function mergeParsedDraft(
  current: TaskDraft,
  parsed: TaskDraft,
  initial: TaskDraft,
): { draft: TaskDraft; retained: (keyof TaskDraft)[] } {
  const kindChanged = current.kind !== initial.kind
  const draft: TaskDraft = { ...current }
  const retained: (keyof TaskDraft)[] = []
  for (const key of Object.keys(current) as (keyof TaskDraft)[]) {
    if (kindChanged && KIND_FIELDS.includes(key)) {
      retained.push(key)
      continue
    }
    if (same(current[key], initial[key])) {
      draft[key] = parsed[key] as never
    } else {
      retained.push(key)
    }
  }
  return { draft, retained }
}

/**
 * Recompute the required-field list after a merge.
 * @param draft - Merged draft.
 * @returns Field names that still need input.
 */
export function missingRequiredOf(draft: TaskDraft): string[] {
  const missing: string[] = []
  if (draft.title.trim() === '') missing.push('title')
  if (draft.kind === 'once' && draft.endAt.trim() === '') missing.push('endAt')
  if (draft.kind === 'recurring') {
    const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    if (!timeOk) missing.push('time')
    if (draft.preset === 'weekly' && draft.weekdays.length === 0) missing.push('weekdays')
    if (draft.preset === 'monthly' && draft.monthDays.length === 0) missing.push('monthDays')
    if (draft.preset === 'custom' && draft.cron.trim() === '') missing.push('cron')
  }
  return missing
}
