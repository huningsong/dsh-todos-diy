/**
 * Reminder delivery (F5.1–F5.5, D-02).
 *
 * The persisted `deliveries` array **is** the outbox: one row per
 * `occurrenceKey + channel`, written when the tick claims the occurrence and
 * cleared (via `readAt` / `ignoredAt` / `dismissedAt`) when the user acts. That
 * keeps the "same occurrence + channel delivers at most once" guarantee in the
 * same atomic document as the task state — there is no second store to drift.
 *
 * Two channels only (D-02): `overlay` (always) and `system` (best effort, only
 * while the page is hidden and the browser granted permission). The host never
 * touches a browser API; the client reports what actually happened through
 * `POST /deliveries/report`.
 */

import type { Occurrence, Task } from './rules/types.js'
import type { DeliveryRecord } from './state.js'
import { localDateTimeKey, formatUtcOffset } from './rules/timezone.js'

/** One card the overlay renders (`GET /due`). */
export interface ReminderCard {
  occurrenceKey: string
  taskId: string
  title: string
  description: string
  /** The instant the reminder fires at, UTC ISO. */
  at: string
  /** `start` / `end` / `advance` / null for a plain recurring hit. */
  phase: 'start' | 'end' | 'advance' | null
  /** Local time in the task zone, `YYYY-MM-DDTHH:mm`. */
  localTime: string
  /** `UTC±HH:MM` of the task zone at that instant. */
  utcOffset: string
  timeZone: string
  /** Rendered text from the task template (plain text, no HTML). */
  text: string
  /** Task-level reminder settings echoed so the client can play a sound. */
  sound: boolean
  channels: ('overlay' | 'system')[]
  /** Task status at render time, so the overlay can hide a paused task. */
  status: Task['status']
}

/** Result of one ack. */
export interface AckResult {
  occurrenceKey: string
  action: 'dismiss' | 'complete' | 'snooze'
  changed: boolean
}

/**
 * Fill one template with the four documented variables (UX-10 / F5.4).
 *
 * Plain-text substitution only: the result is rendered as text, never as HTML,
 * so a task title containing `<script>` is harmless. Unknown variables are left
 * verbatim.

 * @param template - Template text.
 * @param values - Variable values.
 * @returns Rendered text.
 */
export function renderTemplate(
  template: string,
  values: { title: string; time: string; note: string; phase: string },
): string {
  return template
    .replaceAll('{title}', values.title)
    .replaceAll('{time}', values.time)
    .replaceAll('{note}', values.note)
    .replaceAll('{phase}', values.phase)
}

/**
 * Human label for one occurrence phase.
 * @param phase - Occurrence phase.
 * @returns Chinese label used in the default template.
 */
export function phaseLabel(phase: Occurrence['phase']): string {
  if (phase === 'start') return '任务开始'
  if (phase === 'end') return '任务结束'
  if (phase === 'advance') return '提前提醒'
  return '提醒'
}

/**
 * Build the reminder card for one fired occurrence.
 * @param task - Owning task.
 * @param occurrence - The occurrence that fired.
 * @returns Card payload for `/due`.
 */
export function buildReminderCard(task: Task, occurrence: Occurrence): ReminderCard {
  const timeZone = task.rule?.timeZone ?? 'Asia/Shanghai'
  const atMs = occurrence.at.getTime()
  const localTime = localDateTimeKey(atMs, timeZone)
  const phase = occurrence.phase
  const text = renderTemplate(task.notify.template, {
    title: task.title,
    time: `${localTime.replace('T', ' ')}（${formatUtcOffset(atMs, timeZone)}）`,
    note: task.description,
    phase: phaseLabel(phase),
  })
  return {
    occurrenceKey: occurrence.key,
    taskId: task.id,
    title: task.title,
    description: task.description,
    at: occurrence.at.toISOString(),
    phase,
    localTime,
    utcOffset: formatUtcOffset(atMs, timeZone),
    timeZone,
    text,
    sound: task.notify.sound,
    channels: task.notify.channels,
    status: task.status,
  }
}

/**
 * Build the `deliveries` rows for one fired occurrence.
 *
 * `overlay` is always recorded as `ok`. A task that also lists `system` gets a
 * `skipped` row with `error: 'page-visible'` as a placeholder; the client
 * replaces it with the real outcome through `/deliveries/report`.
 * @param task - Owning task.
 * @param occurrence - The occurrence that fired.
 * @param now - Delivery instant.
 * @returns One or two records.
 */
