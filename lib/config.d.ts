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
    tickIntervalMs: number;
    /** Default IANA zone for new tasks; also the zone used for `health` fields. */
    timeZone: string;
    /** Grace window in minutes for late occurrences (D-06). */
    graceMinutes: number;
    /** Channels every new task starts with; `overlay` is always present. */
    defaultChannels: ('overlay' | 'system')[];
    /** Hard cap on retained delivery records. */
    deliveriesRetention: number;
}
/** Result of normalization: the config plus any fallbacks that were applied. */
export interface NormalizedConfig {
    config: PluginConfig;
    warnings: string[];
}
/** Documented defaults. */
export declare const DEFAULT_CONFIG: PluginConfig;
/**
 * Normalize one untrusted loader-row config.
 * @param raw - Whatever the Loader passed as `config`.
 * @returns Effective config plus human-readable fallback warnings.
 */
export declare function normalizeConfig(raw: unknown): NormalizedConfig;
