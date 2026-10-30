/**
 * The main panel (F8.1–F8.15): header → view tabs → priority strip → search →
 * grouped task list. Clicking a row opens the editor; hover controls cover the
 * three frequent row actions.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api, ApiError, type CountsPayload, type SettingsPayload, type ViewName } from './api'
import { TaskEditor, draftFromTask, draftToPayload, emptyDraft, type TaskDraft } from './task-editor'
import { TaskRow } from './task-row'
import { SettingsModal } from './settings-modal'
import { TaskHistoryModal } from './task-history'
import { usePanelActions, type ToastState } from './panel-actions'
import { ConfirmDeleteModal } from './confirm-delete'
import { usePanelShortcuts } from './panel-shortcuts'
import { PanelHeader, STAGE_VIEWS, FILTER_VIEWS } from './panel-header'
import { buildExamples } from './examples'
import { TaskList } from './task-list'
import {
  ContextMenu,
  Modal,
  PlusGlyph,
  SearchGlyph,
  TodoGlyph,
  browserToday,
} from './ui'

const h = React.createElement



/** Props injected by the slot system. */
export interface PanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Stored view preference (F8.11) and first-run marker (F8.15). */
const TAB_KEY = 'dsh-todos-diy.tab'
const FIRST_RUN_KEY = 'dsh-todos-diy.firstRun'

/** The main panel component. */
export function TodoPanel(props: PanelProps) {
  const { t } = props
  const [view, setView] = React.useState<ViewName>(() => {
    const stored = window.localStorage.getItem(TAB_KEY)
    return [...STAGE_VIEWS, ...FILTER_VIEWS].includes(stored as ViewName) ? (stored as ViewName) : 'inProgress'
  })
  const [search, setSearch] = React.useState('')
  const [items, setItems] = React.useState<TaskView[]>([])
  const [counts, setCounts] = React.useState<CountsPayload>({ notStarted: 0, inProgress: 0, overdue: 0, done: 0, paused: 0, recurring: 0 })
  const [totals, setTotals] = React.useState({ once: 0, recurring: 0, done: 0 })
  const [nextTransitionAt, setNextTransitionAt] = React.useState<string | null>(null)
  const [settings, setSettings] = React.useState<SettingsPayload | null>(null)
  const [phase, setPhase] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [errorCode, setErrorCode] = React.useState<string>('internal_error')
  const [editor, setEditor] = React.useState<{ draft: TaskDraft; id: string | null; revision: number | null } | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number; task: TaskView } | null>(null)
  const [toast, setToast] = React.useState<ToastState | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [history, setHistory] = React.useState<TaskView | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<TaskView | null>(null)
  const [firstRun, setFirstRun] = React.useState(false)
  const [readOnly, setReadOnly] = React.useState(false)
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
        setTotals({ once: snapshot.byKind.once, recurring: snapshot.byKind.recurring, done: snapshot.totalDone })
        setNextTransitionAt(snapshot.nextTransitionAt)
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
    // F6.8 / UX-15: surface a newer-schema file instead of silently pretending
    // the writes work. The health call is cheap and runs once per mount.
    void api
      .health()
      .then((snapshot) => setReadOnly(snapshot.readOnly === true))
      .catch(() => setReadOnly(false))
  }, [])

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
    const total = counts.notStarted + counts.inProgress + counts.overdue + counts.done + counts.recurring + counts.paused
    setFirstRun(seen === null && total === 0)
  }, [phase, counts])

  // F4.13: refresh exactly at the next stage boundary, with a 60 s fallback.
  // One timer only: whichever comes first wins, then the snapshot hands us the
  // following boundary.
  React.useEffect(() => {
    const delay = nextTransitionAt === null
      ? 60_000
      : Math.min(60_000, Math.max(1_000, Date.parse(nextTransitionAt) + 1_000 - Date.now()))
    const timer = window.setTimeout(() => {
      void load(view, search)
    }, delay)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextTransitionAt, view, search])

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

  /** Open the editor for a new task. */
  const openNew = (): void => {
    setEditor({ draft: emptyDraft(settings?.timeZone ?? 'Asia/Shanghai'), id: null, revision: null })
  }

  /** Open the editor for an existing task. */
  const openEdit = (task: TaskView): void => {
    setEditor({ draft: draftFromTask(task, settings?.timeZone ?? 'Asia/Shanghai'), id: task.id, revision: task.revision })
  }

  const { showToast, reportError, mutate } = usePanelActions({
    t,
    reload: () => load(view, search),
    setToast,
  })

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

  usePanelShortcuts({ items, openNew, searchRef, onComplete })

  /** First-run example cards, bound to the current zone and translator. */
  const examples = (): ReturnType<typeof buildExamples> => buildExamples(settings?.timeZone ?? 'Asia/Shanghai', t)

  /** Create one example task in place. */
  const useExample = (draft: TaskDraft): void => {
    void mutate(async () => {
      await api.create(draftToPayloadOf(draft))
      window.localStorage.setItem(FIRST_RUN_KEY, '1')
    })
  }

  /** Assemble the TaskList props once, so the JSX tree stays readable. */
  const buildTaskListProps = (): React.ComponentProps<typeof TaskList> => ({
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
    readOnly,
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
    onRemindNow: (task: TaskView) => void mutate(() => api.remind(task.id), t('toast.reminded')),
    onRestoreArchived: (task: TaskView) => void mutate(() => api.restore(task.id), t('archive.restored')),
  })

  return h(
    'section',
    { className: 'dtd-page', 'aria-label': t('panel.title'), 'data-testid': 'todos-diy-panel' },
    h(PanelHeader, {
      t,
      view,
      counts,
      totals,
      readOnly,
      onSettings: () => setSettingsOpen(true),
      onNew: openNew,
      onSelect: setView,
    }),
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
    h(TaskList, buildTaskListProps()),
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
            {
              // F4.9: duplicate copies the rule/window and notification settings
              // but starts with a clean state block and a new id.
              label: t('task.copy'),
              onSelect: () =>
                void mutate(async () => {
                  const payload = draftToPayloadOf(draftFromTask(menu.task, settings?.timeZone ?? 'Asia/Shanghai'))
                  delete payload['id']
                  await api.create({ ...payload, title: `${menu.task.title} 副本` })
                }),
            },
            {
              // UX-13: a one-shot "remind me now" to verify a rule quickly.
              label: t('task.remindNow'),
              onSelect: () => void mutate(() => api.snooze(menu.task.id, 1)),
            },
            {
              // F4.19/F8.14: history is the delivery log filtered to this task.
              label: t('task.history'),
              onSelect: () => setHistory(menu.task),
            },
            { label: t('task.delete'), danger: true, onSelect: () => setConfirmDelete(menu.task) },
          ],
        }),
    history === null ? null : h(TaskHistoryModal, { task: history, t, onClose: () => setHistory(null) }),
    confirmDelete === null
      ? null
      : h(ConfirmDeleteModal, {
          title: t('confirm.deleteTitle'),
          body: t('confirm.deleteBody'),
          okLabel: t('confirm.ok'),
          cancelLabel: t('confirm.cancel'),
          onCancel: () => setConfirmDelete(null),
          onConfirm: () => {
            const target = confirmDelete
            setConfirmDelete(null)
            if (target !== null) onDelete(target)
          },
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
