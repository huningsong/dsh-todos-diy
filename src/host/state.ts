/**
 * Persisted state shape and its (de)serialization/validation.
 *
 * `schemaVersion` is the migration pivot (§7.7.2): a file below the current
 * version is upgraded through `migrations.ts`; a file **above** it must never be
 * overwritten — the plugin is then too old to understand the data and has to be
 * upgraded. Validation is strict enough to catch hand-edited corruption but
 * tolerant enough that one bad task does not destroy a user's whole list: a
 * malformed task is dropped with a warning, and the file is only treated as
 * corrupt when the envelope itself is unusable.
 */

import type { Task, TaskStatus } from './rules/types.js'
import { parseCron } from './rules/cron.js'

/** Current on-disk schema version. Bump together with a migration. */
export const SCHEMA_VERSION = 2

/** One record of the delivery log (F5.5 / D-16). */
export interface DeliveryRecord {
  occurrenceKey: string
  channel: 'overlay' | 'system'
  status: 'ok' | 'failed' | 'skipped'
  at: string
  readAt: string | null
  ignoredAt: string | null
  dismissedAt: string | null
  error: string | null
}

/** Do-not-disturb settings (F5.6 / F9.2). */
export interface DndSettings {
  enabled: boolean
  start: string
  end: string
  weekdaysOnly: boolean
}

/** User-visible settings persisted alongside the tasks (§7.4). */
export interface Settings {
  timeZone: string
  tickIntervalMs: number
  graceMinutes: number
  defaultChannels: ('overlay' | 'system')[]
  dnd: DndSettings
  retentionDays: number
}

/** Facts about a corrupt/lost file that the UI must surface (F6.7). */
export interface RecoveryRecord {
  at: string
  reason: 'corrupt' | 'unsupported-version' | 'migration-failed' | 'missing'
  message: string
  backupFile: string | null
}

/** Envelope metadata. */
export interface StateMeta {
  createdAt: string
  updatedAt: string
  lastTickAt: string | null
  lastRecovery: RecoveryRecord | null
}

/** The whole persisted document. */
export interface PersistedState {
  schemaVersion: number
  meta: StateMeta
  settings: Settings
  tasks: Task[]
  deliveries: DeliveryRecord[]
}

/** Why a loaded state was rejected, when it was. */
export type LoadProblem =
  | { kind: 'ok' }
  | { kind: 'missing' }
  | { kind: 'corrupt'; message: string }
  | { kind: 'unsupported-version'; found: number }
  | { kind: 'migration-failed'; message: string }

/** Result of parsing one candidate document. */
export interface ParseResult {
  problem: LoadProblem
  state: PersistedState | null
  warnings: string[]
}

/** Default settings for a fresh install. */
export function defaultSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    timeZone: overrides.timeZone ?? 'Asia/Shanghai',
    tickIntervalMs: overrides.tickIntervalMs ?? 60_000,
    graceMinutes: overrides.graceMinutes ?? 5,
    defaultChannels: overrides.defaultChannels ?? ['overlay'],
    dnd: overrides.dnd ?? { enabled: false, start: '22:00', end: '08:00', weekdaysOnly: false },
    retentionDays: overrides.retentionDays ?? 90,
  }
}

/**
 * Create an empty document.
 * @param now - Creation instant (injected so tests are deterministic).
 * @param settings - Settings to seed.
 * @returns A valid empty state at the current schema version.
 */
export function emptyState(now: Date, settings: Settings = defaultSettings()): PersistedState {
  const iso = now.toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: iso, updatedAt: iso, lastTickAt: null, lastRecovery: null },
    settings,
    tasks: [],
    deliveries: [],
  }
}

