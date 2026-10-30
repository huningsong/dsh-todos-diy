/**
 * Test fixtures: build valid `Task` objects with sensible defaults so each
 * test states only the fields it actually cares about.
 */

import type {
  NotifySettings,
  OnceWindow,
  RecurrenceRule,
  Task,
  TaskKind,
  TaskStatus,
} from '../src/host/rules/types.js'

/** Build a fully populated `RecurrenceRule`, overriding only what is passed. */
export function makeRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    preset: 'workdays',
    cron: '0 9 * * 1-5',
    timeZone: 'Asia/Shanghai',
    skipDates: [],
    extraWorkdays: [],
    holidayCalendar: 'CN',
    monthlyOverflow: 'lastDay',
    ...overrides,
  }
}

/** Build notification settings, overriding only what is passed. */
export function makeNotify(overrides: Partial<NotifySettings> = {}): NotifySettings {
  return {
    channels: ['overlay'],
    template: '{title}｜{time}\n{note}',
    advanceMinutes: 0,
    sound: false,
    ...overrides,
  }
}

/** Build a task; `kind` selects which of `rule` / `once` is populated. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  const kind: TaskKind = overrides.kind ?? 'recurring'
  const base: Task = {
    id: overrides.id ?? 'tr_test',
    title: overrides.title ?? '测试任务',
    description: overrides.description ?? '',
    kind,
    status: (overrides.status ?? 'active') as TaskStatus,
    dueDate: overrides.dueDate ?? null,
    pinned: overrides.pinned ?? false,
    doneAt: overrides.doneAt ?? null,
    archivedQuarter: overrides.archivedQuarter ?? null,
    rule: kind === 'recurring' ? (overrides.rule ?? makeRule()) : null,
    once: kind === 'once' ? (overrides.once ?? null) : null,
    notify: overrides.notify ?? makeNotify(),
    state: {
      lastFiredAt: null,
      lastOccurrenceKey: null,
      firedStart: false,
      firedEnd: false,
      firedStartAdvance: false,
      firedEndAdvance: false,
      missedStart: false,
      missedEnd: false,
      missedAt: null,
      missedCount: 0,
      snoozeUntil: null,
      completedOccurrenceKey: null,
      ...overrides.state,
    },
    revision: overrides.revision ?? 1,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  }
  return base
}

/** Build a one-off task with a start/end window. */
export function makeOnceTask(
  startAt: string,
  endAt: string,
  overrides: Partial<Task> = {},
): Task {
  const once: OnceWindow = { startAt, endAt, timeZone: overrides.rule?.timeZone ?? 'Asia/Shanghai' }
  return makeTask({ kind: 'once', once, ...overrides })
}

/** Convert an ISO string to a `Date`, failing loudly on a typo. */
export function at(iso: string): Date {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error(`invalid test instant: ${iso}`)
  return date
}
