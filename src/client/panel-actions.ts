/**
 * Panel action helpers: toast, error translation and the mutation wrapper.
 *
 * Split from `panel.ts` (NF5 line budget). The hook owns no state — it borrows
 * the panel's `setToast` and reload callback.
 */

import * as React from 'react'

import { ApiError } from './api'

/** Toast state the panel renders. */
export interface ToastState {
  text: string
  undo?: () => void
}

/** Options for the hook. */
export interface PanelActionsOptions {
  t: (key: string, params?: Record<string, string | number>) => string
  reload: () => Promise<void>
  setToast: React.Dispatch<React.SetStateAction<ToastState | null>>
}

/** The three helpers the panel uses. */
export interface PanelActions {
  showToast(text: string, undo?: () => void): void
  reportError(caught: unknown): void
  mutate(work: () => Promise<unknown>, successText?: string, undo?: () => Promise<unknown>): Promise<void>
}

/**
 * Build the panel's toast/mutation helpers.
 * @param options - Translator, reload callback and toast setter.
 * @returns The helpers.
 */
export function usePanelActions(options: PanelActionsOptions): PanelActions {
  const { t, reload, setToast } = options
  // Every toast timer is tracked so unmounting cannot leave one running (F6.6).
  const timers = React.useRef<number[]>([])
  React.useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer)
      timers.current = []
    }
  }, [])

  const showToast = React.useCallback(
    (text: string, undo?: () => void): void => {
      setToast({ text, ...(undo === undefined ? {} : { undo }) })
      const timer = window.setTimeout(() => setToast(null), undo === undefined ? 2600 : 5000)
      timers.current.push(timer)
    },
    [setToast],
  )

  const reportError = React.useCallback(
    (caught: unknown): void => {
      const code = caught instanceof ApiError ? caught.code : 'internal_error'
      const translated = t(`error.${code}`)
      showToast(t('toast.error', { message: translated === `error.${code}` ? String(caught) : translated }))
    },
    [showToast, t],
  )

  const mutate = React.useCallback(
    async (work: () => Promise<unknown>, successText?: string, undo?: () => Promise<unknown>): Promise<void> => {
      try {
        await work()
        await reload()
        window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
        if (successText !== undefined) {
          showToast(
            successText,
            undo === undefined
              ? undefined
              : () => {
                  void undo().then(reload).catch(reportError)
                },
          )
        }
      } catch (caught) {
        reportError(caught)
      }
    },
    [reload, reportError, showToast],
  )

  return { showToast, reportError, mutate }
}
