/**
 * Settings coercion (F9.1–F9.3 / F6.2).
 *
 * Split from `state.ts` to stay inside the NF5 line budget. A settings block
 * comes from a hand-editable file, so every field is clamped or defaulted —
 * a bad zone in particular would break the whole scheduler.
 */
import type { Settings } from './state.js';
/**
 * Coerce the settings block.
 * @param raw - Candidate settings.
 * @returns Always-valid settings with documented defaults.
 */
export declare function coerceSettings(raw: Record<string, unknown>): Settings;
/**
 * Whether a string is a resolvable IANA zone.
 * @param zone - Candidate.
 * @returns True when `Intl` accepts it.
 */
export declare function isKnownZone(zone: string): boolean;
