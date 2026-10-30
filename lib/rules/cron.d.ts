/**
 * 5-field Vixie cron: parsing, canonicalization and matching.
 *
 * Dialect — identical to the DSH built-in scheduler (§4.6):
 *  - `*`, a single value, `a-b`, `*​/n`, `a-b/n`, and comma-separated lists;
 *  - minute 0–59, hour 0–23, day-of-month 1–31, month 1–12, day-of-week 0–7
 *    (both 0 and 7 mean Sunday);
 *  - rejects `L` / `W` / `#`, English month or weekday names, `@daily` macros
 *    and 6-field (seconds) expressions.
 *
 * Day-of-month / day-of-week follow Vixie's AND/OR rule: when either field is
 * `*`-led the two fields AND together, otherwise a date matches if *either*
 * field matches.
 *
 * Pure module: no clock, no IO, no globals.
 */
/** Error thrown by {@link parseCron}; `field` names the offending cron field. */
export declare class CronError extends Error {
    /** Machine-readable reason shared with the API error envelope. */
    readonly code: 'invalid_cron';
    /** Which of the five fields failed, or `'expression'` for shape errors. */
    readonly field: string;
    /**
     * @param message - Human-readable diagnostic (English, API-level).
     * @param field - Offending field name.
     */
    constructor(message: string, field: string);
}
/** One parsed field: its matched values and whether its text began with `*`. */
export interface CronField {
    /** Matched values, ascending. Day-of-week folds 7 to 0. */
    values: number[];
    /** Canonical spelling of the same value set. */
    canonical: string;
    /** Whether the author wrote a leading `*` (Vixie's DOM_STAR/DOW_STAR). */
    star: boolean;
}
/** A fully parsed cron expression. */
export interface CronSpec {
    /** Canonical expression; byte-identical to what is persisted. */
    expression: string;
    minutes: number[];
    hours: number[];
    daysOfMonth: number[];
    months: number[];
    /** Sunday is 0; 7 is folded to 0. */
    daysOfWeek: number[];
    dayOfMonthStar: boolean;
    dayOfWeekStar: boolean;
}
/**
 * Parse and canonicalize a 5-field Vixie cron expression.
 * @param expression - Candidate expression.
 * @returns Parsed spec with the canonical spelling attached.
 * @throws CronError with `code: 'invalid_cron'` and the offending `field`.
 */
export declare function parseCron(expression: string): CronSpec;
/**
 * Canonicalize a cron expression without exposing the parsed structure.
 * @param expression - Candidate expression.
 * @returns Canonical 5-field spelling.
 * @throws CronError when invalid.
 */
export declare function canonicalizeCron(expression: string): string;
/**
 * Whether a local wall clock matches a parsed cron expression.
 *
 * Evaluates Vixie's dom/dow AND/OR branch. `weekday` is ISO 1–7 and is folded
 * to the cron 0–6 scale (Sunday = 0) before the day-of-week test.
 * @param spec - Parsed expression.
 * @param parts - Local date and time to test (seconds ignored).
 * @param weekday - ISO weekday of that date (1 = Monday … 7 = Sunday).
 * @returns True when the expression fires at that wall clock.
 */
export declare function matchCron(spec: CronSpec, parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}, weekday: number): boolean;
/**
 * Local times of day a parsed expression fires at, ascending.
 * @param spec - Parsed expression.
 * @returns `{hour, minute}` pairs.
 */
export declare function cronTimes(spec: CronSpec): {
    hour: number;
    minute: number;
}[];
/**
 * Whether a parsed expression can ever match a calendar date.
 *
 * Detects the classic impossible rules — `0 0 30 2 *` (February never has 30
 * days) and `0 0 31 4,6,9,11 *` — so callers can surface "该规则不会再次触发"
 * instead of scanning forever. A leap year (2024) is the most permissive case
 * for February, and 400 consecutive years would be needed to prove a
 * day-of-week rule impossible; every day-of-week value occurs in every month,
 * so one leap year is sufficient.
 * @param spec - Parsed expression.
 * @returns True when at least one date in a leap year matches.
 */
export declare function hasAnyMatchingDate(spec: CronSpec): boolean;
