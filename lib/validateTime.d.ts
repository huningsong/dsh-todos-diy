/**
 * Instant and one-off-window validation.
 *
 * Split from `validate.ts` to stay inside the NF5 line budget. Pure: the only
 * time-zone lookup is `Intl`, and "now" is never read here.
 */
import type { OnceWindow } from './rules/types.js';
/**
 * Validate a one-off window for the D-25 model.
 *
 * - `startAt` is **optional**: when omitted it defaults to the task's
 *   `createdAt` and `startAtSource="created"` (no `#start` reminder);
 * - `endAt` is mandatory and is the only deadline (F3.2);
 * - a date-only `endAt` means "end of that day" in the task zone
 *   (`23:59:59.999`), so the whole day still counts as in term;
 * - `endReminder=false` requires an explicit `startAt`, otherwise the task
 *   would have no reminder at all (F3.3).
 * @param value - Candidate `{startAt?, endAt}`.
 * @param timeZone - Zone used for offset-less values.
 * @param createdAt - Creation instant, used when `startAt` is omitted.
 * @param endReminder - Task-level "remind at the end" flag (default true).
 * @returns Normalized window in UTC ISO.
 */
export declare function validateOnce(value: unknown, timeZone: string, createdAt?: Date, endReminder?: boolean): OnceWindow;
/**
 * Parse an ISO instant, interpreting an offset-less value in the task zone.
 * @param text - ISO 8601 string.
 * @param timeZone - Task zone.
 * @param field - Field name for errors.
 * @returns Parsed instant.
 */
export declare function parseInstant(text: string, timeZone: string, field: string): Date;
