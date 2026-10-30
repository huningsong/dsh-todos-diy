/**
 * Validation of user-supplied task input (§7.4 field constraints).
 *
 * Pure: no IO, no clock. Every error carries the §7.12 code the API and the
 * agent tools return, so the two callers cannot drift apart (F7.11).
 */
import type { Channel, RecurrenceRule } from './rules/types.js';
export { ValidationError, type ErrorCode } from './validationError.js';
export { validateOnce, parseInstant } from './validateTime.js';
/** Limits from §7.4. */
export declare const LIMITS: {
    readonly titleMin: 1;
    readonly titleMax: 200;
    readonly descriptionMax: 2000;
    readonly skipDatesMax: 366;
    readonly advanceMinutesMax: 1440;
    readonly templateMax: 1000;
    readonly maxTasksPerTick: 200;
};
/**
 * Validate and trim a title.
 * @param value - Candidate.
 * @returns Trimmed title.
 * @throws ValidationError when empty or too long.
 */
export declare function validateTitle(value: unknown): string;
/**
 * Validate an optional description.
 * @param value - Candidate.
 * @returns The description, or an empty string.
 */
export declare function validateDescription(value: unknown): string;
/**
 * Validate a `dueDate` (`YYYY-MM-DD` or null).
 * @param value - Candidate.
 * @returns Normalized date key, or null for "no deadline".
 */
export declare function validateDueDate(value: unknown): string | null;
/**
 * Validate an IANA time zone.
 * @param value - Candidate.
 * @returns The zone identifier.
 * @throws ValidationError with `invalid_timezone`.
 */
export declare function validateTimeZone(value: unknown, fallback?: string): string;
/**
 * Validate a `YYYY-MM-DD` list (skipDates / extraWorkdays).
 * @param value - Candidate.
 * @param field - Field name for the error.
 * @returns De-duplicated, ascending list.
 */
export declare function validateDateList(value: unknown, field: string): string[];
/**
 * Validate notification settings.
 * @param value - Candidate.
 * @param defaults - Subscription defaults from settings.
 * @returns Normalized notify settings.
 */
export declare function validateNotify(value: unknown, defaults: {
    channels: Channel[];
    template: string;
}): {
    channels: Channel[];
    template: string;
    advanceMinutes: number;
    sound: boolean;
};
/**
 * Build a canonical rule from a preset plus its preset-specific fields.
 *
 * The cron is always derived here, never accepted from the client, so a stored
 * `rule.cron` can be trusted as canonical (F2.1–F2.4).
 * @param value - Candidate rule.
 * @param defaultTimeZone - Zone inherited when the rule omits one.
 * @returns Normalized rule.
 */
export declare function validateRule(value: unknown, defaultTimeZone: string): RecurrenceRule;
