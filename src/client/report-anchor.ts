/**
 * Anchor-date helpers for the report modal (F11.6).
 *
 * Pure date arithmetic: no React, no clock reads inside the pure functions, so
 * the "this/last week/month" mapping is unit-testable.
 */

/** Period choices offered by the modal. */
export type ReportPeriodChoice = 'this' | 'last'

/**
 * Today's date key in a zone.
 * @param timeZone - IANA zone.
 * @param now - Clock (injectable for tests).
 * @returns `YYYY-MM-DD`.
 */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/**
 * Shift a `YYYY-MM-DD` key by whole days.
 * @param key - Date key.
 * @param days - Days to add (may be negative).
 * @returns New date key.
 */
export function shiftDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const stamp = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) + days * 86_400_000)
  return stamp.toISOString().slice(0, 10)
}

/**
 * First day of the previous month.
 * @param key - Any date key.
 * @returns `YYYY-MM-01` of the previous month.
 */
export function previousMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const total = (year ?? 1970) * 12 + ((month ?? 1) - 1) - 1
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y)}-${String(m).padStart(2, '0')}-01`
}

/**
 * Resolve the anchor date for a tab/period pair.
 * @param kind - Weekly or monthly.
 * @param choice - This or last period.
 * @param timeZone - Reporting zone.
 * @param now - Clock (injectable).
 * @returns Anchor date key.
 */
export function resolveReportAnchor(
  kind: 'weekly' | 'monthly',
  choice: ReportPeriodChoice,
  timeZone: string,
  now: Date = new Date(),
): string {
  const today = todayInZone(timeZone, now)
  if (kind === 'weekly') return choice === 'this' ? today : shiftDays(today, -7)
  return choice === 'this' ? today : previousMonth(today)
}
