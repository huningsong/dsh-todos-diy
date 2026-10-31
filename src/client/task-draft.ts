/**
 * The task draft model: form state plus conversions to and from the API.
 *
 * Split from `task-editor.ts` to stay inside the NF5 line budget. Everything
 * here is pure data transformation, which also makes the F3.8 field-preserving
 * rules testable without rendering React.
 */

import type { TaskView } from '../../src/host/taskView.js'

/** Draft state the form edits; converted to an API payload on save. */
export interface TaskDraft {
  kind: 'recurring' | 'once'
  title: string
  description: string
  preset: 'workdays' | 'weekly' | 'monthly' | 'custom'
  time: string
  timeZone: string
  weekdays: number[]
  monthDays: number[]
  cron: string
  holidayCalendar: 'CN' | 'none'
  monthlyOverflow: 'lastDay' | 'skip'
  skipDates: string[]
  extraWorkdays: string[]
  startAt: string
  /**
   * Origin of `startAt`: `created` means the server defaulted it and no start
   * reminder exists, so an untouched draft must keep sending no `startAt`
   * (F3.8: editing other fields must not turn it into an explicit one).
   */
  startAtSource: 'explicit' | 'created'
  endAt: string
  channels: ('overlay' | 'system')[]
  advanceMinutes: number
  sound: boolean
  /** `false` = meeting-style task: remind at the start only (F3.3). */
  endReminder: boolean
  template: string
}

/** Default draft for a new task. */
export function emptyDraft(timeZone: string): TaskDraft {
  return {
    kind: 'recurring',
    title: '',
    description: '',
    preset: 'workdays',
    time: '09:00',
    timeZone,
    weekdays: [1],
    monthDays: [1],
    cron: '0 9 * * 1-5',
    holidayCalendar: 'CN',
    monthlyOverflow: 'lastDay',
    skipDates: [],
    extraWorkdays: [],
    startAt: '',
    startAtSource: 'explicit',
    endAt: '',
    channels: ['overlay'],
    advanceMinutes: 0,
    sound: false,
    endReminder: true,
    template: '{title}｜{time}\n{note}',
  }
}

/**
 * Turn an existing task into a draft.
 * @param task - Task view from the API.
 * @param fallbackZone - Default zone when the task has no rule.
 * @returns Editable draft.
 */
export function draftFromTask(task: TaskView, fallbackZone: string): TaskDraft {
  // F2.6: the task's own zone wins over the global default — otherwise editing a
  // Tokyo task in a Shanghai-default install would show (and rewrite) the wrong
  // wall-clock times.
  const taskZone = task.timeZone ?? fallbackZone
  const base = emptyDraft(taskZone)
  const rule = task.rule
  const draft: TaskDraft = {
    ...base,
    kind: task.kind,
    title: task.title,
    description: task.description,
    channels: task.notify.channels,
    advanceMinutes: task.notify.advanceMinutes,
    sound: task.notify.sound,
    endReminder: task.notify.endReminder,
    template: task.notify.template,
  }
  if (rule !== null) {
    const cron = rule.cron.split(/\s+/)
    draft.preset = rule.preset
    draft.timeZone = rule.timeZone
    draft.time = `${(cron[1] ?? '9').padStart(2, '0')}:${(cron[0] ?? '0').padStart(2, '0')}`
    draft.cron = rule.cron
    draft.holidayCalendar = rule.holidayCalendar
    draft.monthlyOverflow = rule.monthlyOverflow
    draft.skipDates = [...rule.skipDates]
    draft.extraWorkdays = [...rule.extraWorkdays]
    if (rule.preset === 'weekly') {
      draft.weekdays = (cron[4] ?? '1').split(',').map((token) => {
        const value = Number(token)
        return value === 0 ? 7 : value
      })
    }
    if (rule.preset === 'monthly') {
      draft.monthDays = (cron[2] ?? '1').split(',').map(Number)
    }
  }
  if (task.once !== null) {
    draft.startAtSource = task.once.startAtSource
    draft.startAt = task.once.startAtSource === 'created' ? '' : toLocalInput(task.once.startAt, taskZone)
    draft.endAt = toLocalInput(task.once.endAt, taskZone)
  }
  return draft
}

