/**
 * Validation of user-supplied task input (§7.4 field constraints).
 *
 * Pure: no IO, no clock. Every error carries the §7.12 code the API and the
 * agent tools return, so the two callers cannot drift apart (F7.11).
 */
import type { Channel, RecurrenceRule } from './rules/types.js';
export { ValidationError, type ErrorCode } from './validationError.js';
export { validateOnce, parseInstant } from './validateTime.js';
export { validateSettingsPatch } from './validateSettings.js';
/**
 * Reject fields removed from the v2 task model (F4.11).
 *
 * An unknown property is ignored by TypeScript at compile time only; an HTTP or
 * tool caller can still send it, so the boundary has to say no explicitly.
 * @param body - Raw request/tool input.
 * @throws ValidationError when `dueDate` is present.
 */
export declare function rejectLegacyFields(body: Record<string, unknown>): void;
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
    endReminder?: boolean;
}): {
    channels: Channel[];
    template: string;
    advanceMinutes: number;
    sound: boolean;
    endReminder: boolean;
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