/** Whether a value is a plain object (not an array, not null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a string or fall back. */
function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/** Read a nullable ISO string; anything unparseable becomes null. */
function nullableIso(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/**
 * Coerce a stored document into a `PersistedState`, dropping invalid tasks.
 *
 * Returns a `corrupt` problem only when the envelope itself is unusable; a
 * document with a few bad tasks loads with warnings instead.
 * @param raw - Parsed JSON value.
 * @returns Parse outcome.
 */
export function coerceState(raw: unknown): ParseResult {
  const warnings: string[] = []
  if (!isRecord(raw)) {
    return { problem: { kind: 'corrupt', message: 'root is not an object' }, state: null, warnings }
  }
  const version = raw['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { problem: { kind: 'corrupt', message: 'schemaVersion is missing or not an integer' }, state: null, warnings }
  }
  if (version > SCHEMA_VERSION) {
    return { problem: { kind: 'unsupported-version', found: version }, state: null, warnings }
  }
  if (version < SCHEMA_VERSION) {
    // Caller runs migrations; signal it through a dedicated problem kind.
    return { problem: { kind: 'migration-failed', message: `needs migration from ${String(version)}` }, state: null, warnings }
  }

  const meta = isRecord(raw['meta']) ? raw['meta'] : {}
  const settingsRaw = isRecord(raw['settings']) ? raw['settings'] : {}
  const tasksRaw = Array.isArray(raw['tasks']) ? raw['tasks'] : []
  const deliveriesRaw = Array.isArray(raw['deliveries']) ? raw['deliveries'] : []

  if (!Array.isArray(raw['tasks'])) warnings.push('tasks is not an array; starting with an empty list')
  if (!Array.isArray(raw['deliveries'])) warnings.push('deliveries is not an array; starting with an empty log')

  const tasks: Task[] = []
  for (const [index, candidate] of tasksRaw.entries()) {
    const task = coerceTask(candidate)
    if (task === null) {
      warnings.push(`task #${String(index)} is malformed and was skipped`)
      continue
    }
    tasks.push(task)
  }

  const deliveries: DeliveryRecord[] = []
  for (const candidate of deliveriesRaw) {
    const record = coerceDelivery(candidate)
    if (record !== null) deliveries.push(record)
  }

  const nowIso = new Date(0).toISOString()
  const state: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      createdAt: nullableIso(meta['createdAt']) ?? nowIso,
      updatedAt: nullableIso(meta['updatedAt']) ?? nowIso,
      lastTickAt: nullableIso(meta['lastTickAt']),
      lastRecovery: coerceRecovery(meta['lastRecovery']),
    },
    settings: coerceSettings(settingsRaw),
    tasks,
    deliveries,
  }
  return { problem: { kind: 'ok' }, state, warnings }
}

/**
 * Coerce one stored task. Unknown fields are dropped; a task without an id,
 * title or a valid kind/status is rejected.
 * @param raw - Candidate task.
 * @returns A valid task, or null.
 */
