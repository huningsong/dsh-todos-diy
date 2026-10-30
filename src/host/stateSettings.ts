/**
 * Settings coercion (F9.1–F9.3 / F6.2).
 *
 * Split from `state.ts` to stay inside the NF5 line budget. A settings block
 * comes from a hand-editable file, so every field is clamped or defaulted —
 * a bad zone in particular would break the whole scheduler.
 */

import type { Settings } from './state.js'

/** Whether a value is a plain object (not an array, not null). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a string or fall back. */
function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
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


/**
 * Whether a string is a resolvable IANA zone.
 * @param zone - Candidate.
 * @returns True when `Intl` accepts it.
 */
export function isKnownZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
