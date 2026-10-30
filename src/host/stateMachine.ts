/**
 * Task state machine (F1.2).
 *
 * `active` ⇄ `paused`; `active` → `done`; any status → `archived`;
 * `archived` → `active` (restore). Everything else is `invalid_state`.
 * Pure: the caller supplies the task and gets a boolean.
 */

import type { TaskStatus } from './rules/types.js'

/** Allowed transitions. */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  active: ['paused', 'done', 'archived'],
  paused: ['active', 'archived'],
  done: ['archived'],
  archived: ['active'],
}

/**
 * Whether one status transition is legal.
 * @param from - Current status.
 * @param to - Requested status.
 * @returns True when the state machine allows it.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

/**
 * Describe an illegal transition for the error message.
 * @param from - Current status.
 * @param to - Requested status.
 * @returns Human-readable explanation.
 */
export function describeTransition(from: TaskStatus, to: TaskStatus): string {
  return `cannot move a task from "${from}" to "${to}"`
}