export function coerceTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null
  const id = raw['id']
  const title = raw['title']
  if (typeof id !== 'string' || id.trim() === '') return null
  if (typeof title !== 'string' || title.trim() === '') return null
  const kind = raw['kind']
  if (kind !== 'recurring' && kind !== 'once') return null
  const statusRaw = raw['status']
  if (statusRaw !== 'active' && statusRaw !== 'paused' && statusRaw !== 'done' && statusRaw !== 'archived') return null
  let status: TaskStatus = statusRaw
  // F1.2: a recurring task can never be `done`; a hand-edited or imported file
  // must not be able to introduce that state. Clear the completion markers too,
  // otherwise an "active" task would still carry doneAt/pinned.
  const wasRecurringDone = kind === 'recurring' && status === 'done'
  if (wasRecurringDone) status = 'active'

  const rule = isRecord(raw['rule']) ? coerceRule(raw['rule']) : null
  const once = isRecord(raw['once']) ? coerceOnce(raw['once']) : null
  if (kind === 'recurring' && rule === null) return null
  if (kind === 'once' && once === null) return null

  const notify = isRecord(raw['notify']) ? raw['notify'] : {}
  const channelsRaw = Array.isArray(notify['channels']) ? notify['channels'] : ['overlay']
  const channels = channelsRaw.filter(
    (channel): channel is 'overlay' | 'system' => channel === 'overlay' || channel === 'system',
  )
  if (!channels.includes('overlay')) channels.unshift('overlay')

  const stateRaw = isRecord(raw['state']) ? raw['state'] : {}
  const advance = Number(notify['advanceMinutes'])
  const advanceMinutes = Number.isFinite(advance) ? Math.min(1440, Math.max(0, Math.trunc(advance))) : 0

  return {
    id,
    title: title.slice(0, 200),
    description: str(raw['description'], '').slice(0, 2000),
    kind,
    status,
    // F4.15: a completed task never keeps its pin, and a recurring task has no
    // completion at all.
    pinned: wasRecurringDone ? false : raw['pinned'] === true,
    doneAt: wasRecurringDone ? null : nullableIso(raw['doneAt']),
    archivedQuarter: typeof raw['archivedQuarter'] === 'string' ? raw['archivedQuarter'] : null,
    rule,
    once,
    notify: {
      channels,
      template: typeof notify['template'] === 'string' && notify['template'].trim() !== ''
        ? notify['template'].slice(0, 1000)
        : '{title}｜{time}\n{note}',
      advanceMinutes,
      sound: notify['sound'] === true,
      endReminder: notify['endReminder'] !== false,
    },
    state: {
      lastFiredAt: nullableIso(stateRaw['lastFiredAt']),
      lastOccurrenceKey: typeof stateRaw['lastOccurrenceKey'] === 'string' ? stateRaw['lastOccurrenceKey'] : null,
      firedStart: stateRaw['firedStart'] === true,
      firedEnd: stateRaw['firedEnd'] === true,
      firedStartAdvance: stateRaw['firedStartAdvance'] === true,
      firedEndAdvance: stateRaw['firedEndAdvance'] === true,
      missedStart: stateRaw['missedStart'] === true,
      missedEnd: stateRaw['missedEnd'] === true,
      missedAt: nullableIso(stateRaw['missedAt']),
      missedCount: Number.isFinite(Number(stateRaw['missedCount'])) ? Math.max(0, Math.trunc(Number(stateRaw['missedCount']))) : 0,
      snoozeUntil: nullableIso(stateRaw['snoozeUntil']),
      completedOccurrenceKey:
        typeof stateRaw['completedOccurrenceKey'] === 'string' ? stateRaw['completedOccurrenceKey'] : null,
    },
    revision: Number.isFinite(Number(raw['revision'])) ? Math.max(1, Math.trunc(Number(raw['revision']))) : 1,
    createdAt: nullableIso(raw['createdAt']) ?? new Date(0).toISOString(),
    updatedAt: nullableIso(raw['updatedAt']) ?? new Date(0).toISOString(),
  }
}

/**
 * Coerce a stored rule.
 * @param raw - Candidate rule.
 * @returns Rule, or null when the cron/preset is unusable.
 */
function coerceRule(raw: Record<string, unknown>): Task['rule'] {
  const preset = raw['preset']
  if (preset !== 'workdays' && preset !== 'weekly' && preset !== 'monthly' && preset !== 'custom') return null
  const cron = raw['cron']
  if (typeof cron !== 'string') return null
  // F6.2/F6.7: a hand-edited or imported rule must not be able to crash the
  // read path. An unparseable cron drops the task instead of poisoning
  // `/snapshot`.
  try {
    parseCron(cron)
  } catch {
    return null
  }
  const timeZone = raw['timeZone']
  if (typeof timeZone !== 'string' || !isKnownZone(timeZone)) return null
  const holidayCalendar = raw['holidayCalendar'] === 'none' ? 'none' : 'CN'
  const monthlyOverflow = raw['monthlyOverflow'] === 'skip' ? 'skip' : 'lastDay'
  return {
    preset,
    cron,
    timeZone,
    skipDates: coerceDateList(raw['skipDates']),
    extraWorkdays: coerceDateList(raw['extraWorkdays']),
    holidayCalendar,
    monthlyOverflow,
  }
}

/**
 * Coerce a stored one-off window.
 * @param raw - Candidate window.
 * @returns Window, or null when either bound is not a valid instant.
 */
