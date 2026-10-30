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
export function quarterOf(iso, timeZone) {
    const instant = Date.parse(iso);
    if (Number.isNaN(instant))
        return '1970-Q1';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date(instant));
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
    return `${year}-Q${String(Math.floor((month - 1) / 3) + 1)}`;
}