/**
 * Format an ISO instant as a `datetime-local` input value in a zone.
 * @param iso - Instant.
 * @param timeZone - IANA zone.
 * @returns `YYYY-MM-DDTHH:mm`.
 */
export function toLocalInput(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`
  } catch {
    return ''
  }
}

/**
 * Convert a draft into the `/tasks/create` payload.
 * @param draft - Form state.
 * @returns Request body.
 */
export function draftToPayload(draft: TaskDraft): Record<string, unknown> {
  const notify = {
    channels: draft.channels.includes('overlay') ? draft.channels : ['overlay', ...draft.channels],
    template: draft.template,
    advanceMinutes: draft.advanceMinutes,
    sound: draft.sound,
    endReminder: draft.endReminder,
  }
  const base = { title: draft.title, description: draft.description, notify }
  if (draft.kind === 'once') {
    return {
      ...base,
      kind: 'once',
      timeZone: draft.timeZone,
      // An untouched "created" start is sent as absent so the server keeps the
      // original source and the no-start-reminder behaviour.
      once: draft.startAtSource === 'created' && draft.startAt === ''
        ? { endAt: draft.endAt }
        : { startAt: draft.startAt, endAt: draft.endAt },
    }
  }
  const rule: Record<string, unknown> = {
    preset: draft.preset,
    timeZone: draft.timeZone,
    skipDates: draft.skipDates,
    extraWorkdays: draft.extraWorkdays,
  }
  if (draft.preset === 'workdays') {
    rule['time'] = draft.time
    rule['holidayCalendar'] = draft.holidayCalendar
  }
  if (draft.preset === 'weekly') {
    rule['time'] = draft.time
    rule['weekdays'] = draft.weekdays
  }
  if (draft.preset === 'monthly') {
    rule['time'] = draft.time
    rule['monthDays'] = draft.monthDays
    rule['monthlyOverflow'] = draft.monthlyOverflow
  }
  if (draft.preset === 'custom') {
    rule['cron'] = draft.cron
  }
  return { ...base, kind: 'recurring', rule }
}


/** Field-level validation result for the editor (FIX-04). */
export interface DraftValidation {
  /** Form-level message (e.g. a missing title), or undefined. */
  error?: string
  /** Per-field messages keyed by field name. */
  fieldErrors: { startAt?: string; endAt?: string }
}

/**
 * Validate a draft before it is sent to the server.
 *
 * Keeps the messages field-scoped so the editor can mark the offending input
 * instead of showing the generic `invalid_argument` translation.
 * @param draft - Current form state.
 * @param t - Translator.
 * @returns The first blocking error, if any.
 */
export function validateDraft(
  draft: TaskDraft,
  t: (key: string, params?: Record<string, string | number>) => string,
): DraftValidation {
  if (draft.title.trim() === '') return { error: t('form.required'), fieldErrors: {} }
  if (draft.kind !== 'once') return { fieldErrors: {} }
  if (draft.endAt.trim() === '') return { fieldErrors: { endAt: t('form.endAtRequired') } }
  if (draft.startAt !== '' && draft.endAt <= draft.startAt) {
    return { fieldErrors: { endAt: t('form.endAfterStart') } }
  }
  return { fieldErrors: {} }
}

/**
 * Merge a `/parse` draft payload into a complete `TaskDraft`.
 * @param base - Empty draft for defaults.
 * @param raw - Draft fields from the host.
 * @returns A TaskDraft safe for the editor.
 */
export function draftFromParse(base: TaskDraft, raw: Record<string, unknown>): TaskDraft {
  const draft: TaskDraft = { ...base }
  for (const key of [
    'kind',
    'title',
    'description',
    'preset',
    'time',
    'timeZone',
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
    'channels',
    'advanceMinutes',
    'sound',
    'endReminder',
    'template',
  ] as const) {
    const value = raw[key]
    if (value !== undefined && value !== null) draft[key] = value as never
  }
  return draft
}
