/**
 * Client-side transport for `dsh-todos-diy`.
 *
 * All requests are relative to the page origin and carry the browser's
 * HttpOnly DSH session cookie automatically (`credentials: 'same-origin'`), so
 * no token is ever read or stored by this code.
 */

import type { TaskView } from '../../src/host/taskView.js'

/** Base path of the plugin API. */
const BASE = '/api/dsh-todos-diy'

/** The error envelope the host returns (§7.12). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

/** An error carrying the host's machine-readable code. */
export class ApiError extends Error {
  /** Envelope code, e.g. `invalid_cron`. */
  readonly code: string
  /** Optional structured details (field-level for validation errors). */
  readonly details: unknown

  /**
   * @param code - Envelope code.
   * @param message - Server diagnostic.
   * @param details - Optional details.
   */
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

/** The six selectable views (F4.10 / F4.21). */
export type ViewName = 'all' | 'notStarted' | 'inProgress' | 'overdue' | 'done' | 'recurring' | 'paused'

/** Mutually exclusive counts for the six views. */
export interface CountsPayload {
  notStarted: number
  inProgress: number
  overdue: number
  done: number
  paused: number
  recurring: number
}

/** Snapshot payload from `GET /snapshot`. */
export interface SnapshotPayload {
  items: TaskView[]
  nextCursor: string | null
  counts: CountsPayload
  byKind: { once: number; recurring: number }
  totalDone: number
  prioritySummary: { high: number; mid: number; low: number; none: number }
  groupCounts: { pinned: number; high: number; mid: number; low: number; none: number; paused: number }
  serverTime: string
  nextTransitionAt: string | null
  settings: SettingsPayload
}

/** One delivery-log row from `GET /deliveries`. */
export interface DeliveryPayload {
  occurrenceKey: string
  channel: 'overlay' | 'system'
  status: 'ok' | 'failed' | 'skipped'
  at: string
  readAt: string | null
  ignoredAt: string | null
  dismissedAt: string | null
  error: string | null
}

/** Settings payload from `GET /settings/get`. */
export interface SettingsPayload {
  timeZone: string
  tickIntervalMs: number
  graceMinutes: number
  defaultChannels: ('overlay' | 'system')[]
  dnd: { enabled: boolean; start: string; end: string; weekdaysOnly: boolean }
  retentionDays: number
  nlp: { enabled: boolean }
}

/** One report from `GET /reports` (F11). */
export type ReportPayload = import('../../src/host/reports.js').ReportData

/** One parsed draft from `POST /parse` (F10). */
export interface NlpParsePayload {
  draft: Record<string, unknown>
  fieldStatus: Record<string, 'explicit' | 'default' | 'missing'>
  missingRequired: string[]
  unsupported: string[]
  confidence: number
  degraded: boolean
  reason?: string
}

/** One card from `GET /due`. */
export interface ReminderCardPayload {
  occurrenceKey: string
  taskId: string
  title: string
  description: string
  at: string
  phase: 'start' | 'end' | 'advance' | null
  localTime: string
  utcOffset: string
  timeZone: string
  text: string
  sound: boolean
  channels: ('overlay' | 'system')[]
  status: string
}

/** Archive index payload. */
export interface ArchiveIndexPayload {
  quarters: { quarter: string; file: string; count: number; start: string; end: string }[]
}

/** Preview payload. */
export interface PreviewPayload {
  times: string[]
}

/**
 * Perform one request and unwrap the `{ok,value}` envelope.
 * @param path - Path under the plugin API (e.g. `/snapshot`).
 * @param init - Fetch options.
 * @returns The `value` field.
 * @throws ApiError for a non-2xx response or a network failure.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
    })
  } catch (error) {
    throw new ApiError('network_error', error instanceof Error ? error.message : String(error))
  }
  const text = await response.text()
  let parsed: unknown = undefined
  if (text !== '') {
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ApiError('internal_error', 'Server returned a non-JSON response')
    }
  }
  if (!response.ok) {
    const body = parsed as ApiErrorBody | undefined
    const envelope = body?.error
    throw new ApiError(envelope?.code ?? 'internal_error', envelope?.message ?? response.statusText, envelope?.details)
  }
  const envelope = parsed as { ok?: boolean; value?: T } | undefined
  return envelope?.value as T
}

/** Typed view of the plugin API. */
export const api = {
  /** Read one snapshot of the given view. */
  snapshot(view: ViewName, search: string, signal?: AbortSignal, limit?: number, cursor?: string): Promise<SnapshotPayload> {
    const params = new URLSearchParams({ view })
    if (search.trim() !== '') params.set('q', search.trim())
    if (limit !== undefined) params.set('limit', String(limit))
    if (cursor !== undefined) params.set('cursor', cursor)
    return request<SnapshotPayload>(`/snapshot?${params.toString()}`, signal === undefined ? undefined : { signal })
  },
  /** Create one task. */
  create(body: unknown): Promise<TaskView> {
    return request<TaskView>('/tasks/create', { method: 'POST', body: JSON.stringify(body) })
  },
  /** Update one task. */
  update(id: string, expectedRevision: number, patch: unknown): Promise<TaskView> {
    return request<TaskView>('/tasks/update', {
      method: 'POST',
      body: JSON.stringify({ id, expectedRevision, patch }),
    })
  },
  /** Pause a task. */
  pause(id: string): Promise<{ id: string; status: string; changed: boolean }> {
    return request('/tasks/pause', { method: 'POST', body: JSON.stringify({ id }) })
  },
  /** Resume a task. */
  resume(id: string): Promise<{ id: string; status: string; changed: boolean }> {
    return request('/tasks/resume', { method: 'POST', body: JSON.stringify({ id }) })
  },
  /** Complete a task / skip the current occurrence. */
  complete(id: string, occurrenceKey?: string, skipNext?: boolean): Promise<{ id: string; nextAt: string | null }> {
    return request('/tasks/complete', {
      method: 'POST',
      body: JSON.stringify({
        id,
        ...(occurrenceKey === undefined ? {} : { occurrenceKey }),
        ...(skipNext === true ? { skipNext: true } : {}),
      }),
    })
  },
  /** Snooze a task. */
  snooze(id: string, minutes: number): Promise<{ id: string; snoozeUntil: string }> {
    return request('/tasks/snooze', { method: 'POST', body: JSON.stringify({ id, minutes }) })
  },
  /** Pin / unpin a task. */
  pin(id: string, pinned: boolean): Promise<{ id: string; pinned: boolean }> {
    return request('/tasks/pin', { method: 'POST', body: JSON.stringify({ id, pinned }) })
  },
  /** Soft-delete a task. */
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return request('/tasks/delete', { method: 'POST', body: JSON.stringify({ id }) })
  },
  /** Restore a soft-deleted task. */
  restore(id: string): Promise<TaskView> {
    return request<TaskView>('/tasks/restore', { method: 'POST', body: JSON.stringify({ id }) })
  },
  /** Send one immediate reminder without touching the rule (F8.14). */
  remind(id: string): Promise<{ id: string; occurrenceKey: string }> {
    return request('/tasks/remind', { method: 'POST', body: JSON.stringify({ id }) })
  },
  /** Read the delivery/receipt history, optionally for one task. */
  deliveries(taskId?: string, cursor?: string): Promise<{ items: DeliveryPayload[]; nextCursor: string | null; total: number }> {
    const params = new URLSearchParams()
    if (taskId !== undefined) params.set('taskId', taskId)
    if (cursor !== undefined) params.set('cursor', cursor)
    const suffix = params.size > 0 ? `?${params.toString()}` : ''
    return request(`/deliveries${suffix}`)
  },
  /** Preview the next five occurrences of a rule. */
  preview(rule: unknown, timeZone: string): Promise<PreviewPayload> {
    return request<PreviewPayload>('/rules/preview', {
      method: 'POST',
      body: JSON.stringify({ rule, timeZone }),
    })
  },
  /** Read the archive index. */
  archiveIndex(): Promise<ArchiveIndexPayload> {
    return request<ArchiveIndexPayload>('/archive/index')
  },
  /** Read one archived quarter. */
  archive(quarter: string, cursor?: string): Promise<{ items: TaskView[]; nextCursor: string | null; quarter: string }> {
    const params = new URLSearchParams({ quarter })
    if (cursor !== undefined) params.set('cursor', cursor)
    return request(`/archive?${params.toString()}`)
  },
  /** Read settings. */
  settings(): Promise<SettingsPayload> {
    return request<SettingsPayload>('/settings/get')
  },
  /** Update settings. */
  updateSettings(patch: Partial<SettingsPayload>): Promise<SettingsPayload> {
    return request<SettingsPayload>('/settings/update', { method: 'POST', body: JSON.stringify(patch) })
  },
  /** Fetch the weekly/monthly report (F11.3). */
  report(kind: 'weekly' | 'monthly', anchor: string): Promise<ReportPayload> {
    return request<ReportPayload>(`/reports?kind=${kind}&anchor=${anchor}`)
  },
  /** Parse one natural-language sentence into a draft (F10.1). */
  parse(text: string, signal?: AbortSignal): Promise<NlpParsePayload> {
    return request<NlpParsePayload>('/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
      ...(signal === undefined ? {} : { signal }),
    })
  },
  /** Poll pending reminder cards; `dndSummary` merges reminders held by DND. */
  due(): Promise<{
    items: ReminderCardPayload[]
    dndSummary?: { count: number; occurrences: string[]; titles: string[] }
    serverTime: string
  }> {
    return request('/due')
  },
  /** Acknowledge one reminder. */
  ack(
    occurrenceKey: string,
    action: 'dismiss' | 'complete' | 'snooze',
    minutes?: number,
  ): Promise<{ ok: boolean }> {
    return request('/deliveries/ack', {
      method: 'POST',
      body: JSON.stringify({ occurrenceKey, action, channel: 'overlay', ...(minutes === undefined ? {} : { minutes }) }),
    })
  },
  /** Report whether a system notification actually appeared. */
  reportSystem(occurrenceKey: string, ok: boolean, error?: string | null): Promise<{ ok: boolean }> {
    return request('/deliveries/report', {
      method: 'POST',
      body: JSON.stringify({ occurrenceKey, ok, error: error ?? null }),
    })
  },
  /** Download the full export bundle (returns the raw text + filename). */
  async exportData(): Promise<{ text: string; filename: string }> {
    const response = await fetch(`${BASE}/export`, { credentials: 'same-origin' })
    if (!response.ok) throw new ApiError('internal_error', `export failed: ${String(response.status)}`)
    const text = await response.text()
    const disposition = response.headers.get('content-disposition') ?? ''
    const match = /filename="([^"]+)"/.exec(disposition)
    return { text, filename: match?.[1] ?? 'dsh-todos-diy.json' }
  },
  /** Import a bundle in replace or merge mode. */
  importData(payload: unknown, mode: 'replace' | 'merge'): Promise<{ imported: number; skipped: number; backupFile: string | null; warnings: string[] }> {
    return request('/import', { method: 'POST', body: JSON.stringify({ mode, payload }) })
  },
  /** Health payload (used to display scheduler/storage warnings). */
  health(): Promise<{
    scheduler: { running: boolean; lastError: string | null }
    storage: { state: string; healthy: boolean; lastRecovery: unknown }
    capabilities: { systemNotification: boolean | null; agentTools: number }
    readOnly: boolean
  }> {
    return request('/health')
  },
}
