/**
 * The task editor (F8.5): one modal for both kinds. Saving validates locally
 * first, then posts and maps any server error code back onto the form.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'

const h = React.createElement
import { api, ApiError } from './api'
import { Modal } from './ui'
import { BasicFields, OnceFields, RuleFields } from './editor-fields'
import { requestNotificationPermission } from './notify-permission'

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
  const base = emptyDraft(fallbackZone)
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
    draft.startAt = toLocalInput(task.once.startAt, rule?.timeZone ?? fallbackZone)
    draft.endAt = toLocalInput(task.once.endAt, rule?.timeZone ?? fallbackZone)
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
      once: { startAt: draft.startAt, endAt: draft.endAt },
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

/** Props for the editor. */
export interface TaskEditorProps {
  initial: TaskDraft
  editingId: string | null
  editingRevision: number | null
  t: (key: string, params?: Record<string, string | number>) => string
  onClose: () => void
  onSaved: (task: TaskView) => void
}

/** The editor modal. */
export function TaskEditor(props: TaskEditorProps) {
  const { t } = props
  const [draft, setDraft] = React.useState<TaskDraft>(props.initial)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [preview, setPreview] = React.useState<string[]>([])

  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // Preview the next five runs whenever the rule inputs change (F2.9 / F8.5).
  React.useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      const payload = draftToPayload(draft)
      const rule = payload['rule']
      if (rule === undefined) {
        setPreview([])
        return
      }
      void api
        .preview(rule, draft.timeZone)
        .then((result) => {
          if (!cancelled) setPreview(result.times)
        })
        .catch(() => {
          if (!cancelled) setPreview([])
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draft])

  const save = async (): Promise<void> => {
    setError(null)
    if (draft.title.trim() === '') {
      setError(t('form.required'))
      return
    }
    if (draft.kind === 'once' && draft.startAt !== '' && draft.endAt !== '' && draft.endAt <= draft.startAt) {
      setError(t('form.endAfterStart'))
      return
    }
    setSaving(true)
    try {
      // F9.3 / UX-12: only ask for the notification permission when the user
      // actually chooses the system channel, never on mount.
      if (draft.channels.includes('system')) await requestNotificationPermission()
      const payload = draftToPayload(draft)
      const saved =
        props.editingId === null
          ? await api.create(payload)
          : await api.update(props.editingId, props.editingRevision ?? 1, payload)
      props.onSaved(saved)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const translated = t(`error.${caught.code}`)
        setError(
          caught.code === 'invalid_cron'
            ? t('form.invalidCron', { message: caught.message })
            : translated === `error.${caught.code}`
              ? caught.message
              : translated,
        )
      } else {
        setError(String(caught))
      }
    } finally {
      setSaving(false)
    }
  }

  const ruleFields = draft.kind === 'recurring'
    ? h(RuleFields, { draft, update, t })
    : h(OnceFields, { draft, update, t })

  return h(
    Modal,
    {
      title: props.editingId === null ? t('form.title.new') : t('form.title.edit'),
      onClose: props.onClose,
      wide: true,
      footer: [
        h('button', { key: 'cancel', type: 'button', className: 'dtd-btn ghost', onClick: props.onClose }, t('form.cancel')),
        h(
          'button',
          { key: 'save', type: 'button', className: 'dtd-btn', disabled: saving, onClick: () => { void save() } },
          saving ? t('state.saving') : t('form.save'),
        ),
      ],
    },
    error === null ? null : h('div', { className: 'dtd-error', role: 'alert' }, error),
    h(BasicFields, { draft, update, t }),
    ruleFields,
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('form.notify')),
      h(
        'label',
        { className: 'dtd-check-row' },
        h('input', { type: 'checkbox', checked: true, disabled: true }),
        t('form.notify.overlay'),
      ),
      h(
        'label',
        { className: 'dtd-check-row' },
        h('input', {
          type: 'checkbox',
          checked: draft.channels.includes('system'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            update(
              'channels',
              event.target.checked
                ? [...new Set([...draft.channels, 'system' as const])]
                : draft.channels.filter((channel) => channel !== 'system'),
            ),
        }),
        t('form.notify.system'),
      ),
    ),
    h(
      'div',
      { className: 'dtd-row2' },
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.advance')),
        h('input', {
          type: 'number',
          min: 0,
          max: 1440,
          className: 'dtd-input',
          value: draft.advanceMinutes,
          'aria-label': t('form.advance'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            update('advanceMinutes', Math.max(0, Math.min(1440, Number(event.target.value) || 0))),
        }),
        h('span', { className: 'dtd-hint' }, t('form.advanceHint')),
      ),
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.sound')),
        h(
          'label',
          { className: 'dtd-check-row' },
          h('input', {
            type: 'checkbox',
            checked: draft.sound,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('sound', event.target.checked),
          }),
          t('form.sound'),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('form.preview')),
      h(
        'pre',
        { className: 'dtd-preview' },
        preview.length === 0 ? t('form.previewEmpty') : preview.map((time) => formatPreview(time, draft.timeZone)).join('\n'),
      ),
    ),
  )
}

/**
 * Format a preview instant for the editor list.
 * @param iso - Instant.
 * @param timeZone - Task zone.
 * @returns `YYYY-MM-DD HH:mm`.
 */
function formatPreview(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
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
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
  } catch {
    return iso
  }
}
