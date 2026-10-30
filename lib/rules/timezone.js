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
const formatterCache = new Map();
/**
 * Return a cached `Intl.DateTimeFormat` for one zone. Cached because building a
 * formatter is the expensive part of a time-zone query.
 * @param timeZone - IANA zone identifier.
 * @returns Formatter emitting numeric date and time parts.
 */
function formatterFor(timeZone) {
    const cached = formatterCache.get(timeZone);
    if (cached !== undefined)
        return cached;
    const created = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    formatterCache.set(timeZone, created);
    return created;
}
/**
 * Whether a string is an IANA time zone this runtime can resolve.
 * @param timeZone - Candidate identifier.
 * @returns True when `Intl` accepts it.
 */
export function isSupportedTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || timeZone.trim() === '')
        return false;
    try {
        // Throws RangeError for unknown zones on every supported Node line.
        formatterFor(timeZone);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Read the wall-clock parts of one instant in one zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local year/month/day/hour/minute/second.
 */
export function zonedParts(instant, timeZone) {
    const parts = formatterFor(timeZone).formatToParts(new Date(instant));
    let year = 0;
    let month = 0;
    let day = 0;
    let hour = 0;
    let minute = 0;
    let second = 0;
    for (const part of parts) {
        switch (part.type) {
            case 'year':
                year = Number(part.value);
                break;
            case 'month':
                month = Number(part.value);
                break;
            case 'day':
                day = Number(part.value);
                break;
            case 'hour':
                // Some ICU builds report midnight as 24 with h23; fold it back.
                hour = Number(part.value) % 24;
                break;
            case 'minute':
                minute = Number(part.value);
                break;
            case 'second':
                second = Number(part.value);
                break;
            default:
                break;
        }
    }
    return { year, month, day, hour, minute, second };
}
/**
 * Offset of a zone at one instant, in milliseconds east of UTC.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Offset in milliseconds (`+08:00` → `28_800_000`).
 */
export function zoneOffsetMs(instant, timeZone) {
    const p = zonedParts(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(instant / 1000) * 1000;
}
/**
 * Resolve a wall clock in a zone to an instant.
 *
 * A non-existent wall clock (DST gap) resolves to `undefined`; an ambiguous one
 * (DST overlap) resolves to the earlier instant.
 * @param local - Wall clock to resolve.
 * @param timeZone - IANA zone identifier.
 * @returns Epoch milliseconds, or undefined inside a spring-forward gap.
 */
export function localToInstant(local, timeZone) {
    const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
    const firstOffset = zoneOffsetMs(guess, timeZone);
    let candidate = guess - firstOffset;
    const secondOffset = zoneOffsetMs(candidate, timeZone);
    if (secondOffset !== firstOffset)
        candidate = guess - secondOffset;
    const check = zonedParts(candidate, timeZone);
    if (check.year !== local.year ||
        check.month !== local.month ||
        check.day !== local.day ||
        check.hour !== local.hour ||
        check.minute !== local.minute) {
        return undefined;
    }
    return candidate;
}
/**
 * Format one instant as `YYYY-MM-DD` in a zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local calendar date key.
 */
export function localDateKey(instant, timeZone) {
    const p = zonedParts(instant, timeZone);
    return `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}`;
}
/**
 * Format one instant as `YYYY-MM-DDTHH:mm` in a zone (minute precision).
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local date-time key without a zone suffix.
 */
export function localDateTimeKey(instant, timeZone) {
    const p = zonedParts(instant, timeZone);
    return `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}
/** Zero-pad a number to two digits. */
function pad2(value) {
    return value < 10 ? `0${value}` : String(value);
}
/** Zero-pad a year to four digits. */
function pad4(value) {
    return String(value).padStart(4, '0');
}
/**
 * Parse a `YYYY-MM-DD` key into a local calendar date.
 * @param key - Candidate key.
 * @returns Parsed date, or undefined when the shape or the calendar is invalid.
 */
export function parseLocalDate(key) {
    if (typeof key !== 'string')
        return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (match === null)
        return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidCivilDate(year, month, day))
        return undefined;
    return { year, month, day };
}
/**
 * Format a local calendar date back to `YYYY-MM-DD`.
 * @param date - Calendar date.
 * @returns Zero-padded key.
 */
export function formatLocalDate(date) {
    return `${pad4(date.year)}-${pad2(date.month)}-${pad2(date.day)}`;
}
/**
 * Whether a civil date exists (rejects 2026-02-30 and month 13).
 * @param year - Full year.
 * @param month - 1–12.
 * @param day - 1–31.
 * @returns True for a real calendar date.
 */
export function isValidCivilDate(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day))
        return false;
    if (month < 1 || month > 12 || day < 1)
        return false;
    return day <= daysInMonth(year, month);
}
/**
 * Number of days in a month.
 * @param year - Full year.
 * @param month - 1–12.
 * @returns 28, 29, 30 or 31.
 */
export function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/**
 * ISO weekday of a civil date (1 = Monday … 7 = Sunday).
 * @param date - Calendar date.
 * @returns 1–7.
 */
export function isoWeekday(date) {
    const js = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    return js === 0 ? 7 : js;
}
/**
 * Add days to a civil date using proleptic Gregorian arithmetic.
 * @param date - Starting date.
 * @param days - Signed day count.
 * @returns Shifted date.
 */
export function addDays(date, days) {
    const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
    };
}
/**
 * First day of the month `months` months after `date`.
 * @param date - Starting date (its day is ignored).
 * @param months - Signed month count.
 * @returns First day of the shifted month.
 */
export function startOfMonthOffset(date, months) {
    const shifted = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: 1,
    };
}
/**
 * Difference in whole days between two local calendar dates (`left - right`).
 * @param left - Later date.
 * @param right - Earlier date.
 * @returns Day difference; negative when `left` precedes `right`.
 */
export function daysBetween(left, right) {
    const a = Date.UTC(left.year, left.month - 1, left.day);
    const b = Date.UTC(right.year, right.month - 1, right.day);
    return Math.round((a - b) / 86_400_000);
}
/**
 * Render a zone's current UTC offset as `UTC±HH:MM` for list rows (F8.2).
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Offset label, e.g. `UTC+08:00`.
 */
export function formatUtcOffset(instant, timeZone) {
    const offset = zoneOffsetMs(instant, timeZone);
    const sign = offset < 0 ? '-' : '+';
    const total = Math.abs(offset) / 60_000;
    const hours = Math.floor(total / 60);
    const minutes = Math.round(total % 60);
    return `UTC${sign}${pad2(hours)}:${pad2(minutes)}`;
}
