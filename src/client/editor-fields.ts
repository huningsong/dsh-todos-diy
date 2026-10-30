/**
 * The rule / window field groups of the task editor (F8.5).
 *
 * Split from `task-editor.ts` to stay inside the NF5 budget. Both functions are
 * pure renderers over `(draft, update, t)` — the editor owns state, this module
 * owns the form layout.
 */

import * as React from 'react'

import type { TaskDraft } from './task-editor'
import { weekdayLabel } from './ui'

const h = React.createElement

/** Update callback handed down by the editor. */
export type UpdateFn = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => void

/** Translator. */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/** Props shared by both field groups. */
export interface FieldProps {
  draft: TaskDraft
  update: UpdateFn
  t: Translate
}

/**
 * Render the recurring-rule fields (preset, time, weekday/monthday, holiday
 * basis, month-end policy and the exception-date chips).
 * @param props - Draft, updater and translator.
 * @returns React child list.
 */
export function RuleFields({ draft, update, t }: FieldProps): React.ReactNode {
  const dateChips = (field: 'skipDates' | 'extraWorkdays', label: string): React.ReactNode =>
    h(
      'div',
      { className: 'dtd-field', key: field },
      h('span', { className: 'dtd-label' }, label),
      h(
        'div',
        { className: 'dtd-chips' },
        draft[field].map((date) =>
          h(
            'span',
            { key: date, className: 'dtd-chip' },
            date,
            h(
              'button',
              {
                type: 'button',
                'aria-label': `Remove ${date}`,
                onClick: () => update(field, draft[field].filter((entry) => entry !== date)),
              },
              '×',
            ),
          ),
        ),
        h('input', {
          type: 'date',
          className: 'dtd-input',
          style: { width: 150 },
          'aria-label': label,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value
            if (value === '' || draft[field].includes(value)) return
            update(field, [...draft[field], value].sort())
            event.target.value = ''
          },
        }),
      ),
      h('span', { className: 'dtd-hint' }, t('form.exceptionHint')),
    )

  return [
    h(
      'div',
      { className: 'dtd-field', key: 'preset' },
      h('span', { className: 'dtd-label' }, t('form.rule')),
      h(
        'div',
        { className: 'dtd-segment' },
        (['workdays', 'weekly', 'monthly', 'custom'] as const).map((preset) =>
          h(
            'button',
            {
              key: preset,
              type: 'button',
              className: 'dtd-seg',
              'aria-pressed': draft.preset === preset,
              onClick: () => update('preset', preset),
            },
            t(`form.preset.${preset}`),
          ),
        ),
      ),
    ),
    draft.preset === 'custom'
      ? h(
          'div',
          { className: 'dtd-field', key: 'cron' },
          h('span', { className: 'dtd-label' }, t('form.cron')),
          h('input', {
            className: 'dtd-input',
            value: draft.cron,
            'aria-label': t('form.cron'),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('cron', event.target.value),
          }),
          h('span', { className: 'dtd-hint' }, t('form.cronHint')),
        )
      : h(
          'div',
          { className: 'dtd-row2', key: 'time' },
          h(
            'div',
            { className: 'dtd-field' },
            h('span', { className: 'dtd-label' }, t('form.time')),
            h('input', {
              type: 'time',
              className: 'dtd-input',
              value: draft.time,
              'aria-label': t('form.time'),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('time', event.target.value),
            }),
          ),
          draft.preset === 'weekly'
            ? h(
                'div',
                { className: 'dtd-field' },
                h('span', { className: 'dtd-label' }, t('form.weekdays')),
                h(
                  'div',
                  { className: 'dtd-segment' },
                  [1, 2, 3, 4, 5, 6, 7].map((iso) =>
                    h(
                      'button',
                      {
                        key: iso,
                        type: 'button',
                        className: 'dtd-seg',
                        'aria-pressed': draft.weekdays.includes(iso),
                        onClick: () =>
                          update(
                            'weekdays',
                            draft.weekdays.includes(iso)
                              ? draft.weekdays.filter((day) => day !== iso)
                              : [...draft.weekdays, iso].sort((a, b) => a - b),
                          ),
                      },
                      weekdayLabel(t, iso),
                    ),
                  ),
                ),
              )
            : null,
          draft.preset === 'monthly'
            ? h(
                'div',
                { className: 'dtd-field' },
                h('span', { className: 'dtd-label' }, t('form.monthDays')),
                h('input', {
                  className: 'dtd-input',
                  value: draft.monthDays.join(','),
                  'aria-label': t('form.monthDays'),
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    update(
                      'monthDays',
                      event.target.value
                        .split(',')
                        .map((token) => Number(token.trim()))
                        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31),
                    ),
                }),
              )
            : null,
        ),
    draft.preset === 'workdays'
      ? h(
          'div',
          { className: 'dtd-field', key: 'holiday' },
          h('span', { className: 'dtd-label' }, t('form.holidayCalendar')),
          h(
            'div',
            { className: 'dtd-segment' },
            (['CN', 'none'] as const).map((calendar) =>
              h(
                'button',
                {
                  key: calendar,
                  type: 'button',
                  className: 'dtd-seg',
                  'aria-pressed': draft.holidayCalendar === calendar,
                  onClick: () => update('holidayCalendar', calendar),
                },
                t(`form.holidayCalendar.${calendar}`),
              ),
            ),
          ),
          h('span', { className: 'dtd-hint' }, t('form.holidayCalendarHint')),
        )
      : null,
    draft.preset === 'monthly'
      ? h(
          'div',
          { className: 'dtd-field', key: 'overflow' },
          h('span', { className: 'dtd-label' }, t('form.monthlyOverflow')),
          h(
            'div',
            { className: 'dtd-segment' },
            (['lastDay', 'skip'] as const).map((policy) =>
              h(
                'button',
                {
                  key: policy,
                  type: 'button',
                  className: 'dtd-seg',
                  'aria-pressed': draft.monthlyOverflow === policy,
                  onClick: () => update('monthlyOverflow', policy),
                },
                t(`form.monthlyOverflow.${policy}`),
              ),
            ),
          ),
        )
      : null,
    dateChips('skipDates', t('form.skipDates')),
    dateChips('extraWorkdays', t('form.extraWorkdays')),
  ]
}

