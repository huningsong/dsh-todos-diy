/**
 * `schemaVersion` migration chain (F6.8 / F9.5).
 *
 * Every migration is a pure function from one document shape to the next, so
 * the chain is unit-testable without touching the filesystem. The runner
 * refuses to run on a version it does not know: a *newer* file must never be
 * "migrated" downwards.
 */

import { SCHEMA_VERSION, type PersistedState } from './state.js'
import { migrateDocumentV2, migrateIndexV2 } from './migrationV2.js'
import { migrateDocumentV3 } from './migrationV3.js'

/** One upgrade step: from `from` to `from + 1`. */
export interface Migration {
  from: number
  /** Short description used in logs and in the failure message. */
  describe: string
  /**
   * Upgrade one document.
   * @param raw - Document at version `from`.
   * @returns Document at version `from + 1`.
   */
  run(raw: Record<string, unknown>, warnings: string[]): Record<string, unknown>
}

/**
 * Registered migrations, ascending.
 *
 * v1 → v2 is the D-25 model change: drop `dueDate`, add `startAtSource` and
 * `endReminder`, and fill in the extended `TaskState`.
 * v2 → v3 adds the `completionEvents` log used by weekly/monthly reports.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    describe: 'v1→v2: D-25 task time and status model',
    run: (raw, warnings) => migrateDocumentV2(raw, warnings),
  },
  {
    from: 2,
    describe: 'v2→v3: completion-event log (F11.2)',
    run: (raw, warnings) => migrateDocumentV3(raw, warnings),
  },
]

/** Result of running the chain. */
export type MigrateResult =
  | { ok: true; state: Record<string, unknown>; applied: string[]; warnings: string[] }
  | { ok: false; message: string; warnings: string[] }

/**
 * Run every migration from the document's version up to `SCHEMA_VERSION`.
 *
 * Never throws: a failing step returns `ok: false`, and the caller keeps the
 * original file untouched (F9.5 "迁移失败不覆盖原文件").
 * @param raw - Parsed document with a numeric `schemaVersion`.
 * @param chain - Migration list (injectable for tests).
 * @param target - Target version (defaults to the shipped schema version).
 * @returns Migrated document, or a failure message.
 */
export function migrateState(
  raw: Record<string, unknown>,
  chain: readonly Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrateResult {
  const start = raw['schemaVersion']
  const warnings: string[] = []
  if (typeof start !== 'number' || !Number.isInteger(start)) {
    return { ok: false, message: 'schemaVersion is missing or not an integer', warnings }
  }
  if (start > target) {
    return { ok: false, message: `document version ${String(start)} is newer than this plugin (${String(target)})`, warnings }
  }
  const applied: string[] = []
  let current = raw
  let version = start
  while (version < target) {
    const step = chain.find((migration) => migration.from === version)
    if (step === undefined) {
      return { ok: false, message: `no migration registered from version ${String(version)}`, warnings }
    }
    try {
      current = step.run(current, warnings)
    } catch (error) {
      return { ok: false, message: `migration from ${String(version)} failed: ${String(error)}`, warnings }
    }
    const next = current['schemaVersion']
    if (next !== version + 1) {
      return {
        ok: false,
        message: `migration from ${String(version)} did not advance schemaVersion (got ${String(next)})`,
        warnings,
      }
    }
    applied.push(step.describe)
    version += 1
  }
  return { ok: true, state: current, applied, warnings }
}

/**
 * Whether this build can read a document at all.
 * @param version - `schemaVersion` found in the file.
 * @returns True when the version is known (equal or older than current).
 */
export function isKnownVersion(version: number): boolean {
  return Number.isInteger(version) && version >= 1 && version <= SCHEMA_VERSION
}

/** Re-export for callers that only need the constant. */
export type { PersistedState }
