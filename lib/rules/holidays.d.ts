/**
 * Built-in Chinese public-holiday / make-up-workday table (D-04).
 *
 * The data ships with the package (`assets/holidays-cn-2024-2027.json`) and is
 * queried purely: no network, no clock. The table only lists dates that differ
 * from "Monday through Friday", so a normal weekday needs no entry:
 *
 *  - `holidays` — weekdays that are public holidays (must NOT fire);
 *  - `workdays` — weekend days that are make-up workdays (MUST fire).
 *
 * `holidayCalendar: "none"` skips this table entirely and falls back to plain
 * Mon–Fri (`isWeekday`).
 */
import { type LocalDate } from './timezone.js';
/** Shape of `assets/holidays-cn-2024-2027.json`. */
export interface HolidayFile {
    schemaVersion: number;
    source: string;
    generatedAt?: string;
    note?: string;
    years: Record<string, {
        holidays: string[];
        workdays: string[];
    }>;
    coverage?: Record<string, string>;
}
/** In-memory lookup form: two sets per year, plus the raw source metadata. */
export interface HolidayTable {
    schemaVersion: number;
    source: string;
    /** Local date keys that are public holidays on an otherwise working weekday. */
    holidays: ReadonlySet<string>;
    /** Local date keys that are make-up workdays on an otherwise weekend day. */
    workdays: ReadonlySet<string>;
    /** Years the table claims to cover, ascending. */
    years: readonly number[];
}
/**
 * Build a lookup table from the parsed JSON file.
 *
 * Malformed entries are ignored rather than throwing: a corrupt holiday file
 * must never stop the plugin from loading, it only degrades `workdays` rules to
 * plain Mon–Fri for the affected dates.
 * @param file - Parsed `assets/holidays-cn-2024-2027.json`.
 * @returns Immutable lookup table.
 */
export declare function buildHolidayTable(file: HolidayFile): HolidayTable;
/**
 * Whether a civil date is an ordinary weekday (Mon–Fri, holidays ignored).
 * @param date - Calendar date.
 * @returns True for ISO weekdays 1–5.
 */
export declare function isWeekday(date: LocalDate): boolean;
/**
 * Whether a local date is a public holiday in the built-in table.
 * @param table - Holiday lookup table.
 * @param localDate - `YYYY-MM-DD` in the task's time zone.
 * @returns True when the table lists it as a holiday.
 */
export declare function isHoliday(table: HolidayTable, localDate: string): boolean;
/**
 * Whether a local date is a make-up workday (a weekend day that works).
 * @param table - Holiday lookup table.
 * @param localDate - `YYYY-MM-DD` in the task's time zone.
 * @returns True when the table lists it as a make-up workday.
 */
export declare function isMakeupWorkday(table: HolidayTable, localDate: string): boolean;
/**
 * Whether a local date is a Chinese statutory workday.
 *
 * Monday–Friday that is not a listed holiday, plus listed make-up weekend days.
 * Dates outside the table's coverage fall back to plain Mon–Fri, which is what
 * the file's own `note` documents for 2027 before the State Council publishes.
 * @param table - Holiday lookup table.
 * @param localDate - `YYYY-MM-DD` in the task's time zone.
 * @returns True when a `workdays` rule should fire that day.
 */
export declare function isWorkday(table: HolidayTable, localDate: string): boolean;
/**
 * Resolve `holidayCalendar` to a date predicate.
 *
 * `CN` uses the built-in table; `none` is plain Monday–Friday. Kept pure so
 * `occurrence.ts` can inject it into the cron walk.
 * @param table - Holiday lookup table.
 * @param calendar - Rule's `holidayCalendar`.
 * @returns Predicate over a `YYYY-MM-DD` key.
 */
export declare function workdayPredicate(table: HolidayTable, calendar: 'CN' | 'none'): (localDate: string) => boolean;
/** An always-empty table, used before the asset is parsed or as a test double. */
export declare const EMPTY_HOLIDAY_TABLE: HolidayTable;
