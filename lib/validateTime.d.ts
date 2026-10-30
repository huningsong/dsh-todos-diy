/**
 * Instant and one-off-window validation.
 *
 * Split from `validate.ts` to stay inside the NF5 line budget. Pure: the only
 * time-zone lookup is `Intl`, and "now" is never read here.
 */
import type { OnceWindow } from './rules/types.js';
/**
 * Validate a one-off window (both bounds required, end strictly later).
 * @param value - Candidate `{startAt, endAt}`.
 * @param timeZone - Zone used for offset-less values.
 * @returns Normalized window in UTC ISO.
 */
export declare function validateOnce(value: unknown, timeZone: string): OnceWindow;
/**
 * Parse an ISO instant, interpreting an offset-less value in the task zone.
 * @param text - ISO 8601 string.
 * @param timeZone - Task zone.
 * @param field - Field name for errors.
 * @returns Parsed instant.
 */
export declare function parseInstant(text: string, timeZone: string, field: string): Date;