/**
 * Render the one-off start/end window.
 * @param props - Draft, updater and translator.
 * @returns React child list.
 */
export function OnceFields({ draft, update, t }: FieldProps): React.ReactNode {
  return [
    h(
      'div',
      { className: 'dtd-row2', key: 'window' },
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.startAt')),
        h('input', {
          type: 'datetime-local',
          className: 'dtd-input',
          value: draft.startAt,
          'aria-label': t('form.startAt'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('startAt', event.target.value),
        }),
      ),
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.endAt')),
        h('input', {
          type: 'datetime-local',
          className: 'dtd-input',
          value: draft.endAt,
          'aria-label': t('form.endAt'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('endAt', event.target.value),
        }),
      ),
    ),
    h('span', { className: 'dtd-hint', key: 'hint' }, t('form.onceHint')),
  ]
}

/**
 * Render the identity fields shared by both task kinds: type, name, notes,
 * deadline and time zone.
 * @param props - Draft, updater and translator.
 * @returns React child list.
 */
export function BasicFields({ draft, update, t }: FieldProps): React.ReactNode {
  return [
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('form.kind')),
      h(
        'div',
        { className: 'dtd-segment' },
        (['recurring', 'once'] as const).map((kind) =>
          h(
            'button',
            {
              key: kind,
              type: 'button',
              className: 'dtd-seg',
              'aria-pressed': draft.kind === kind,
              onClick: () => update('kind', kind),
            },
            t(`form.kind.${kind}`),
          ),
        ),
      ),
      h('span', { className: 'dtd-hint' }, t(`form.kind.${draft.kind}Hint`)),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('form.name')),
      h('input', {
        className: 'dtd-input',
        value: draft.title,
        maxLength: 200,
        placeholder: t('form.namePlaceholder'),
        'aria-label': t('form.name'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('title', event.target.value),
      }),
      h('span', { className: 'dtd-hint' }, t('form.nameHint')),
    ),
    h(
      'div',
      { className: 'dtd-field' },
      h('span', { className: 'dtd-label' }, t('form.description')),
      h('textarea', {
        className: 'dtd-textarea',
        value: draft.description,
        maxLength: 2000,
        placeholder: t('form.descriptionPlaceholder'),
        'aria-label': t('form.description'),
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => update('description', event.target.value),
      }),
    ),
    h(
      'div',
      { className: 'dtd-row2' },
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.dueDate')),
        h('input', {
          type: 'date',
          className: 'dtd-input',
          value: draft.dueDate,
          'aria-label': t('form.dueDate'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('dueDate', event.target.value),
        }),
        h('span', { className: 'dtd-hint' }, t('form.dueDateHint')),
      ),
      h(
        'div',
        { className: 'dtd-field' },
        h('span', { className: 'dtd-label' }, t('form.timeZone')),
        h('input', {
          className: 'dtd-input',
          value: draft.timeZone,
          'aria-label': t('form.timeZone'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => update('timeZone', event.target.value),
        }),
      ),
    )
  ]
}
