/**
 * Loader-row configuration: defaults, normalization and validation.
 *
 * The keys here are the ones a user may override in `cordis.patch.yml`. An
 * invalid value never fails activation — it falls back to the documented
 * default and is reported in `health.config.warnings`, because a typo in a
 * config file must not take the whole reminder system offline.
 */

/** Effective plugin configuration after normalization. */
export interface PluginConfig {
  /** Scheduler poll interval; §11 allows 30 s – 300 s, default 60 s. */
  tickIntervalMs: number
  /** Default IANA zone for new tasks; also the zone used for `health` fields. */
  timeZone: string
  /** Grace window in minutes for late occurrences (D-06). */
  graceMinutes: number
  /** Channels every new task starts with; `overlay` is always present. */
  defaultChannels: ('overlay' | 'system')[]
  /** Hard cap on retained delivery records. */
  deliveriesRetention: number
}

/** Result of normalization: the config plus any fallbacks that were applied. */
export interface NormalizedConfig {
  config: PluginConfig
  warnings: string[]
}

const MIN_TICK_MS = 30_000
const MAX_TICK_MS = 300_000

/** Documented defaults. */
export const DEFAULT_CONFIG: PluginConfig = {
  tickIntervalMs: 60_000,
  timeZone: 'Asia/Shanghai',
  graceMinutes: 5,
  defaultChannels: ['overlay'],
  deliveriesRetention: 1000,
}

/**
 * Normalize one untrusted loader-row config.
 * @param raw - Whatever the Loader passed as `config`.
 * @returns Effective config plus human-readable fallback warnings.
 */
export function normalizeConfig(raw: unknown): NormalizedConfig {
  const warnings: string[] = []
  const input = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const tickIntervalMs = readInt(input['tickIntervalMs'], MIN_TICK_MS, MAX_TICK_MS, DEFAULT_CONFIG.tickIntervalMs, 'tickIntervalMs', warnings)
  const graceMinutes = readInt(input['graceMinutes'], 0, 60, DEFAULT_CONFIG.graceMinutes, 'graceMinutes', warnings)
  const deliveriesRetention = readInt(
    input['deliveriesRetention'],
    100,
    100_000,
    DEFAULT_CONFIG.deliveriesRetention,
    'deliveriesRetention',
    warnings,
  )

  let timeZone = DEFAULT_CONFIG.timeZone
  if (input['timeZone'] !== undefined) {
    if (typeof input['timeZone'] === 'string' && isResolvableZone(input['timeZone'])) {
      timeZone = input['timeZone']
    } else {
      warnings.push(`timeZone ${JSON.stringify(input['timeZone'])} is not a resolvable IANA zone; using ${DEFAULT_CONFIG.timeZone}`)
    }
  }

  let defaultChannels: ('overlay' | 'system')[] = [...DEFAULT_CONFIG.defaultChannels]
  const rawChannels = input['defaultChannels']
  if (rawChannels !== undefined) {
    if (Array.isArray(rawChannels)) {
      const channels = rawChannels.filter(
        (channel): channel is 'overlay' | 'system' => channel === 'overlay' || channel === 'system',
      )
      defaultChannels = channels.includes('overlay') ? [...new Set(channels)] : ['overlay', ...new Set(channels)]
    } else {
      warnings.push('defaultChannels must be an array; using ["overlay"]')
    }
  }

  return {
    config: { tickIntervalMs, timeZone, graceMinutes, defaultChannels, deliveriesRetention },
    warnings,
  }
}

/**
 * Read a bounded integer, falling back to the default and warning on failure.
 * @param value - Candidate value.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 * @param fallback - Value used when the candidate is not usable.
 * @param field - Field name for the warning text.
 * @param warnings - Collector for fallback messages.
 * @returns A valid integer.
 */
function readInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
  warnings: string[],
): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    warnings.push(`${field} must be a number; using ${fallback}`)
    return fallback
  }
  const rounded = Math.round(parsed)
  if (rounded < min || rounded > max) {
    warnings.push(`${field} ${rounded} is outside ${min}-${max}; using ${fallback}`)
    return fallback
  }
  return rounded
}

/** Whether `Intl` can resolve the zone. */
function isResolvableZone(timeZone: string): boolean {
  try {
    // Constructing a formatter validates the identifier on every supported line.
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}
