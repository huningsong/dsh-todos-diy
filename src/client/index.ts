/**
 * dsh-todos-diy — client entry.
 *
 * Registers the three slots (§7.9) and nothing else. This file is the single
 * place that talks to `ctx.slots` / `ctx.locale`, so the components stay pure
 * React and are unit-testable.
 */

import * as React from 'react'

import { CSS } from './styles'
import { zh, en } from './dictionary'
import { TodoGlyph } from './ui'
import { TodoPanel } from './panel'
import { ReminderOverlay } from './overlay'

/** Locale namespace; also the `locale` field of every slot registration. */
const NS = 'todos-diy'

/** Mount the client half. */
export function apply(ctx: {
  effect: (fn: () => (() => void) | void, label?: string) => unknown
  locale: {
    register: (ns: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }) => () => void
    bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
  }
  slots: {
    inject: (owner: string, register: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  // 1) styles first, so the very first render is already correct.
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-todos-diy'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => {
      if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
    }
  }, 'todos-diy: styles')

  // 2) dictionaries, so `t()` resolves on the first render.
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'todos-diy: dictionaries')

  const t = ctx.locale.bind(NS)

  // Report the real Notification permission so `/health` can answer AC-15
  // truthfully (the host cannot read a browser API).
  ctx.effect(() => {
    const report = (): void => {
      try {
        if (typeof Notification === 'undefined') return
        void fetch('/api/dsh-todos-diy/capabilities', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ systemNotification: Notification.permission === 'granted' }),
        }).catch(() => undefined)
      } catch {
        // Capability reporting is best effort; it must never break mounting.
      }
    }
    report()
    return () => undefined
  }, 'todos-diy: capabilities')

  // 3) sidebar entry — its id must equal the main slot's key.
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: 'todos-diy', order: 30, locale: NS, label: () => t('entry.label') },
      TodoGlyph,
    ),
  )

  // 4) main panel.
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: 'todos-diy', locale: NS },
      function MainPanel(props: { t?: typeof t }) {
        return React.createElement(TodoPanel, { t: props.t ?? t })
      },
    ),
  )

  // 5) frame-level reminder overlay.
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'todos-diy-overlay', order: 60, locale: NS },
      function Overlay(props: { t?: typeof t }) {
        return React.createElement(ReminderOverlay, { t: props.t ?? t })
      },
    ),
  )
}

export default { apply, inject: ['slots', 'locale'] as const }
