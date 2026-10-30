/**
 * The main panel (F8.1–F8.15).
 *
 * Structure: header → three view tabs with badges → the always-visible priority
 * rule strip → toolbar (search) → grouped task list. Clicking a row opens the
 * editor; the row's hover controls cover the three frequent actions.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api, ApiError, type SettingsPayload } from './api'
import { TaskEditor, draftFromTask, draftToPayload, emptyDraft, type TaskDraft } from './task-editor'
import { TaskRow } from './task-row'
import { SettingsModal } from './settings-modal'
import { buildExamples } from './examples'
import { TaskList } from './task-list'
import {
  ContextMenu,
  Modal,
  PlusGlyph,
  SearchGlyph,
  TodoGlyph,
  browserToday,
  dayDiff,
} from './ui'

const h = React.createElement

type ViewName = 'todo' | 'done' | 'overdue'

/** Props injected by the slot system. */
export interface PanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** The stored view preference key (F8.11: the tab survives a refresh). */
const TAB_KEY = 'dsh-todos-diy.tab'

/** The "seen the example cards" key (F8.15). */
const FIRST_RUN_KEY = 'dsh-todos-diy.firstRun'

/** The main panel component. */
export function TodoPanel(props: PanelProps) {
  const { t } = props
  const [view, setView] = React.useState<ViewName>(() => {
    const stored = window.localStorage.getItem(TAB_KEY)
    return stored === 'done' || stored === 'overdue' ? stored : 'todo'
  })
  const [search, setSearch] = React.useState('')
  const [items, setItems] = React.useState<TaskView[]>([])
  const [counts, setCounts] = React.useState({ todo: 0, done: 0, overdue: 0 })
  const [settings, setSettings] = React.useState<SettingsPayload | null>(null)
  const [phase, setPhase] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [errorCode, setErrorCode] = React.useState<string>('internal_error')
  const [editor, setEditor] = React.useState<{ draft: TaskDraft; id: string | null; revision: number | null } | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number; task: TaskView } | null>(null)
  const [toast, setToast] = React.useState<{ text: string; undo?: () => void } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [firstRun, setFirstRun] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement | null>(null)

  const today = browserToday()

  /** Reload the current view. */
  const load = React.useCallback(
    async (target: ViewName = view, query: string = search): Promise<void> => {
      setPhase((current) => (current === 'ready' ? current : 'loading'))
      try {
        const snapshot = await api.snapshot(target, query)
        setItems(snapshot.items)
        setCounts(snapshot.counts)
        setSettings(snapshot.settings)
        setPhase('ready')
      } catch (caught) {
        setErrorCode(caught instanceof ApiError ? caught.code : 'internal_error')
        setPhase('error')
      }
    },
    [view, search],
  )

  React.useEffect(() => {
    void load(view, '')
    // The initial load must not re-run on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(view, search)
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  React.useEffect(() => {
    window.localStorage.setItem(TAB_KEY, view)
  }, [view])

  // First-run example cards (F8.15) only when the list is empty and unseen.
  React.useEffect(() => {
    if (phase !== 'ready') return
    const seen = window.localStorage.getItem(FIRST_RUN_KEY)
    const total = counts.todo + counts.done + counts.overdue
    setFirstRun(seen === null && total === 0)
  }, [phase, counts])

  // Global refresh signal from the overlay (an ack changes the lists).
  React.useEffect(() => {
    const handler = (): void => {
      void load(view, search)
    }
    window.addEventListener('dsh-todos-diy:changed', handler)
    window.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('dsh-todos-diy:changed', handler)
      window.removeEventListener('visibilitychange', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search])

  // Page-level shortcuts (UX-18: in-page only, never global).
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        openNew()
      } else if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  /** Open the editor for a new task. */
  const openNew = (): void => {
    setEditor({ draft: emptyDraft(settings?.timeZone ?? 'Asia/Shanghai'), id: null, revision: null })
  }

  /** Open the editor for an existing task. */
  const openEdit = (task: TaskView): void => {
    setEditor({ draft: draftFromTask(task, settings?.timeZone ?? 'Asia/Shanghai'), id: task.id, revision: task.revision })
  }

  /** Show a transient toast; an optional undo makes it actionable (UX-02). */
  const showToast = (text: string, undo?: () => void): void => {
    setToast({ text, ...(undo === undefined ? {} : { undo }) })
    window.setTimeout(() => setToast(null), undo === undefined ? 2600 : 5000)
  }

  /** Map an API failure to a translated toast. */
  const reportError = (caught: unknown): void => {
    const code = caught instanceof ApiError ? caught.code : 'internal_error'
    const translated = t(`error.${code}`)
    showToast(t('toast.error', { message: translated === `error.${code}` ? String(caught) : translated }))
  }

  /** Run one mutation and refresh. */
  const mutate = async (work: () => Promise<unknown>, successText?: string, undo?: () => Promise<unknown>): Promise<void> => {
    try {
      await work()
      await load(view, search)
      window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
      if (successText !== undefined) {
        showToast(
          successText,
          undo === undefined
            ? undefined
            : () => {
                void undo().then(() => load(view, search)).catch(reportError)
              },
        )
      }
    } catch (caught) {
      reportError(caught)
    }
  }

  const onComplete = (task: TaskView): void => {
    const previousStatus = task.status
    void mutate(
      () => api.complete(task.id),
      t('toast.completed'),
      previousStatus === 'done' ? undefined : () => api.restore(task.id),
    )
  }

  const onDelete = (task: TaskView): void => {
    void mutate(() => api.remove(task.id), t('toast.deleted'), () => api.restore(task.id))
  }

  /** First-run example cards, bound to the current zone and translator. */
  const examples = (): ReturnType<typeof buildExamples> => buildExamples(settings?.timeZone ?? 'Asia/Shanghai', t)

  /** Create one example task in place. */
  const useExample = (draft: TaskDraft): void => {
    void mutate(async () => {
      await api.create(draftToPayloadOf(draft))
      window.localStorage.setItem(FIRST_RUN_KEY, '1')
    })
  }

  return h(
    'section',
    { className: 'dtd-page', 'aria-label': t('panel.title'), 'data-testid': 'todos-diy-panel' },
    h(
      'header',
      { className: 'dtd-head' },
      h('div', null, h('h1', null, t('panel.title')), h('p', null, t('panel.subtitle'))),
      h(
        'div',
        { className: 'dtd-actions' },
        h(
          'button',
          { type: 'button', className: 'dtd-btn ghost', 'aria-label': t('panel.settings'), onClick: () => setSettingsOpen(true) },
          t('panel.settings'),
        ),
        h(
          'button',
          { type: 'button', className: 'dtd-btn', onClick: openNew },
          h(PlusGlyph, {}),
          t('panel.new'),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dtd-tabs', role: 'tablist' },
      (['todo', 'done', 'overdue'] as const).map((key) =>
        h(
          'button',
          {
            key,
            type: 'button',
            role: 'tab',
            className: 'dtd-tab',
            'aria-selected': view === key ? 'true' : 'false',
            onClick: () => setView(key),
          },
          t(`tab.${key}`),
          h('span', { className: 'dtd-count', 'aria-hidden': 'true' }, String(counts[key])),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dtd-rules', 'aria-label': t('rule.hint') },
      h('span', null, h('i', { className: 'dtd-dot high' }), t('rule.high')),
      h('span', null, h('i', { className: 'dtd-dot mid' }), t('rule.mid')),
      h('span', null, h('i', { className: 'dtd-dot low' }), t('rule.low')),
      h('span', null, h('i', { className: 'dtd-dot none' }), t('rule.none')),
      h('span', { className: 'refresh' }, t('rule.refresh')),
    ),
    h(
      'div',
      { className: 'dtd-toolbar' },
      h(
        'div',
        { className: 'dtd-search' },
        h(SearchGlyph, {}),
        h('input', {
          ref: searchRef,
          type: 'search',
          value: search,
          placeholder: t('panel.search'),
          'aria-label': t('panel.search'),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
        }),
      ),
    ),
    h(TaskList, {
      view,
      phase,
      errorCode,
      items,
      today,
      t,
      firstRun,
      examples: examples(),
      onRetry: () => void load(view, search),
      onNew: openNew,
      onUseExample: useExample,
      onOpen: openEdit,
      onComplete,
      onPin: (task: TaskView) =>
        void mutate(() => api.pin(task.id, !task.pinned), task.pinned ? t('toast.unpinned') : t('toast.pinned')),
      onPause: (task: TaskView) => void mutate(() => api.pause(task.id), t('toast.paused')),
      onResume: (task: TaskView) => void mutate(() => api.resume(task.id), t('toast.resumed')),
      onMenu: (task: TaskView, x: number, y: number) => setMenu({ x, y, task }),
      onDuplicate: (task: TaskView) =>
        void mutate(async () => {
          const payload = draftToPayloadOf(draftFromTask(task, settings?.timeZone ?? 'Asia/Shanghai'))
          delete payload['id']
          await api.create({ ...payload, title: `${task.title} 副本` })
        }),
      onDelete,
      onRemindNow: (task: TaskView) => void mutate(() => api.snooze(task.id, 1)),
    }),
    editor === null
      ? null
      : h(TaskEditor, {
          initial: editor.draft,
          editingId: editor.id,
          editingRevision: editor.revision,
          t,
          onClose: () => setEditor(null),
          onSaved: () => {
            setEditor(null)
            void load(view, search)
            window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
          },
        }),
    menu === null
      ? null
      : h(ContextMenu, {
          x: menu.x,
          y: menu.y,
          onClose: () => setMenu(null),
          items: [
            { label: t('task.edit'), onSelect: () => openEdit(menu.task) },
            { label: t('task.copy'), onSelect: () => undefined },
            { label: t('task.remindNow'), onSelect: () => undefined },
            { label: t('task.history'), onSelect: () => undefined },
            { label: t('task.delete'), danger: true, onSelect: () => onDelete(menu.task) },
          ],
        }),
    settingsOpen
      ? h(SettingsModal, {
          t,
          initial: settings,
          onClose: () => setSettingsOpen(false),
          onSaved: (next) => {
            setSettings(next)
            setSettingsOpen(false)
            void load(view, search)
          },
        })
      : null,
    toast === null
      ? null
      : h(
          'div',
          { className: 'dtd-toast', role: 'status' },
          toast.text,
          toast.undo === undefined
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    toast.undo?.()
                    setToast(null)
                  },
                },
                t('toast.undo'),
              ),
        ),
  )
}

/**
 * Convert a draft to a payload.
 *
 * Delegates to the editor's converter so there is exactly one place that maps
 * form fields onto the API body.
 * @param draft - Form state.
 * @returns Request body.
 */
function draftToPayloadOf(draft: TaskDraft): Record<string, unknown> {
  return draftToPayload(draft)
}


export { dayDiff }
