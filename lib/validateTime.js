/**
 * Instant and one-off-window validation.
 *
 * Split from `validate.ts` to stay inside the NF5 line budget. Pure: the only
 * time-zone lookup is `Intl`, and "now" is never read here.
 */
import { ValidationError } from './validationError.js';
import { localToInstant } from './rules/timezone.js';
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
export function validateOnce(value, timeZone, createdAt = new Date(0), endReminder = true, options = {}) {
    const raw = value !== null && typeof value === 'object' ? value : {};
    // F2.6 / F9.1: a one-off task carries its own zone. It may be supplied either
    // at the top level (legacy callers) or inside `once` (the documented API
    // shape), so the inner value wins when both are present.
    const zone = resolveZone(raw['timeZone'], timeZone);
    const startText = raw['startAt'];
    const explicitStart = typeof startText === 'string' && startText.trim() !== '';
    if (startText !== undefined && startText !== null && typeof startText !== 'string') {
        throw new ValidationError('invalid_argument', 'once.startAt must be an ISO 8601 string', { field: 'once.startAt' });
    }
    const endText = raw['endAt'];
    if (typeof endText !== 'string' || endText.trim() === '') {
        throw new ValidationError('invalid_argument', 'once.endAt is required (D-25: the only deadline)', {
            field: 'once.endAt',
        });
    }
    if (!endReminder && !explicitStart) {
        throw new ValidationError('invalid_argument', 'notify.endReminder=false requires an explicit once.startAt; otherwise the task would have no reminder', { field: 'notify.endReminder' });
    }
    const start = explicitStart ? parseInstant(startText, zone, 'once.startAt') : createdAt;
    const end = parseInstant(normalizeEndText(endText), zone, 'once.endAt');
    if (end.getTime() <= start.getTime()) {
        throw new ValidationError('invalid_argument', 'once.endAt must be strictly later than once.startAt', {
            field: 'once.endAt',
        });
    }
    return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        // `keepCreated` lets an edit that does not touch `startAt` preserve the
        // "defaulted from creation time" origin (F3.8).
        startAtSource: !explicitStart || options.keepCreated === true ? 'created' : 'explicit',
        timeZone: zone,
    };
}
/**
 * Expand a date-only `endAt` to the last millisecond of that day.
 * @param text - Candidate end text.
 * @returns The text to parse as an instant.
 */
function normalizeEndText(text) {
    const trimmed = text.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999` : trimmed;
}
/**
 * Parse an ISO instant, interpreting an offset-less value in the task zone.
 *
 * Offset-less values go through `localToInstant`, the same DST-aware resolver
 * the recurrence engine uses: a wall time that does not exist (spring-forward
 * gap) is rejected instead of being silently shifted an hour; an ambiguous
 * autumn hour resolves to the earlier instant. A plain `new Date(text)` would
 * get both cases wrong because the runtime would read the text in the host zone.
 * @param text - ISO 8601 string.
 * @param timeZone - Task zone.
 * @param field - Field name for errors.
 * @returns Parsed instant.
 */
export function parseInstant(text, timeZone, field) {
    const trimmed = text.trim();
    // A date-only value has no wall-clock time, so it cannot express a reminder
    // node; require at least `YYYY-MM-DDTHH:mm`.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(trimmed);
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
    if (hasOffset) {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            throw new ValidationError('invalid_argument', `${field} is not a valid ISO 8601 instant`, { field });
        }
        return parsed;
    }
    if (match === null) {
        throw new ValidationError('invalid_argument', `${field} must include a time (YYYY-MM-DDTHH:mm...)`, { field });
    }
    const [, year, month, day, hour, minute, second, fraction] = match;
    const local = {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
    };
    if (local.hour > 23 || local.minute > 59 || Number(second ?? '0') > 59) {
        throw new ValidationError('invalid_argument', `${field} has an out-of-range time`, { field });
    }
    const base = localToInstant(local, timeZone);
    if (base === undefined) {
        throw new ValidationError('invalid_argument', `${field} ${JSON.stringify(trimmed)} does not exist in ${timeZone} (DST gap or invalid date)`, { field });
    }
    const seconds = Number(second ?? '0');
    const millis = fraction === undefined ? 0 : Math.floor(Number(`0.${fraction}`) * 1000);
    return new Date(base + seconds * 1000 + millis);
}
/**
 * Validate an optional IANA zone, falling back to the caller's default.
 * @param value - Candidate zone from the payload.
 * @param fallback - Zone to use when absent.
 * @returns A resolvable IANA zone.
 * @throws ValidationError `invalid_timezone` when the candidate is unusable.
 */
function resolveZone(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    if (typeof value !== 'string') {
        throw new ValidationError('invalid_timezone', 'once.timeZone must be a string', { field: 'once.timeZone' });
    }
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
    }
    catch {
        throw new ValidationError('invalid_timezone', `timeZone ${JSON.stringify(value)} is not a resolvable IANA zone`, {
            field: 'once.timeZone',
        });
    }
    return value;
}
