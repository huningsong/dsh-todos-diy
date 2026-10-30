/**
 * Do-not-disturb window (F5.6 / F9.2 / UX-05).
 *
 * DND is off by default. While it is on, occurrences that come due inside the
 * window are **held** rather than delivered, and the hold ends with one summary
 * card. A window longer than 12 hours, or one that swallows a whole daytime, is
 * not summarised — those occurrences are marked `missed` instead, because
 * replaying a dozen stale reminders is worse than saying nothing.
 */
import { isoWeekday, localDateKey, zonedParts } from './rules/timezone.js';
/**
 * Parse `HH:mm`.
 * @param text - Candidate clock reading.
 * @returns Parsed time, or null when malformed.
 */
export function parseClock(text) {
    if (typeof text !== 'string')
        return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
    if (match === null)
        return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23)
        return null;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59)
        return null;
    return { hour, minute };
}
/**
 * Minutes since local midnight for a clock reading.
 * @param time - Clock reading.
 * @returns 0–1439.
 */
export function minutesOfDay(time) {
    return time.hour * 60 + time.minute;
}
/**
 * Length of a DND window in minutes.
 *
 * A window whose end is at or before its start crosses midnight, so the length
 * is `24h - start + end`.
 * @param dnd - DND settings.
 * @returns Window length in minutes, or 0 when the settings are unusable.
 */
export function dndDurationMinutes(dnd) {
    const start = parseClock(dnd.start);
    const end = parseClock(dnd.end);
    if (start === null || end === null)
        return 0;
    const startMinutes = minutesOfDay(start);
    const endMinutes = minutesOfDay(end);
    return endMinutes > startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
}
/**
 * Whether a local instant falls inside the DND window.
 * @param dnd - DND settings.
 * @param now - Current instant.
 * @param timeZone - Zone the window is expressed in.
 * @returns True when reminders must be held.
 */
export function isWithinDnd(dnd, now, timeZone) {
    if (!dnd.enabled)
        return false;
    const start = parseClock(dnd.start);
    const end = parseClock(dnd.end);
    if (start === null || end === null)
        return false;
    const parts = zonedParts(now.getTime(), timeZone);
    if (dnd.weekdaysOnly) {
        const weekday = isoWeekday({ year: parts.year, month: parts.month, day: parts.day });
        if (weekday >= 6)
            return false;
    }
    const current = parts.hour * 60 + parts.minute;
    const startMinutes = minutesOfDay(start);
    const endMinutes = minutesOfDay(end);
    if (startMinutes === endMinutes)
        return false;
    if (startMinutes < endMinutes)
        return current >= startMinutes && current < endMinutes;
    // Crosses midnight: [start, 24:00) ∪ [00:00, end)
    return current >= startMinutes || current < endMinutes;
}
/**
 * The next instant at which the DND window ends.
 * @param dnd - DND settings.
 * @param now - Current instant (already known to be inside the window).
 * @param timeZone - Zone the window is expressed in.
 * @returns The window's end instant.
 */
export function dndEndsAt(dnd, now, timeZone) {
    const end = parseClock(dnd.end) ?? { hour: 8, minute: 0 };
    const parts = zonedParts(now.getTime(), timeZone);
    const target = Date.UTC(parts.year, parts.month - 1, parts.day, end.hour, end.minute);
    let candidate = resolveInZone(target, timeZone);
    if (candidate <= now.getTime())
        candidate = resolveInZone(target + 86_400_000, timeZone);
    return new Date(candidate);
}
/**
 * Resolve a UTC-built wall clock into the zone's real instant.
 * @param wallClockUtc - `Date.UTC(...)` of the intended local wall clock.
 * @param timeZone - IANA zone.
 * @returns Epoch milliseconds of that wall clock in the zone.
 */
function resolveInZone(wallClockUtc, timeZone) {
    const guessParts = new Date(wallClockUtc);
    const guessString = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).format(guessParts);
    const parsed = new Date(`${guessString} UTC`);
    const offset = parsed.getTime() - wallClockUtc;
    return wallClockUtc - offset;
}
/**
 * Whether a DND window is too long to summarise.
 *
 * §8.4 / UX-05: over 12 hours, or a window that covers the whole daytime, is
 * dropped instead of summarised.
 * @param dnd - DND settings.
 * @returns True when held reminders should be marked missed on release.
 */
export function shouldDropInsteadOfSummarise(dnd) {
    const duration = dndDurationMinutes(dnd);
    if (duration > 12 * 60)
        return true;
    const start = parseClock(dnd.start);
    const end = parseClock(dnd.end);
    if (start === null || end === null)
        return false;
    const startMinutes = minutesOfDay(start);
    const endMinutes = minutesOfDay(end);
    // Covers 09:00–17:00 entirely (the working daytime).
    const coversDaytime = startMinutes <= 9 * 60 && (endMinutes >= 17 * 60 || endMinutes <= startMinutes);
    return coversDaytime && duration >= 8 * 60;
}
/**
 * Local date key of an instant in a zone.
 * @param now - Instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-MM-DD`.
 */
export function localKey(now, timeZone) {
    return localDateKey(now.getTime(), timeZone);
}
