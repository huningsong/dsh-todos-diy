/**
 * The task editor (F8.5): one modal for both kinds. Saving validates locally
 * first, then posts and maps any server error code back onto the form.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'

const h = React.createElement
import { api, ApiError } from './api'
import { draftFromTask, draftToPayload, validateDraft, type TaskDraft } from './task-draft'

export { emptyDraft, draftFromTask, draftToPayload, toLocalInput, validateDraft, type TaskDraft } from './task-draft'
import { Modal } from './ui'
import { BasicFields, OnceFields, RuleFields } from './editor-fields'
import { requestNotificationPermission } from './notify-permission'

/** Props for the editor. */
export interface TaskEditorProps {
  initial: TaskDraft
  editingId: string | null
  editingRevision: number | null
  t: (key: string, params?: Record<string, string | number>) => string
  /** F10.3: per-field provenance from the natural-language parser. */
  fieldStatus?: Record<string, 'explicit' | 'default' | 'missing'>
  /** F10.4: banner summarising what still needs input. */
  banner?: string
  onClose: () => void
  onSaved: (task: TaskView) => void
}

/** The editor modal. */
export function TaskEditor(props: TaskEditorProps) {
  const { t, fieldStatus } = props
  const [draft, setDraft] = React.useState<TaskDraft>(props.initial)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<{ startAt?: string; endAt?: string }>({})
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
    // FIX-04: field-level messages instead of a generic "参数不合法".
    const validation = validateDraft(draft, t)
    setFieldErrors(validation.fieldErrors)
    if (validation.error !== undefined) {
      setError(validation.error)
      return
    }
    if (Object.keys(validation.fieldErrors).length > 0) return
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
    ? h(RuleFields, { draft, update, t, fieldStatus })
    : h(OnceFields, { draft, update, t, fieldErrors, fieldStatus })

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
    props.banner === undefined ? null : h('div', { className: 'dtd-nlpBanner', role: 'status' }, props.banner),
    error === null ? null : h('div', { className: 'dtd-error', role: 'alert' }, error),
    h(BasicFields, { draft, update, t, fieldStatus }),
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
