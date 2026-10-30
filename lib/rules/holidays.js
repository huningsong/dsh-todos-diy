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
import { isoWeekday, isValidCivilDate, parseLocalDate } from './timezone.js';
/**
 * Build a lookup table from the parsed JSON file.
 *
 * Malformed entries are ignored rather than throwing: a corrupt holiday file
 * must never stop the plugin from loading, it only degrades `workdays` rules to
 * plain Mon–Fri for the affected dates.
 * @param file - Parsed `assets/holidays-cn-2024-2027.json`.
 * @returns Immutable lookup table.
 */
export function buildHolidayTable(file) {
    const holidays = new Set();
    const workdays = new Set();
    const years = [];
    for (const [yearText, entry] of Object.entries(file.years ?? {})) {
        const year = Number(yearText);
        if (!Number.isInteger(year))
            continue;
        years.push(year);
        for (const date of entry?.holidays ?? []) {
            if (typeof date === 'string' && isValidDateKey(date))
                holidays.add(date);
        }
        for (const date of entry?.workdays ?? []) {
            if (typeof date === 'string' && isValidDateKey(date))
                workdays.add(date);
        }
    }
    years.sort((left, right) => left - right);
    return {
        schemaVersion: typeof file.schemaVersion === 'number' ? file.schemaVersion : 0,
        source: typeof file.source === 'string' ? file.source : 'unknown',
        holidays,
        workdays,
        years,
    };
}
/** Whether a `YYYY-MM-DD` key names a real calendar date. */
function isValidDateKey(key) {
    const parsed = parseLocalDate(key);
    return parsed !== undefined && isValidCivilDate(parsed.year, parsed.month, parsed.day);
}
/**
 * Whether a civil date is an ordinary weekday (Mon–Fri, holidays ignored).
 * @param date - Calendar date.
 * @returns True for ISO weekdays 1–5.
 */
export function isWeekday(date) {
    const weekday = isoWeekday(date);
    return weekday >= 1 && weekday <= 5;
}
/**
 * Whether a local date is a public holiday in the built-in table.
 * @param table - Holiday lookup table.
 * @param localDate - `YYYY-MM-DD` in the task's time zone.
 * @returns True when the table lists it as a holiday.
 */
export function isHoliday(table, localDate) {
    return table.holidays.has(localDate);
}
/**
 * Whether a local date is a make-up workday (a weekend day that works).
 * @param table - Holiday lookup table.
 * @param localDate - `YYYY-MM-DD` in the task's time zone.
 * @returns True when the table lists it as a make-up workday.
 */
export function isMakeupWorkday(table, localDate) {
    return table.workdays.has(localDate);
}
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
export function isWorkday(table, localDate) {
    const date = parseLocalDate(localDate);
    if (date === undefined)
        return false;
    if (table.workdays.has(localDate))
        return true;
    if (table.holidays.has(localDate))
        return false;
    return isWeekday(date);
}
/**
 * Resolve `holidayCalendar` to a date predicate.
 *
 * `CN` uses the built-in table; `none` is plain Monday–Friday. Kept pure so
 * `occurrence.ts` can inject it into the cron walk.
 * @param table - Holiday lookup table.
 * @param calendar - Rule's `holidayCalendar`.
 * @returns Predicate over a `YYYY-MM-DD` key.
 */
export function workdayPredicate(table, calendar) {
    if (calendar === 'none') {
        return (localDate) => {
            const date = parseLocalDate(localDate);
            return date !== undefined && isWeekday(date);
        };
    }
    return (localDate) => isWorkday(table, localDate);
}
/** An always-empty table, used before the asset is parsed or as a test double. */
export const EMPTY_HOLIDAY_TABLE = {
    schemaVersion: 0,
    source: 'empty',
    holidays: new Set(),
    workdays: new Set(),
    years: [],
};
