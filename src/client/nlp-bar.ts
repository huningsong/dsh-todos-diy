/**
 * "✨ Natural-language quick add" bar (F10.1–F10.5).
 *
 * Only rendered when the user enabled the feature in settings. The bar never
 * creates anything: a successful parse opens the normal editor with the draft
 * pre-filled, and a failed parse opens it with the raw text as the title.
 */

import * as React from 'react'

import { api, ApiError, type NlpParsePayload } from './api'
import { draftFromParse, emptyDraft, type TaskDraft } from './task-draft'
import { Modal } from './ui'

const h = React.createElement

/** Props for the quick-add bar. */
export interface NlpBarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  timeZone: string
  onParsed: (draft: TaskDraft, result: NlpParsePayload) => void
  onDegraded: (context: { text: string; reason: string }) => void
  /** Controlled degraded hint owned by the panel (F10.11). */
  hint?: string | null
}

/** The quick-add bar. */
export function NlpBar(props: NlpBarProps): React.ReactNode {
  const { t, timeZone } = props
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (text.trim() === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.parse(text.trim())
      if (result.degraded) {
        props.onDegraded({ text: text.trim(), reason: result.reason ?? 'unknown' })
        setOpen(false)
        return
      }
      props.onParsed(draftFromParse(emptyDraft(timeZone), result.draft), result)
      setText('')
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof ApiError ? t(`error.${caught.code}`) : String(caught))
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
          Modal,
          {
            title: t('nlp.open'),
            onClose: () => {
              if (!busy) setOpen(false)
            },
            footer: [
              h(
                'button',
                {
                  key: 'cancel',
                  type: 'button',
                  className: 'dtd-btn ghost',
                  disabled: busy,
                  onClick: () => setOpen(false),
                },
                t('form.cancel'),
              ),
              h(
                'button',
                {
                  key: 'parse',
                  type: 'button',
                  className: 'dtd-btn',
                  disabled: busy || text.trim() === '',
                  onClick: () => void submit(),
                },
                busy ? t('nlp.parsing') : t('nlp.parse'),
              ),
            ],
          },
          h(
            'div',
            { className: 'dtd-field' },
            h('span', { className: 'dtd-label' }, t('nlp.dialog.hint')),
            h('textarea', {
              className: 'dtd-textarea dtd-nlpTextarea',
              value: text,
              rows: 6,
              autoFocus: true,
              placeholder: t('nlp.placeholder'),
              'aria-label': t('nlp.placeholder'),
              onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value),
              onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  void submit()
                }
              },
            }),
          ),
          h('p', { className: 'dtd-hint dtd-modelNotice', role: 'note' }, t('nlp.modelNotice')),
          error === null ? null : h('p', { className: 'dtd-error', role: 'alert' }, error),
        )
      : null,
    !open && (props.hint ?? error) !== null && (props.hint ?? error) !== undefined
      ? h('span', { className: 'dtd-hint', role: 'status' }, props.hint ?? error)
      : null,
  )
}