function coerceOnce(raw: Record<string, unknown>): Task['once'] {
  const start = nullableIso(raw['startAt'])
  const end = nullableIso(raw['endAt'])
  if (start === null || end === null) return null
  if (Date.parse(end) <= Date.parse(start)) return null
  const timeZone = typeof raw['timeZone'] === 'string' && raw['timeZone'].trim() !== '' ? raw['timeZone'] : 'Asia/Shanghai'
  if (!isKnownZone(timeZone)) return null
  // A persisted window always carries the origin flag; a file that predates it
  // can only have come from an explicit user entry (v1 required startAt).
  const startAtSource = raw['startAtSource'] === 'created' ? 'created' : 'explicit'
  return { startAt: start, endAt: end, startAtSource, timeZone }
}

/** Coerce a `YYYY-MM-DD` list: invalid entries dropped, de-duplicated, sorted. */
function coerceDateList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const set = new Set<string>()
  for (const entry of value) {
    if (typeof entry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry)) set.add(entry)
  }
  return [...set].sort()
}

/**
 * Coerce the settings block.
 * @param raw - Candidate settings.
 * @returns Always-valid settings with documented defaults.
 */
export function coerceSettings(raw: Record<string, unknown>): Settings {
  const dndRaw = isRecord(raw['dnd']) ? raw['dnd'] : {}
  const channelsRaw = Array.isArray(raw['defaultChannels']) ? raw['defaultChannels'] : ['overlay']
  const channels = channelsRaw.filter(
    (channel): channel is 'overlay' | 'system' => channel === 'overlay' || channel === 'system',
  )
  if (!channels.includes('overlay')) channels.unshift('overlay')
  return {
    timeZone: isKnownZone(str(raw['timeZone'], 'Asia/Shanghai')) ? str(raw['timeZone'], 'Asia/Shanghai') : 'Asia/Shanghai',
    tickIntervalMs: clampInt(raw['tickIntervalMs'], 30_000, 300_000, 60_000),
    graceMinutes: clampInt(raw['graceMinutes'], 0, 60, 5),
    defaultChannels: [...new Set(channels)],
    dnd: {
      enabled: dndRaw['enabled'] === true,
      start: typeof dndRaw['start'] === 'string' ? dndRaw['start'] : '22:00',
      end: typeof dndRaw['end'] === 'string' ? dndRaw['end'] : '08:00',
      weekdaysOnly: dndRaw['weekdaysOnly'] === true,
    },
    retentionDays: clampInt(raw['retentionDays'], 1, 3650, 90),
  }
}

/** Clamp a candidate integer into `[min, max]`, falling back when unusable. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/** Coerce a delivery record; invalid entries are dropped silently. */
function coerceDelivery(raw: unknown): DeliveryRecord | null {
  if (!isRecord(raw)) return null
  const key = raw['occurrenceKey']
  const channel = raw['channel']
  const status = raw['status']
  const at = nullableIso(raw['at'])
  if (typeof key !== 'string' || at === null) return null
  if (channel !== 'overlay' && channel !== 'system') return null
  if (status !== 'ok' && status !== 'failed' && status !== 'skipped') return null
  return {
    occurrenceKey: key,
    channel,
    status,
    at,
    readAt: nullableIso(raw['readAt']),
    ignoredAt: nullableIso(raw['ignoredAt']),
    dismissedAt: nullableIso(raw['dismissedAt']),
    error: typeof raw['error'] === 'string' ? raw['error'] : null,
  }
}

/** Coerce a recovery record. */
function coerceRecovery(raw: unknown): RecoveryRecord | null {
  if (!isRecord(raw)) return null
  const reason = raw['reason']
  if (reason !== 'corrupt' && reason !== 'unsupported-version' && reason !== 'migration-failed' && reason !== 'missing') {
    return null
  }
  return {
    at: nullableIso(raw['at']) ?? new Date(0).toISOString(),
    reason,
    message: str(raw['message'], ''),
    backupFile: typeof raw['backupFile'] === 'string' ? raw['backupFile'] : null,
  }
}

/**
 * Whether a string is a resolvable IANA zone.
 * @param zone - Candidate.
 * @returns True when `Intl` accepts it.
 */
function isKnownZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
