/**
 * Calendar-quarter helpers (F4.16 / D-24).
 *
 * Pure: only `Intl` is used, so both the archive writer and the read-side
 * counters can share exactly the same definition of "current quarter".
 */
/**
 * Quarter label (`YYYY-Qn`) of an instant in a zone.
 * @param iso - ISO instant.
 * @param timeZone - IANA zone the quarter is measured in.
 * @returns The quarter label.
 */
export declare function quarterOf(iso: string, timeZone: string): string;
