/**
 * Small shared client components: icons, modal shell, menu, toast and the date
 * helpers every panel needs. Kept dependency-free (React only).
 */

import * as React from 'react'

const h = React.createElement

/** Linear calendar-with-check glyph (sidebar entry + empty state). */
export function TodoGlyph({ size = 18 }: { size?: number }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('rect', { x: 2.25, y: 3.25, width: 11.5, height: 10.5, rx: 2 }),
    h('path', { d: 'M2.25 6.5h11.5' }),
    h('path', { d: 'M5.25 1.75v2.5M10.75 1.75v2.5' }),
    h('path', { d: 'M5.75 9.75l1.4 1.4 2.9-2.9' }),
  )
}

/** Bell glyph used by reminder cards. */
export function BellGlyph({ size = 14 }: { size?: number }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M4 6.5a4 4 0 1 1 8 0c0 2.2.6 3.2 1.2 3.9.3.4 0 .9-.5.9H3.3c-.5 0-.8-.5-.5-.9C3.4 9.7 4 8.7 4 6.5z' }),
    h('path', { d: 'M6.5 13a1.6 1.6 0 0 0 3 0' }),
  )
}

/** Pin glyph (📌 without depending on emoji rendering). */
export function PinGlyph({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: filled ? 'currentColor' : 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M9.6 1.9l4.5 4.5-2.1 1.1-2.4 2.4-.3 2.2-1.6-1.6L3 14.9l-1.4-1.4 4.4-4.7-1.6-1.6 2.2-.3L9 4z' }),
  )
}

/** Plus glyph. */
export function PlusGlyph({ size = 13 }: { size?: number }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M8 3v10M3 8h10' }),
  )
}

/** Search glyph. */
export function SearchGlyph({ size = 14 }: { size?: number }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('circle', { cx: 7, cy: 7, r: 4.2 }),
    h('path', { d: 'M10.2 10.2L14 14' }),
  )
}

/** Close glyph. */
export function CloseGlyph({ size = 14 }: { size?: number }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M4 4l8 8M12 4l-8 8' }),
  )
}

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

/** A modal shell: backdrop, Escape handling, focus trap and body scroll lock. */
export function Modal(props: {
  title: string
  onClose: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        props.onClose()
        return
      }
      if (event.key !== 'Tab' || panelRef.current === null) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const firstEl = focusables[0] as HTMLElement
      const lastEl = focusables[focusables.length - 1] as HTMLElement
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previous?.focus?.()
    }
  }, [props])

  return h(
    'div',
    {
      className: 'dtd-backdrop',
      onMouseDown: (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) props.onClose()
      },
    },
    h(
      'div',
      {
        className: 'dtd-modal',
        ref: panelRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': props.title,
        style: props.wide === true ? { width: 'min(880px,100%)' } : undefined,
      },
      h(
        'div',
        { className: 'dtd-modalHead' },
        h('h2', null, props.title),
        h(
          'button',
          { type: 'button', className: 'dtd-iconBtn', 'aria-label': 'Close', onClick: props.onClose },
          h(CloseGlyph, {}),
        ),
      ),
      h('div', { className: 'dtd-modalBody' }, props.children),
      props.footer === undefined ? null : h('div', { className: 'dtd-modalFoot' }, props.footer),
    ),
  )
}

/** A dropdown menu anchored near a point; closes on outside click or Escape. */
export function ContextMenu(props: {
  x: number
  y: number
  onClose: () => void
  items: { label: string; onSelect: () => void; danger?: boolean }[]
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const close = () => props.onClose()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [props])

  const width = 176
  const height = props.items.length * 34 + 10
  const left = Math.min(props.x, window.innerWidth - width - 12)
  const top = Math.min(props.y, window.innerHeight - height - 12)

  return h(
    'div',
    { className: 'dtd-menu', ref, style: { left, top }, role: 'menu' },
    props.items.map((item) =>
      h(
        'button',
        {
          key: item.label,
          type: 'button',
          role: 'menuitem',
          className: item.danger === true ? 'danger' : undefined,
          onClick: () => {
            props.onClose()
            item.onSelect()
          },
        },
        item.label,
      ),
    ),
  )
}
