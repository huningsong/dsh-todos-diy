/**
 * Settings modal (F8.10 / F9.1–F9.3 / F9.4).
 *
 * Split from `panel.ts` to stay inside the NF5 budget. Reads and writes the
 * global settings through `/settings/get` and `/settings/update`; the export and
 * import controls live here too, since they are data-level operations.
 */

import * as React from 'react'

import { api, ApiError, type SettingsPayload } from './api'
import { Modal } from './ui'

const h = React.createElement

/** The settings modal (F8.10 / F9.1–F9.3). */
export function SettingsModal(props: {
  t: (key: string, params?: Record<string, string | number>) => string
  initial: SettingsPayload | null
  onClose: () => void
  onSaved: (settings: SettingsPayload) => void
}) {
  const { t } = props
  const base = props.initial ?? {
    timeZone: 'Asia/Shanghai',
    tickIntervalMs: 60000,
    graceMinutes: 5,
    defaultChannels: ['overlay'] as ('overlay' | 'system')[],
    dnd: { enabled: false, start: '22:00', end: '08:00', weekdaysOnly: false },
    retentionDays: 90,
  }
  const [timeZone, setTimeZone] = React.useState(base.timeZone)
  const [graceMinutes, setGraceMinutes] = React.useState(base.graceMinutes)
  const [dnd, setDnd] = React.useState(base.dnd)
  const [channels, setChannels] = React.useState(base.defaultChannels)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.updateSettings({
        timeZone,
        graceMinutes,
        dnd,
        defaultChannels: channels.includes('overlay') ? channels : ['overlay', ...channels],
      })
      props.onSaved(saved)
    } catch (caught) {
      setError(caught instanceof ApiError ? t(`error.${caught.code}`) : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return h(
    Modal,
    {
      title: t('settings.title'),
      onClose: props.onClose,
      footer: [
        h('button', { key: 'c', type: 'button', className: 'dtd-btn ghost', onClick: props.onClose }, t('form.cancel')),
        h(
          'button',
          { key: 's', type: 'button', className: 'dtd-btn', disabled: saving, onClick: () => void save() },
          saving ? t('state.saving') : t('settings.save'),
        ),
      ],
    },
    error === null ? null : h('div', { className: 'dtd-error', role: 'alert' }, error),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('settings.timeZone')),
      h('input', {
        className: 'dtd-input',
        value: timeZone,
        'aria-label': t('settings.timeZone'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTimeZone(event.target.value),
      }),
      h('span', { className: 'dtd-hint' }, t('settings.timeZoneHint')),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('settings.grace')),
      h('input', {
        type: 'number',
        min: 0,
        max: 60,
        className: 'dtd-input',
        value: graceMinutes,
        'aria-label': t('settings.grace'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          setGraceMinutes(Math.max(0, Math.min(60, Number(event.target.value) || 0))),
      }),
      h('span', { className: 'dtd-hint' }, t('settings.graceHint')),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('label', { className: 'dtd-check-row' },
        h('input', {
          type: 'checkbox',
          checked: dnd.enabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDnd({ ...dnd, enabled: event.target.checked }),
        }),
        t('settings.dndEnabled'),
      ),
      h(
        'div',
        { className: 'dtd-row2' },
        h(
          'div',
          { className: 'dtd-field' },
          h('span', { className: 'dtd-label' }, t('settings.dndStart')),
          h('input', {
            type: 'time',
            className: 'dtd-input',
            value: dnd.start,
            'aria-label': t('settings.dndStart'),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDnd({ ...dnd, start: event.target.value }),
          }),
        ),
        h(
          'div',
          { className: 'dtd-field' },
          h('span', { className: 'dtd-label' }, t('settings.dndEnd')),
          h('input', {
            type: 'time',
            className: 'dtd-input',
            value: dnd.end,
            'aria-label': t('settings.dndEnd'),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDnd({ ...dnd, end: event.target.value }),
          }),
        ),
      ),
      h(
        'label',
        { className: 'dtd-check-row' },
        h('input', {
          type: 'checkbox',
          checked: dnd.weekdaysOnly,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDnd({ ...dnd, weekdaysOnly: event.target.checked }),
        }),
        t('settings.dndWeekdays'),
      ),
      h('span', { className: 'dtd-hint' }, t('settings.dndHint')),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('settings.channels')),
      h('label', { className: 'dtd-check-row' }, h('input', { type: 'checkbox', checked: true, disabled: true }), t('form.notify.overlay')),
      h(
        'label',
        { className: 'dtd-check-row' },
        h('input', {
          type: 'checkbox',
          checked: channels.includes('system'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            setChannels(
              event.target.checked
                ? [...new Set([...channels, 'system' as const])]
                : channels.filter((channel) => channel !== 'system'),
            ),
        }),
        t('form.notify.system'),
      ),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('settings.export')),
      h(
        'div',
        { className: 'dtd-segment' },
        h(
          'button',
          {
            type: 'button',
            className: 'dtd-seg',
            onClick: () => {
              void api
                .exportData()
                .then(({ text, filename }) => {
                  const blob = new Blob([text], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = filename
                  anchor.click()
                  URL.revokeObjectURL(url)
                })
                .catch((caught: unknown) => setError(String(caught)))
            },
          },
          t('settings.export'),
        ),
        h(
          'label',
          { className: 'dtd-seg', style: { display: 'inline-flex', alignItems: 'center', cursor: 'pointer' } },
          t('settings.import'),
          h('input', {
            type: 'file',
            accept: 'application/json,.json',
            style: { display: 'none' },
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0]
              if (file === undefined) return
              void file
                .text()
                .then((text) => api.importData(JSON.parse(text), 'merge'))
                .then(() => props.onClose())
                .catch((caught: unknown) => setError(String(caught)))
            },
          }),
        ),
      ),
      h('span', { className: 'dtd-hint' }, t('settings.backup')),
    ),
  )
}

