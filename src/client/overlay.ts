/**
 * The reminder overlay (F5.1 / F8.3 / UX-01).
 *
 * Rendered in `shell.overlay`, so it is frame-level: visible whatever panel the
 * user is looking at. Cards never auto-dismiss — a work reminder that vanishes
 * while the user is away is the same as no reminder at all.
 *
 * Presentation rules (§8.4 / F8.3): at most three cards in the stack; beyond
 * that a fold strip; from ten up the strip becomes a count-only summary.
 */

import * as React from 'react'

import { api, ApiError, type ReminderCardPayload } from './api'
import { BellGlyph } from './ui'

const h = React.createElement

/** How often the overlay polls `/due` while the page is visible. */
const POLL_MS = 20_000

/** Phases whose cards show the phase label. */
const PHASE_KEYS: Record<string, string> = {
  start: 'overlay.phase.start',
  end: 'overlay.phase.end',
  advance: 'overlay.phase.advance',
}

/** Props injected by the slot system. */
export interface OverlayProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Reminder overlay component. */
export function ReminderOverlay(props: OverlayProps) {
  const { t } = props
  const [cards, setCards] = React.useState<ReminderCardPayload[]>([])
  const [expanded, setExpanded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const stackRef = React.useRef<HTMLDivElement | null>(null)

  /** Fetch pending cards; also pushes system notifications for cards that ask. */
  const poll = React.useCallback(async (): Promise<void> => {
    try {
      const result = await api.due()
      setCards(result.items)
      setError(null)
      for (const card of result.items) {
        if (!card.channels.includes('system')) continue
        if (typeof Notification === 'undefined') continue
        if (Notification.permission !== 'granted') continue
        if (document.visibilityState !== 'hidden') continue
        try {
          new Notification(card.title, { body: card.text, tag: card.occurrenceKey })
          await api.reportSystem(card.occurrenceKey, true)
        } catch (caught) {
          await api.reportSystem(card.occurrenceKey, false, caught instanceof Error ? 'not-supported' : 'unknown')
        }
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.code : 'internal_error')
    }
  }, [])

  React.useEffect(() => {
    void poll()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll()
    }, POLL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('dsh-todos-diy:changed', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('dsh-todos-diy:changed', onVisible)
    }
  }, [poll])

  // Escape closes the whole stack (F8.3).
  React.useEffect(() => {
    if (cards.length === 0) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        void dismissAll()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  /** Acknowledge one card and drop it immediately. */
  const act = async (card: ReminderCardPayload, action: 'dismiss' | 'complete' | 'snooze', minutes?: number): Promise<void> => {
    setCards((current) => current.filter((entry) => entry.occurrenceKey !== card.occurrenceKey))
    try {
      await api.ack(card.occurrenceKey, action, minutes)
      window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
    } catch (caught) {
      // Failure keeps the card: silently dropping it would hide a reminder.
      // Guard against a duplicate when two failures race for the same key.
      setCards((current) =>
        current.some((entry) => entry.occurrenceKey === card.occurrenceKey) ? current : [...current, card],
      )
      setError(caught instanceof ApiError ? caught.code : 'internal_error')
    }
  }

  /** Dismiss every visible card. */
  const dismissAll = async (): Promise<void> => {
    const snapshot = [...cards]
    setCards([])
    for (const card of snapshot) {
      try {
        await api.ack(card.occurrenceKey, 'dismiss')
      } catch {
        // Restoring one failed card is enough to signal the problem; keep the
        // list unique when several acknowledgements fail at once.
        setCards((current) =>
          current.some((entry) => entry.occurrenceKey === card.occurrenceKey) ? current : [...current, card],
        )
      }
    }
    window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
  }

  if (cards.length === 0) return null

  const visible = expanded ? cards : cards.slice(0, 3)
  const hidden = cards.length - visible.length
  const summaryMode = cards.length >= 10

  return h(
    'div',
    {
      className: 'dtd-overlay',
      'data-testid': 'todos-diy-overlay',
      role: 'alertdialog',
      'aria-live': 'assertive',
      'aria-label': t('overlay.a11y', { n: cards.length }),
    },
    h(
      'div',
      { className: 'dtd-overlayStack', ref: stackRef },
      visible.map((card) =>
        h(
          'div',
          { key: card.occurrenceKey, className: 'dtd-reminder', 'data-testid': 'reminder-card' },
          h(
            'div',
            { className: 'dtd-reminderHead' },
            h('span', { className: 'glyph' }, h(BellGlyph, { size: 14 })),
            h('span', { className: 'dtd-reminderTitle' }, card.title),
            h('span', { className: 'dtd-reminderTime' }, card.localTime.replace('T', ' ')),
          ),
          card.phase === null ? null : h('span', { className: 'dtd-badge kind' }, t(PHASE_KEYS[card.phase] ?? 'overlay.title')),
          h('p', { className: 'dtd-reminderText' }, card.text),
          h(
            'div',
            { className: 'dtd-reminderActions' },
            h(
              'button',
              { type: 'button', className: 'dtd-btn small', onClick: () => void act(card, 'complete') },
              t('overlay.complete'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtd-btn small ghost',
                onClick: () => void act(card, 'snooze', 15),
                title: t('overlay.snooze'),
              },
              `${t('overlay.snooze')} ${t('overlay.snooze15')}`,
            ),
            h('span', { className: 'grow' }),
            h(
              'button',
              { type: 'button', className: 'dtd-btn small ghost', onClick: () => void act(card, 'dismiss') },
              t('overlay.dismiss'),
            ),
          ),
        ),
      ),
      cards.length > 3
        ? h(
            'div',
            {
              className: 'dtd-overlayMore',
              role: 'button',
              tabIndex: 0,
              onClick: () => setExpanded((value) => !value),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setExpanded((value) => !value)
                }
              },
            },
            h(
              'span',
              null,
              summaryMode
                ? t('overlay.summary', { n: cards.length })
                : t('overlay.more', { n: hidden }),
            ),
            h('span', null, expanded ? t('overlay.collapse') : t('overlay.expand')),
          )
        : null,
      error === null
        ? null
        : h('div', { className: 'dtd-reminder', role: 'alert' }, t(`error.${error}`)),
    ),
  )
}
