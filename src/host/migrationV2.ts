/**
 * `schemaVersion` 1 → 2: the D-25 task time and status model.
 *
 * Four call sites share this exact function (F9.5):
 *   1. `tasks.json`
 *   2. `archive/completed-*.json`
 *   3. `archive/index.json` (version bump only, entries untouched)
 *   4. `POST /import`
 *
 * Rules frozen by the handoff:
 *  - drop `dueDate`;
 *  - keep `once.startAt`, set `startAtSource="explicit"` when it was present;
 *  - add `notify.endReminder=true` and the full `TaskState` defaults;
 *  - a v1 one-off task **without** `endAt` is a hard failure: the caller keeps
 *    the original file and reports `migration-failed` instead of guessing.
 */

/** A migration that cannot be applied without inventing data. */
export class MigrationError extends Error {}

/**
 * Migrate one task object from v1 to v2.
 * @param raw - v1 task.
 * @returns The v2 task (a new object).
 * @throws MigrationError when a one-off task has no `endAt`.
 */
export function migrateTaskV2(raw: Record<string, unknown>): Record<string, unknown> {
  const task = { ...raw }
  delete task['dueDate']

  const kind = task['kind']
  const onceRaw = task['once']
  if (kind === 'once') {
    if (onceRaw === null || typeof onceRaw !== 'object' || Array.isArray(onceRaw)) {
      throw new MigrationError(`one-off task ${String(task['id'])} has no once window`)
    }
    const once = { ...(onceRaw as Record<string, unknown>) }
    const startAt = once['startAt']
    const endAt = once['endAt']
    if (typeof startAt !== 'string' || startAt === '') {
      // v1 always stored startAt explicitly; a missing value cannot be repaired.
      throw new MigrationError(`one-off task ${String(task['id'])} has no once.startAt`)
    }
    if (typeof endAt !== 'string' || endAt === '') {
      throw new MigrationError(`one-off task ${String(task['id'])} has no once.endAt`)
    }
    once['startAtSource'] = once['startAtSource'] === 'created' ? 'created' : 'explicit'
    if (typeof once['timeZone'] !== 'string' || once['timeZone'] === '') once['timeZone'] = 'Asia/Shanghai'
    task['once'] = once
  }

  const notifyRaw = task['notify']
  const notify = notifyRaw !== null && typeof notifyRaw === 'object' && !Array.isArray(notifyRaw)
    ? { ...(notifyRaw as Record<string, unknown>) }
    : {}
  if (notify['endReminder'] === undefined) notify['endReminder'] = true
  task['notify'] = notify

  const stateRaw = task['state']
  const state = stateRaw !== null && typeof stateRaw === 'object' && !Array.isArray(stateRaw)
    ? { ...(stateRaw as Record<string, unknown>) }
    : {}
  for (const flag of ['firedStart', 'firedEnd', 'firedStartAdvance', 'firedEndAdvance', 'missedStart', 'missedEnd']) {
    if (state[flag] === undefined) state[flag] = false
  }
  if (state['lastFiredAt'] === undefined) state['lastFiredAt'] = null
  if (state['lastOccurrenceKey'] === undefined) state['lastOccurrenceKey'] = null
  if (state['missedAt'] === undefined) state['missedAt'] = null
  if (state['missedCount'] === undefined) state['missedCount'] = 0
  if (state['snoozeUntil'] === undefined) state['snoozeUntil'] = null
  if (state['completedOccurrenceKey'] === undefined) state['completedOccurrenceKey'] = null
  // A one-off task created from `createdAt` never announced its start.
  if (kind === 'once' && (task['once'] as Record<string, unknown>)['startAtSource'] === 'created') {
    state['firedStart'] = true
  }
  task['state'] = state

  return task
}

/**
 * Migrate a whole document (main file or archive quarter file) from v1 to v2.
 * @param raw - v1 document.
 * @returns The v2 document.
 * @throws MigrationError when any task cannot be migrated safely.
 */
export function migrateDocumentV2(raw: Record<string, unknown>): Record<string, unknown> {
  const document: Record<string, unknown> = { ...raw, schemaVersion: 2 }
  const tasksRaw = document['tasks']
  if (!Array.isArray(tasksRaw)) return document
  const tasks: Record<string, unknown>[] = []
  for (const candidate of tasksRaw) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new MigrationError('task entry is not an object')
    }
    tasks.push(migrateTaskV2(candidate as Record<string, unknown>))
  }
  document['tasks'] = tasks
  return document
}

/**
 * Migrate `archive/index.json`: only the version bumps, entries stay identical.
 * @param raw - v1 index document.
 * @returns The v2 index document.
 */
export function migrateIndexV2(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, schemaVersion: 2 }
}
