/**
 * Pure display helpers: weekday labels, local date keys and zoned formatting.
 *
 * Split from `ui.ts` so they can be unit-tested without a DOM/React runtime and
 * reused by the row summary.
 */

/** Two-letter weekday labels, ISO 1–7. */
export function weekdayLabel(t: (key: string) => string, iso: number): string {
  return t(`form.weekday.${iso}`)
}

/**
 * Today's local date string in the browser zone, used only for display
 * heuristics. The host is authoritative for due-date grouping.
 * @returns `YYYY-MM-DD`.
 */
export function browserToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Whole-day difference between two `YYYY-MM-DD` strings.
 * @param left - Later date.
 * @param right - Earlier date.
 * @returns Signed day difference.
 */
export function dayDiff(left: string, right: string): number {
  const a = Date.parse(`${left}T00:00:00Z`)
  const b = Date.parse(`${right}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((a - b) / 86_400_000)
}

/**
 * Format an ISO instant in a zone, `YYYY-MM-DD HH:mm`.
 * @param iso - Instant.
 * @param timeZone - IANA zone.
 * @returns Local text, or the original string when unparseable.
 */
export function formatInZone(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
  } catch {
    return iso
  }
}

