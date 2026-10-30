/**
 * Task construction and patching: validation plus object assembly.
 *
 * Split from `repo.ts` (NF5 line budget) and kept free of storage mutation: the
 * functions here take a task and settings and return a *new* task. That makes
 * the field-level rules testable without a store.
 */

import { newTaskId } from './ids.js'
import type { Settings } from './state.js'
import type { Task } from './rules/types.js'
import type { CreateTaskInput, UpdateTaskPatch } from './repoTypes.js'
import {
  ValidationError,
  validateDescription,
  validateNotify,
  validateOnce,
  validateRule,
  validateTimeZone,
  validateTitle,
} from './validate.js'

/** Default reminder template (F5.4). */
export const DEFAULT_TEMPLATE = '{title}｜{time}\n{note}'

/**
 * Build a fresh task from user input.
 * @param input - Validated shape from the API/tool caller.
 * @param settings - Current settings (zone and channel defaults).
 * @param now - Creation instant (drives the id and timestamps).
 * @returns A new task in `active` status with a clean state block.
 */
export function buildTask(input: CreateTaskInput, settings: Settings, now: Date): Task {
  if (input.kind !== 'recurring' && input.kind !== 'once') {
    throw new ValidationError('invalid_argument', 'kind must be "recurring" or "once"', { field: 'kind' })
  }
  // F4.11: `dueDate` must be rejected outright, not silently ignored — a client
  // still sending it needs a clear error so the data model cannot drift back.
  rejectLegacyDueDate(input as unknown as Record<string, unknown>)
  const title = validateTitle(input.title)
  const description = validateDescription(input.description)
  const zone = validateTimeZone(input.timeZone, settings.timeZone)
  let rule: Task['rule'] = null
  let once: Task['once'] = null
  if (input.kind === 'recurring') {
    rule = validateRule(input.rule, zone)
  } else {
    const endReminder = readEndReminderFlag(input.notify)
    once = validateOnce(input.once, zone, now, endReminder)
  }
  const notify = validateNotify(input.notify, {
    channels: settings.defaultChannels,
    template: DEFAULT_TEMPLATE,
  })
  return {
    id: newTaskId(now),
    title,
    description,
    kind: input.kind,
    status: 'active',
    pinned: input.pinned === true,
    doneAt: null,
    archivedQuarter: null,
    rule,
    once,
    notify,
    state: {
      lastFiredAt: null,
      lastOccurrenceKey: null,
      // A task that "already started" at creation has nothing to announce, so
      // F3.4 defines its firedStart as already satisfied.
      firedStart: once !== null && once.startAtSource === 'created',
      firedEnd: false,
      firedStartAdvance: false,
      firedEndAdvance: false,
      missedStart: false,
      missedEnd: false,
      missedAt: null,
      missedCount: 0,
      snoozeUntil: null,
      completedOccurrenceKey: null,
    },
    revision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

/**
 * Apply one patch onto a copy of a task, validating every provided field.
 *
 * Editing a rule or a one-off window clears the previous firing markers: the
 * old `occurrenceKey` no longer describes anything, and keeping it would make
 * the next solve think the new schedule had already fired.
 * @param current - Task before the edit.
 * @param patch - Partial update.
 * @param settings - Current settings (zone fallback for windows).
 * @param now - Edit instant, used for `updatedAt`.
 * @returns A new task with `revision + 1`.
 */
export function patchTask(current: Task, patch: UpdateTaskPatch, settings: Settings, now: Date): Task {
  rejectLegacyDueDate(patch as unknown as Record<string, unknown>)
  const next: Task = { ...current }
  if (patch.title !== undefined) next.title = validateTitle(patch.title)
  if (patch.description !== undefined) next.description = validateDescription(patch.description)
  if (patch.pinned !== undefined) next.pinned = patch.pinned === true
  if (patch.rule !== undefined) {
    if (current.kind !== 'recurring') {
      throw new ValidationError('invalid_state', 'cannot set a rule on a one-off task', { field: 'rule' })
    }
    next.rule = validateRule(patch.rule, current.rule?.timeZone ?? settings.timeZone)
    next.state = { ...next.state, lastOccurrenceKey: null, lastFiredAt: null }
  }
  if (patch.once !== undefined) {
    if (current.kind !== 'once') {
      throw new ValidationError('invalid_state', 'cannot set a window on a recurring task', { field: 'once' })
    }
    const previous = current.once
    const endReminder = readEndReminderFlag(patch.notify) ?? current.notify.endReminder
    // F3.8: a partial `once` patch keeps the untouched bound. Without this
    // merge, editing only `endAt` would reset `startAt` to the creation time
    // and flip `startAtSource` to "created", silently losing the start node.
    const patchRaw = patch.once !== null && typeof patch.once === 'object' ? (patch.once as Record<string, unknown>) : {}
    const merged: Record<string, unknown> = {
      ...(previous ?? {}),
      ...patchRaw,
    }
    if (!Object.hasOwn(patchRaw, 'startAt') && previous !== null) {
      merged['startAt'] = previous.startAt
      merged['startAtSource'] = previous.startAtSource
    }
    if (!Object.hasOwn(patchRaw, 'timeZone') && previous !== null) merged['timeZone'] = previous.timeZone
    next.once = validateOnce(
      merged,
      previous?.timeZone ?? settings.timeZone,
      new Date(current.createdAt),
      endReminder,
      { keepCreated: previous?.startAtSource === 'created' && !Object.hasOwn(patchRaw, 'startAt') },
    )
    next.state = resetOnceMarkers(current, next.once, previous)
  }
  if (patch.notify !== undefined) {
    next.notify = validateNotify(patch.notify, {
      // F5.7/F5.8: a partial notify patch must not reset the fields it omits.
      channels: current.notify.channels,
      template: current.notify.template,
      endReminder: current.notify.endReminder,
      advanceMinutes: current.notify.advanceMinutes,
      sound: current.notify.sound,
    })
  }
  // F3.3: "start-only" needs an explicit start, even when the flag is flipped by
  // an update rather than supplied at creation time.
  if (next.kind === 'once' && next.notify.endReminder === false && next.once?.startAtSource === 'created') {
    throw new ValidationError(
      'invalid_argument',
      'notify.endReminder=false requires an explicit once.startAt; otherwise the task would have no reminder',
      { field: 'notify.endReminder' },
    )
  }
  next.revision = current.revision + 1
  next.updatedAt = now.toISOString()
  return next
}

/**
 * Read the `endReminder` flag out of an unvalidated notify payload.
 * @param value - Candidate notify block.
 * @returns The flag, or undefined when absent.
 */
function readEndReminderFlag(value: unknown): boolean | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  return typeof raw['endReminder'] === 'boolean' ? raw['endReminder'] : undefined
}

/**
 * Reset one-off firing markers after an edit (F3.8).
 *
 * Editing only `endAt` keeps `startAt` and `startAtSource` and re-arms the end
 * side. Supplying a different `startAt` re-arms the start side too.
 * @param current - Task before the edit.
 * @param nextWindow - Validated window after the edit.
 * @param previous - Window before the edit, or null.
 * @returns The state block to attach.
 */
function resetOnceMarkers(current: Task, nextWindow: NonNullable<Task['once']>, previous: NonNullable<Task['once']> | null): Task['state'] {
  const state = { ...current.state }
  const startChanged = previous === null || previous.startAt !== nextWindow.startAt || previous.startAtSource !== nextWindow.startAtSource
  if (startChanged) {
    state.firedStart = nextWindow.startAtSource === 'created'
    state.firedStartAdvance = false
    state.missedStart = false
  }
  state.firedEnd = false
  state.firedEndAdvance = false
  state.missedEnd = false
  state.lastOccurrenceKey = null
  return state
}

/**
 * Reject the removed `dueDate` field (D-25 / F4.11).
 * @param value - Untrusted input object.
 * @throws ValidationError when `dueDate` is present.
 */
function rejectLegacyDueDate(value: Record<string, unknown>): void {
  if (Object.hasOwn(value, 'dueDate') && value['dueDate'] !== undefined) {
    throw new ValidationError(
      'invalid_argument',
      'dueDate was removed in schema v2; use once.endAt (one-off) or rule.time (recurring)',
      { field: 'dueDate' },
    )
  }
}
