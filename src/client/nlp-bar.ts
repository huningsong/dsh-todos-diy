/**
 * "✨ Natural-language quick add" bar (F10.1–F10.5).
 *
 * Only rendered when the user enabled the feature in settings. The bar never
 * creates anything: a successful parse opens the normal editor with the draft
 * pre-filled, and a failed parse opens it with the raw text as the title.
 */

import * as React from 'react'

import { api, ApiError, type NlpParsePayload } from './api'
import { emptyDraft, type TaskDraft } from './task-draft'

const h = React.createElement

/** Props for the quick-add bar. */
export interface NlpBarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  timeZone: string
  onParsed: (draft: TaskDraft, result: NlpParsePayload) => void
  onDegraded: (text: string) => void
}

/**
 * Merge a parse payload into a complete draft.
 * @param base - Empty draft for defaults.
 * @param raw - Draft fields from the host.
 * @returns A TaskDraft safe for the editor.
 */
export function draftFromParse(base: TaskDraft, raw: Record<string, unknown>): TaskDraft {
  const draft: TaskDraft = { ...base }
  const assign = <K extends keyof TaskDraft>(key: K): void => {
    const value = raw[key as string]
    if (value !== undefined && value !== null) draft[key] = value as TaskDraft[K]
  }
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
    assign(key)
  }
  return draft
}

/** The quick-add bar. */
export function NlpBar(props: NlpBarProps): React.ReactNode {
  const { t, timeZone } = props
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [hint, setHint] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (text.trim() === '' || busy) return
    setBusy(true)
    setHint(null)
    try {
      const result = await api.parse(text.trim())
      if (result.degraded) {
        setHint(t('nlp.degraded'))
        props.onDegraded(text.trim())
        return
      }
      props.onParsed(draftFromParse(emptyDraft(timeZone), result.draft), result)
      setText('')
      setOpen(false)
    } catch (caught) {
      setHint(caught instanceof ApiError ? t(`error.${caught.code}`) : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return h(
    'div',
    { className: 'dtd-nlp', 'data-testid': 'nlp-bar' },
    h(
      'button',
      {
        type: 'button',
        className: 'dtd-nlpToggle',
        'aria-expanded': open,
        onClick: () => setOpen((current) => !current),
      },
      '✨ ',
      t('nlp.open'),
    ),
    open
      ? h(
          'div',
          { className: 'dtd-nlpRow' },
          h('input', {
            className: 'dtd-input dtd-nlpInput',
            value: text,
            placeholder: t('nlp.placeholder'),
            'aria-label': t('nlp.placeholder'),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value),
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') void submit()
            },
          }),
          h(
            'button',
            { type: 'button', className: 'dtd-btn', disabled: busy, onClick: () => void submit() },
            busy ? t('nlp.parsing') : t('nlp.parse'),
          ),
        )
      : null,
    hint === null ? null : h('span', { className: 'dtd-hint', role: 'status' }, hint),
  )
}