export function deliveryRecordsFor(task: Task, occurrence: Occurrence, now: Date): DeliveryRecord[] {
  const stamp = now.toISOString()
  const records: DeliveryRecord[] = [
    {
      occurrenceKey: occurrence.key,
      channel: 'overlay',
      status: 'ok',
      at: stamp,
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    },
  ]
  if (task.notify.channels.includes('system')) {
    records.push({
      occurrenceKey: occurrence.key,
      channel: 'system',
      status: 'skipped',
      at: stamp,
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: 'page-visible',
    })
  }
  return records
}

/**
 * Deliveries that still need the user's attention.
 *
 * A record is pending while it has neither `readAt` nor `ignoredAt` and its
 * bound task is still in a state that can be reminded. There is deliberately
 * **no age limit**: UX-01 says the overlay must not disappear on its own, so an
 * unacknowledged card survives a restart until the user dismisses it.
 * @param records - Persisted delivery log.
 * @param tasks - Current tasks (to resolve titles and status).
 * @param now - Current instant (kept for signature stability).
 * @returns Pending overlay records, newest last.
 */
export function pendingDeliveries(
  records: readonly DeliveryRecord[],
  tasks: readonly Task[],
  now: Date,
): { record: DeliveryRecord; task: Task }[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  void now
  const pending: { record: DeliveryRecord; task: Task }[] = []
  for (const record of records) {
    if (record.channel !== 'overlay') continue
    if (record.status !== 'ok') continue
    if (record.readAt !== null || record.ignoredAt !== null || record.dismissedAt !== null) continue
    if (Number.isNaN(Date.parse(record.at))) continue
    const taskId = record.occurrenceKey.split('@')[0] ?? ''
    const task = byId.get(taskId)
    if (task === undefined) continue
    // D-22: a paused task is deliberately set aside, so its held cards must not
    // keep nagging. A done task is already finished for the same reason.
    if (task.status === 'archived' || task.status === 'paused' || task.status === 'done') continue
    pending.push({ record, task })
  }
  return pending
}

/**
 * Find one delivery row.
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param channel - Optional channel filter.
 * @returns The record, or undefined.
 */
export function findDelivery(
  records: readonly DeliveryRecord[],
  occurrenceKey: string,
  channel?: 'overlay' | 'system',
): DeliveryRecord | undefined {
  return records.find(
    (record) => record.occurrenceKey === occurrenceKey && (channel === undefined || record.channel === channel),
  )
}

/**
 * Apply one acknowledgement to a delivery row, returning a new array.
 *
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param channel - Channel being acknowledged.
 * @param action - User action.
 * @param now - Acknowledgement instant.
 * @returns Updated log plus whether anything changed.
 */
export function acknowledge(
  records: readonly DeliveryRecord[],
  occurrenceKey: string,
  channel: 'overlay' | 'system',
  action: 'dismiss' | 'complete' | 'snooze',
  now: Date,
): { records: DeliveryRecord[]; changed: boolean } {
  const stamp = now.toISOString()
  let changed = false
  const next = records.map((record) => {
    if (record.occurrenceKey !== occurrenceKey || record.channel !== channel) return record
    changed = true
    if (action === 'dismiss') {
      return { ...record, ignoredAt: stamp, readAt: record.readAt ?? stamp, dismissedAt: stamp }
    }
    return { ...record, readAt: record.readAt ?? stamp, dismissedAt: stamp }
  })
  return { records: next, changed }
}

/**
 * Record what really happened on the `system` channel (F5.2/F5.3).
 *
 * The host cannot know whether the browser actually showed a notification, so
 * the client reports it. A failure is recorded as `failed` with the browser's
 * reason (`permission-denied` / `not-supported`), never thrown.
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param outcome - Reported outcome.
 * @param now - Report instant.
 * @returns Updated log plus whether a row was found.
 */
export function reportSystemDelivery(
  records: readonly DeliveryRecord[],
  occurrenceKey: string,
  outcome: { ok: boolean; error?: string | null },
  now: Date,
): { records: DeliveryRecord[]; found: boolean } {
  let found = false
  const stamp = now.toISOString()
  const next = records.map((record) => {
    if (record.occurrenceKey !== occurrenceKey || record.channel !== 'system') return record
    found = true
    return {
      ...record,
      status: outcome.ok ? ('ok' as const) : ('failed' as const),
      at: record.at === '' ? stamp : record.at,
      error: outcome.ok ? null : (outcome.error ?? 'not-supported'),
    }
  })
  return { records: next, found }
}
