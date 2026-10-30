/**
 * Import / export (F9.4 / AC-25).
 *
 * Export is the whole persisted document plus a wrapper header, so a future
 * schema can still read an old file. Import supports `replace` and `merge`,
 * always backs the current file up first, and validates the payload before it
 * touches memory — a bad file must never destroy the live state.
 */

import { copyFileSync, existsSync, writeFileSync } from 'node:fs'

import { coerceSettings, SCHEMA_VERSION } from './state.js'
import { migrateState } from './migrations.js'
import type { PersistedState, Settings } from './state.js'
import type { Task } from './rules/types.js'
import { coerceTask } from './state.js'
import { coerceCompletionEvent } from './stateRecords.js'

/** One exported bundle. */
export interface ExportBundle {
  kind: 'dsh-todos-diy/export'
  exportedAt: string
  schemaVersion: number
  settings: Settings
  tasks: Task[]
  deliveries: PersistedState['deliveries']
  completionEvents: PersistedState['completionEvents']
}

/** Result of an import. */
export interface ImportResult {
  imported: number
  skipped: number
  backupFile: string | null
  mode: 'replace' | 'merge'
  warnings: string[]
}

/**
 * Build the export payload.
 * @param state - Live document.
 * @param now - Export instant.
 * @returns Serializable bundle.
 */
export function buildExport(state: PersistedState, now: Date): ExportBundle {
  return {
    kind: 'dsh-todos-diy/export',
    exportedAt: now.toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: state.settings,
    tasks: state.tasks,
    deliveries: state.deliveries.slice(-1000),
    completionEvents: state.completionEvents,
  }
}

/**
 * Take a timestamped backup next to the live file.
 * @param stateFile - Absolute path of `tasks.json`.
 * @param now - Backup instant.
 * @returns The backup path, or null when there was nothing to copy.
 */
export function backupBeforeImport(stateFile: string, now: Date): string | null {
  if (!existsSync(stateFile)) return null
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const target = `${stateFile}.bak.${stamp}`
  copyFileSync(stateFile, target)
  return target
}

/** A validated import candidate. */
export interface ImportCandidate {
  tasks: Task[]
  settings: Settings | null
  deliveries: PersistedState['deliveries']
  completionEvents: PersistedState['completionEvents']
  warnings: string[]
  /** Number of structurally invalid task entries that were skipped. */
  skipped: number
}

/**
 * Validate an import payload before anything is mutated.
 *
 * Accepts both the export wrapper and a bare `tasks.json` document; unknown
 * envelope versions are refused with `schema_mismatch`.
 * @param payload - Parsed JSON value.
 * @returns Validated tasks/settings, or a thrown error code.
 */
export function parseImport(payload: unknown): ImportCandidate {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('import payload must be a JSON object'), { code: 'invalid_argument' })
  }
  const record = payload as Record<string, unknown>
  const version = record['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw Object.assign(new Error('import payload has no integer schemaVersion'), { code: 'schema_mismatch' })
  }
  if (version > SCHEMA_VERSION) {
    throw Object.assign(new Error(`import schemaVersion ${String(version)} is newer than this plugin`), {
      code: 'schema_mismatch',
    })
  }
  // F9.5 / AC-41: import shares the same 1→2 migration as the on-disk files.
  // A v1 bundle that cannot be migrated fails the import instead of silently
  // dropping fields; nothing is written because the caller bails out first.
  let document = record
  const warnings: string[] = []
  if (version < SCHEMA_VERSION) {
    const migrated = migrateState(record)
    if (!migrated.ok) {
      throw Object.assign(new Error(`import migration failed: ${migrated.message}`), { code: 'migration-failed' })
    }
    document = migrated.state
    warnings.push(...migrated.warnings)
  }
  const rawTasks = document['tasks']
  if (!Array.isArray(rawTasks)) {
    throw Object.assign(new Error('import payload has no tasks array'), { code: 'schema_mismatch' })
  }
  const tasks: Task[] = []
  let skipped = 0
  for (const [index, candidate] of rawTasks.entries()) {
    // F3.4/F6.2: `fired` is derived, never imported. Say so instead of silently
    // dropping the field.
    if (candidate !== null && typeof candidate === 'object' && Object.hasOwn(candidate as object, 'fired')) {
      warnings.push(`task #${String(index)}: ignored read-only field "fired"`)
    }
    const task = coerceTask(candidate)
    if (task === null) {
      skipped += 1
      warnings.push(`task #${String(index)} is malformed and was skipped`)
      continue
    }
    tasks.push(task)
  }
  // F9.4/F6.2: settings from a file are untrusted. Run them through the same
  // coercion the store uses, so a bad zone cannot poison the tick loop.
  const settingsRaw = document['settings']
  let settings: Settings | null = null
  if (settingsRaw !== null && typeof settingsRaw === 'object') {
    const before = JSON.stringify(settingsRaw)
    settings = coerceSettings(settingsRaw as Record<string, unknown>)
    if (JSON.stringify(settings) !== before) warnings.push('settings were normalized; invalid values were replaced')
  }
  const deliveriesRaw = document['deliveries']
  const deliveries = Array.isArray(deliveriesRaw) ? (deliveriesRaw as PersistedState['deliveries']) : []
  const eventsRaw = document['completionEvents']
  const completionEvents: PersistedState['completionEvents'] = []
  if (Array.isArray(eventsRaw)) {
    for (const candidate of eventsRaw) {
      const event = coerceCompletionEvent(candidate)
      if (event === null) {
        warnings.push('completion event skipped: malformed entry')
        continue
      }
      completionEvents.push(event)
    }
  }
  if (skipped > 0) warnings.push(`${String(skipped)} task(s) skipped`)
  const uniqueEvents = new Map(completionEvents.map((event) => [event.id, event]))
  return {
    tasks,
    settings,
    deliveries,
    completionEvents: [...uniqueEvents.values()].slice(-5000),
    warnings,
    skipped,
  }
}

/**
 * Merge imported tasks into the live document by id.
 * @param current - Live tasks.
 * @param incoming - Imported tasks.
 * @returns Merged list and the number actually added.
 */
export function mergeTasks(current: readonly Task[], incoming: readonly Task[]): { tasks: Task[]; added: number } {
  const byId = new Map(current.map((task) => [task.id, task]))
  let added = 0
  for (const task of incoming) {
    if (byId.has(task.id)) continue
    byId.set(task.id, task)
    added += 1
  }
  return { tasks: [...byId.values()], added }
}

/**
 * Write a settings-only export (F9.6).
 * @param settings - Current settings.
 * @param now - Export instant.
 * @returns Pretty JSON text.
 */
export function settingsExport(settings: Settings, now: Date): string {
  return `${JSON.stringify({ kind: 'dsh-todos-diy/settings', exportedAt: now.toISOString(), settings }, null, 2)}\n`
}

/** Write text to a path (thin wrapper so tests can spy). */
export function writeText(path: string, content: string): void {
  writeFileSync(path, content, 'utf8')
}
