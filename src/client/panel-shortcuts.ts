/**
 * In-page keyboard shortcuts (F8.16 / UX-18).
 *
 * Never global: the listener is attached to `document` only while the panel is
 * mounted, and it ignores keystrokes typed into an input, textarea or
 * contenteditable element.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'

/** Options for the shortcut hook. */
export interface PanelShortcutsOptions {
  items: TaskView[]
  openNew: () => void
  searchRef: React.RefObject<HTMLInputElement | null>
  onComplete: (task: TaskView) => void
}

/**
 * Bind the panel's keyboard shortcuts.
 * @param options - Rows, the new-task action, the search box and the complete action.
 */
export function usePanelShortcuts(options: PanelShortcutsOptions): void {
  const { items, openNew, searchRef, onComplete } = options

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        openNew()
      } else if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const rows = [...document.querySelectorAll<HTMLElement>('[data-testid="task-row"]')]
        if (rows.length === 0) return
        event.preventDefault()
        const active = document.activeElement as HTMLElement | null
        const index = active === null ? -1 : rows.indexOf(active)
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = index === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, index + delta))
        rows[next]?.focus()
      } else if (event.key === ' ') {
        const focused = document.activeElement as HTMLElement | null
        if (focused === null || focused.getAttribute('data-testid') !== 'task-row') return
        const id = focused.getAttribute('data-task-id')
        const task = items.find((entry) => entry.id === id)
        if (task !== undefined) {
          event.preventDefault()
          onComplete(task)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [items, openNew, searchRef, onComplete])
}
