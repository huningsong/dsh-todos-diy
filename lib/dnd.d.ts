/**
 * Do-not-disturb window (F5.6 / F9.2 / UX-05).
 *
 * DND is off by default. While it is on, occurrences that come due inside the
 * window are **held** rather than delivered, and the hold ends with one summary
 * card. A window longer than 12 hours, or one that swallows a whole daytime, is
 * not summarised — those occurrences are marked `missed` instead, because
 * replaying a dozen stale reminders is worse than saying nothing.
 */
import type { DndSettings } from './state.js';
/** A local `HH:mm` clock reading. */
export interface ClockTime {
    hour: number;
    minute: number;
}
/**
 * Parse `HH:mm`.
 * @param text - Candidate clock reading.
 * @returns Parsed time, or null when malformed.
 */
export declare function parseClock(text: unknown): ClockTime | null;
/**
 * Minutes since local midnight for a clock reading.
 * @param time - Clock reading.
 * @returns 0–1439.
 */
export declare function minutesOfDay(time: ClockTime): number;
/**
 * Length of a DND window in minutes.
 *
 * A window whose end is at or before its start crosses midnight, so the length
 * is `24h - start + end`.
 * @param dnd - DND settings.
 * @returns Window length in minutes, or 0 when the settings are unusable.
 */
export declare function dndDurationMinutes(dnd: DndSettings): number;
/**
 * Whether a local instant falls inside the DND window.
 * @param dnd - DND settings.
 * @param now - Current instant.
 * @param timeZone - Zone the window is expressed in.
 * @returns True when reminders must be held.
 */
export declare function isWithinDnd(dnd: DndSettings, now: Date, timeZone: string): boolean;
/**
 * The next instant at which the DND window ends.
 * @param dnd - DND settings.
 * @param now - Current instant (already known to be inside the window).
 * @param timeZone - Zone the window is expressed in.
 * @returns The window's end instant.
 */
export declare function dndEndsAt(dnd: DndSettings, now: Date, timeZone: string): Date;
/**
 * Whether a DND window is too long to summarise.
 *
 * §8.4 / UX-05: over 12 hours, or a window that covers the whole daytime, is
 * dropped instead of summarised.
 * @param dnd - DND settings.
 * @returns True when held reminders should be marked missed on release.
 */
export declare function shouldDropInsteadOfSummarise(dnd: DndSettings): boolean;
/**
 * Local date key of an instant in a zone.
 * @param now - Instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-MM-DD`.
 */
export declare function localKey(now: Date, timeZone: string): string;
