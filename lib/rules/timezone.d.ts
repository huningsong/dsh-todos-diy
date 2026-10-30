/**
 * Time-zone arithmetic built on `Intl.DateTimeFormat`.
 *
 * `Temporal` is not available on every Node line this package supports
 * (`engines.node >= 22.19`), so wall-clock ⇄ instant conversion is done with
 * `Intl`, which both 22.x and 24.x ship. Everything here is pure: no clock is
 * read, every instant is passed in.
 *
 * DST semantics (F2.7):
 *  - a local time that does not exist (spring-forward gap) returns `undefined`,
 *    so the caller skips that occurrence;
 *  - a local time that exists twice (fall-back overlap) resolves to the earlier
 *    instant, so the reminder fires once.
 */
/** A wall-clock date plus minute precision, with no zone attached. */
export interface LocalDateTime {
    year: number;
    /** 1–12. */
    month: number;
    /** 1–31. */
    day: number;
    /** 0–23. */
    hour: number;
    /** 0–59. */
    minute: number;
}
/** A local calendar date, with no zone attached. */
export interface LocalDate {
    year: number;
    /** 1–12. */
    month: number;
    /** 1–31. */
    day: number;
}
/**
 * Whether a string is an IANA time zone this runtime can resolve.
 * @param timeZone - Candidate identifier.
 * @returns True when `Intl` accepts it.
 */
export declare function isSupportedTimeZone(timeZone: unknown): timeZone is string;
/**
 * Read the wall-clock parts of one instant in one zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local year/month/day/hour/minute/second.
 */
export declare function zonedParts(instant: number, timeZone: string): LocalDateTime & {
    second: number;
};
/**
 * Offset of a zone at one instant, in milliseconds east of UTC.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Offset in milliseconds (`+08:00` → `28_800_000`).
 */
export declare function zoneOffsetMs(instant: number, timeZone: string): number;
/**
 * Resolve a wall clock in a zone to an instant.
 *
 * A non-existent wall clock (DST gap) resolves to `undefined`; an ambiguous one
 * (DST overlap) resolves to the earlier instant.
 * @param local - Wall clock to resolve.
 * @param timeZone - IANA zone identifier.
 * @returns Epoch milliseconds, or undefined inside a spring-forward gap.
 */
export declare function localToInstant(local: LocalDateTime, timeZone: string): number | undefined;
/**
 * Format one instant as `YYYY-MM-DD` in a zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local calendar date key.
 */
export declare function localDateKey(instant: number, timeZone: string): string;
/**
 * Format one instant as `YYYY-MM-DDTHH:mm` in a zone (minute precision).
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local date-time key without a zone suffix.
 */
export declare function localDateTimeKey(instant: number, timeZone: string): string;
/**
 * Parse a `YYYY-MM-DD` key into a local calendar date.
 * @param key - Candidate key.
 * @returns Parsed date, or undefined when the shape or the calendar is invalid.
 */
export declare function parseLocalDate(key: unknown): LocalDate | undefined;
/**
 * Format a local calendar date back to `YYYY-MM-DD`.
 * @param date - Calendar date.
 * @returns Zero-padded key.
 */
export declare function formatLocalDate(date: LocalDate): string;
/**
 * Whether a civil date exists (rejects 2026-02-30 and month 13).
 * @param year - Full year.
 * @param month - 1–12.
 * @param day - 1–31.
 * @returns True for a real calendar date.
 */
export declare function isValidCivilDate(year: number, month: number, day: number): boolean;
/**
 * Number of days in a month.
 * @param year - Full year.
 * @param month - 1–12.
 * @returns 28, 29, 30 or 31.
 */
export declare function daysInMonth(year: number, month: number): number;
/**
 * ISO weekday of a civil date (1 = Monday … 7 = Sunday).
 * @param date - Calendar date.
 * @returns 1–7.
 */
export declare function isoWeekday(date: LocalDate): number;
/**
 * Add days to a civil date using proleptic Gregorian arithmetic.
 * @param date - Starting date.
 * @param days - Signed day count.
 * @returns Shifted date.
 */
export declare function addDays(date: LocalDate, days: number): LocalDate;
/**
 * First day of the month `months` months after `date`.
 * @param date - Starting date (its day is ignored).
 * @param months - Signed month count.
 * @returns First day of the shifted month.
 */
export declare function startOfMonthOffset(date: LocalDate, months: number): LocalDate;
/**
 * Difference in whole days between two local calendar dates (`left - right`).
 * @param left - Later date.
 * @param right - Earlier date.
 * @returns Day difference; negative when `left` precedes `right`.
 */
export declare function daysBetween(left: LocalDate, right: LocalDate): number;
/**
 * Render a zone's current UTC offset as `UTC±HH:MM` for list rows (F8.2).
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Offset label, e.g. `UTC+08:00`.
 */
export declare function formatUtcOffset(instant: number, timeZone: string): string;
