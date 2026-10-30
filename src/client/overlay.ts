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
  const [dndSummary, setDndSummary] = React.useState<{ count: number; occurrences: string[]; titles: string[] } | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const stackRef = React.useRef<HTMLDivElement | null>(null)
  // A card can stay pending for many polls (UX-01: the overlay never
  // self-dismisses), so the chime and the OS notification must be remembered
  // per occurrence. Otherwise every 20 s tick would buzz again.
  const chimed = React.useRef<Set<string>>(new Set())
  const notified = React.useRef<Set<string>>(new Set())

  /** Fetch pending cards; also pushes system notifications for cards that ask. */
  const poll = React.useCallback(async (): Promise<void> => {
    try {
      const result = await api.due()
      // When the DND window ends, the held batch collapses into one summary
      // card (F5.6 / UX-05). Only the held rows are folded away — any other
      // card that just came due must still show, or F5.1's "within 60 s" breaks.
      const summaryKeys = new Set(result.dndSummary?.occurrences ?? [])
      const visible = result.items.filter((card) => !summaryKeys.has(card.occurrenceKey))
      setCards(visible)
      setDndSummary(result.dndSummary ?? null)
      setError(null)
      // F5.8: a card may ask for a short built-in chime. Autoplay policies can
      // reject it; that must stay silent and never block the overlay.
      const freshSound = visible.filter((card) => card.sound && !chimed.current.has(card.occurrenceKey))
      if (freshSound.length > 0) {
        playChime()
        for (const card of freshSound) chimed.current.add(card.occurrenceKey)
      }
      // Only cards actually rendered may raise a system notification: a
      // DND-held row is folded into the summary and must not buzz individually
      // (F5.6). The summary itself raises one notification instead.
      if (result.dndSummary !== undefined && document.visibilityState === 'hidden') {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(t('overlay.summary', { n: result.dndSummary.count }), {
              body: result.dndSummary.titles.slice(0, 3).join('、'),
              tag: 'dsh-todos-diy:dnd-summary',
            })
          } catch {
            // A failed summary notification must not break the poll.
          }
        }
      }
      for (const card of visible) {
        if (!card.channels.includes('system')) continue
        if (typeof Notification === 'undefined') continue
        if (Notification.permission !== 'granted') continue
        if (document.visibilityState !== 'hidden') continue
        if (notified.current.has(card.occurrenceKey)) continue
        notified.current.add(card.occurrenceKey)
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
    // The system-notification branch only runs while the page is *hidden*, so
    // the poller must keep ticking in the background too (F5.2 / AC-14).
    const timer = window.setInterval(() => {
      void poll()
    }, POLL_MS)
    const onVisible = (): void => {
      // Coming back to the page is the moment a held card matters most.
      void poll()
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

  /** Dismiss every reminder held by the DND batch. */
  const dismissSummary = async (): Promise<void> => {
    const summary = dndSummary
    if (summary === null) return
    setDndSummary(null)
    for (const key of summary.occurrences) {
      try {
        await api.ack(key, 'dismiss')
      } catch {
        // Leave the rest; the next poll re-derives the summary from the log.
      }
    }
    window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
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

  if (cards.length === 0 && dndSummary === null) return null

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
    dndSummary === null
      ? null
      : h(
          'div',
          { className: 'dtd-reminder', 'data-testid': 'dnd-summary' },
          h(
            'div',
            { className: 'dtd-reminderHead' },
            h('span', { className: 'glyph' }, h(BellGlyph, { size: 14 })),
            h('span', { className: 'dtd-reminderTitle' }, t('overlay.summary', { n: dndSummary.count })),
          ),
          h('p', { className: 'dtd-reminderText' }, dndSummary.titles.join('、')),
          h(
            'div',
            { className: 'dtd-reminderActions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dtd-btn small ghost',
                onClick: () => {
                  void dismissSummary()
                },
              },
              t('overlay.dismiss'),
            ),
          ),
        ),
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

/**
 * Play one short built-in chime (F5.8).
 *
 * Uses WebAudio so no asset is needed. Every failure (no AudioContext, autoplay
 * blocked, closed context) is swallowed: a silent reminder is still a reminder.
 */
function playChime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctor === undefined) return
    const context = new Ctor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.18)
    oscillator.onended = () => {
      void context.close()
    }
  } catch {
    // Autoplay policy or an unsupported platform: stay silent.
  }
}
