/**
 * First-run example cards (F8.15 / UX-04).
 *
 * Three real, immediately-usable tasks — not mock data. Clicking one creates it
 * through the normal API path, so the user can edit it afterwards like any
 * other task.
 */

import { emptyDraft, type TaskDraft } from './task-editor'

/** One example card. */
export interface ExampleCard {
  key: string
  label: string
  draft: TaskDraft
}

/**
 * Build the three example drafts in the given zone.
 * @param timeZone - Default zone from settings.
 * @param t - Translator.
 * @returns Card descriptors.
 */
export function buildExamples(
  timeZone: string,
  t: (key: string) => string,
): ExampleCard[] {
  const workday = emptyDraft(timeZone)
  workday.title = t('empty.example1')
  workday.preset = 'workdays'
  workday.time = '09:00'

  const monthly = emptyDraft(timeZone)
  monthly.title = t('empty.example2')
  monthly.preset = 'monthly'
  monthly.monthDays = [31]
  monthly.monthlyOverflow = 'lastDay'
  monthly.time = '17:00'

  const once = emptyDraft(timeZone)
  once.kind = 'once'
  once.title = t('empty.example3')
  const tomorrow = new Date(Date.now() + 86_400_000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const datePart = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
  once.startAt = `${datePart}T14:00`
  once.endAt = `${datePart}T18:00`

  return [
    { key: 'workday', draft: workday, label: t('empty.example1') },
    { key: 'monthly', draft: monthly, label: t('empty.example2') },
    { key: 'once', draft: once, label: t('empty.example3') },
  ]
}
