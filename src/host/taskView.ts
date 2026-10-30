/**
 * `TaskView` projection (§7.4 / F1.1 / F4.10–F4.14 / F4.21).
 *
 * The API and the agent tools return this shape, never the raw stored task. It
 * adds the read-only derived fields (`stage`, `priority`, `fired`, `nextAt`,
 * `timeZone`, `utcOffset`, `overdueDays`, `overdue`) and drops nothing the UI
 * needs. Deriving on read is what makes stage/priority "只读、不落盘" true by
 * construction (D-25).
 */

import { nextFireAt } from './rules/occurrence.js'
import { daysOverdue, derivePriority, isOverdue, stageOf } from './rules/priority.js'
import type { HolidayTable } from './rules/holidays.js'
import { formatUtcOffset } from './rules/timezone.js'
import type { Priority, Task, TaskStage } from './rules/types.js'

/** The public projection of one task. */
export interface TaskView extends Omit<Task, 'state'> {
  /**
   * The rule with its preset-specific fields expanded (`time`, `weekdays`,
   * `monthDays`), so a TaskView can be fed straight back into
   * `POST /tasks/create` for a lossless round-trip (F1.1).
   */
  rule: (Task['rule'] & { time?: string; weekdays?: number[]; monthDays?: number[] }) | null
  /** Read-only derived stage (D-25). */
  stage: TaskStage
  /** Derived priority; `paused` for a paused task (D-20/D-22). */
  priority: Priority
  /** Read-only aggregate: `firedStart && firedEnd` (F3.4). */
  fired: boolean
  /** IANA zone the task is evaluated in. */
  timeZone: string
  /** `UTC±HH:MM` for the current instant, for the list row (F8.2). */
  utcOffset: string
  /** Next fire instant (advance-shifted), ISO, or null. */
  nextAt: string | null
  /** Whole days overdue; null when not overdue (D-22: paused is never overdue). */
  overdueDays: number | null
  /** True when the task should show the red「超期」marker. */
  overdue: boolean
  /** The persisted state block, exposed for the detail drawer. */
  state: Task['state']
}

/** Options for {@link toTaskView}. */
export interface ViewOptions {
  /** Current instant, used for stage/priority/offset and `nextAt`. */
  now: Date
  /** Holiday table for `workdays` next-occurrence maths. */
  holidays?: HolidayTable
}

/**
 * Project one task.
 * @param task - Stored task.
 * @param options - Now and the holiday table.
 * @returns The public view.
 */
export function toTaskView(task: Task, options: ViewOptions): TaskView {
  const timeZone = taskTimeZone(task)
  const next = task.status === 'active' ? nextFireAt(task, options.now, options.holidays) : null
  const nextAtFor = (candidate: Task): Date | null =>
    candidate.status === 'active' ? nextFireAt(candidate, options.now, options.holidays) : null
  return {
    ...task,
    rule: task.rule === null ? null : expandRule(task.rule),
    stage: stageOf(task, options.now),
    priority: derivePriority(task, options.now, { nextAtFor }),
    // F3.4: `fired` is exactly the two node flags; an advance reminder marks the
    // node as settled because it replaces the on-time reminder (F5.7).
    fired:
      task.kind === 'once'
        ? (task.state.firedStart || task.state.firedStartAdvance) &&
          (task.state.firedEnd || task.state.firedEndAdvance)
        : false,
    timeZone,
    utcOffset: formatUtcOffset(options.now.getTime(), timeZone),
    nextAt: next === null ? null : next.toISOString(),
    overdueDays: daysOverdue(task, options.now),
    overdue: isOverdue(task, options.now),
    state: task.state,
  }
}

/**
 * The zone a task is evaluated in: the rule's zone for a recurring task, the
 * window's zone for a one-off task, else the global default.
 * @param task - Stored task.
 * @param fallback - Global default zone.
 * @returns IANA zone identifier.
 */
export function taskTimeZone(task: Task, fallback = 'Asia/Shanghai'): string {
  return task.rule?.timeZone ?? task.once?.timeZone ?? fallback
}

/**
 * Project a list of tasks.
 * @param tasks - Stored tasks.
 * @param options - Shared projection options.
 * @returns Views in the same order.
 */
export function toTaskViews(tasks: readonly Task[], options: ViewOptions): TaskView[] {
  return tasks.map((task) => toTaskView(task, options))
}

/**
 * Expand a stored canonical rule back into the preset-specific fields the
 * editor and the create API expect (F1.1 round-trip).
 * @param rule - Stored rule.
 * @returns Rule plus `time` / `weekdays` / `monthDays` as applicable.
 */
export function expandRule(
  rule: NonNullable<Task['rule']>,
): NonNullable<TaskView['rule']> {
  const fields = rule.cron.split(/\s+/)
  const minute = Number(fields[0] ?? '0')
  const hour = Number(fields[1] ?? '0')
  const pad = (value: number): string => String(value).padStart(2, '0')
  const expanded: NonNullable<TaskView['rule']> = { ...rule }
  if (rule.preset === 'custom') return expanded
  expanded.time = `${pad(Number.isFinite(hour) ? hour : 0)}:${pad(Number.isFinite(minute) ? minute : 0)}`
  if (rule.preset === 'weekly') {
    expanded.weekdays = (fields[4] ?? '1')
      .split(',')
      .map((token) => Number(token))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 7)
      .map((value) => (value === 0 ? 7 : value))
  }
  if (rule.preset === 'monthly') {
    expanded.monthDays = (fields[2] ?? '1')
      .split(',')
      .map((token) => Number(token))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
  }
  return expanded
}
