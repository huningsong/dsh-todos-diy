/**
 * The main panel (F8.1–F8.15): header → view tabs → priority strip → search →
 * grouped task list. Clicking a row opens the editor; hover controls cover the
 * three frequent row actions.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api, ApiError, type CountsPayload, type NlpParsePayload, type SettingsPayload, type ViewName } from './api'
import { TaskEditor, draftFromTask, draftToPayload, emptyDraft, type TaskDraft } from './task-editor'
import { PanelToolbar } from './panel-toolbar'
import { ReportModal } from './report-modal'
import { TaskContextMenu } from './panel-menu'
import { TaskRow } from './task-row'
import { SettingsModal } from './settings-modal'
import { TaskHistoryModal } from './task-history'
import { usePanelActions, type ToastState } from './panel-actions'
import { ConfirmDeleteModal } from './confirm-delete'
import { usePanelShortcuts } from './panel-shortcuts'
import { PanelHeader, STAGE_VIEWS, FILTER_VIEWS } from './panel-header'
import { buildExamples } from './examples'
import { TaskList } from './task-list'
import { Modal, PlusGlyph, SearchGlyph, TodoGlyph, browserToday } from './ui'

const h = React.createElement

/** Props injected by the slot system. */
export interface PanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Stored view preference (F8.11) and first-run marker (F8.15). */
const TAB_KEY = 'dsh-todos-diy.tab'
const FIRST_RUN_KEY = 'dsh-todos-diy.firstRun'

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
  const [editor, setEditor] = React.useState<{
    draft: TaskDraft
    id: string | null
    revision: number | null
    fieldStatus?: Record<string, 'explicit' | 'default' | 'missing'>
    banner?: string
  } | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number; task: TaskView } | null>(null)
  const [toast, setToast] = React.useState<ToastState | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [history, setHistory] = React.useState<TaskView | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<TaskView | null>(null)
  const [firstRun, setFirstRun] = React.useState(false)
  const [readOnly, setReadOnly] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  // FIX-01: only the newest snapshot may update the panel. Without this a slow
  // response for the previous tab can land after the new one and leave a badge
  // count with an empty list.
  const requestSeqRef = React.useRef(0)
  const abortRef = React.useRef<AbortController | null>(null)

  const today = browserToday()

  /**
   * Reload the current view.
   * @param target - View to request.
   * @param query - Search text.
   * @param showSkeleton - True when the switch itself should show the loading
   *   skeleton (user changed tab/search); background refreshes keep the list.
   */
  const load = React.useCallback(
    async (target: ViewName = view, query: string = search, showSkeleton = false): Promise<void> => {
      const seq = requestSeqRef.current + 1
      requestSeqRef.current = seq
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      if (showSkeleton) setPhase('loading')
      try {
        const snapshot = await api.snapshot(target, query, controller.signal)
        if (seq !== requestSeqRef.current) return
        setItems(snapshot.items)
        setCounts(snapshot.counts)
        setTotals({ once: snapshot.byKind.once, recurring: snapshot.byKind.recurring, done: snapshot.totalDone })
        setNextTransitionAt(snapshot.nextTransitionAt)
        setSettings(snapshot.settings)
        setPhase('ready')
      } catch (caught) {
        if (seq !== requestSeqRef.current) return
        if (caught instanceof ApiError && caught.code === 'network_error' && controller.signal.aborted) return
        const code = caught instanceof ApiError ? caught.code : 'internal_error'
        // The snapshot rejects `view` with `invalid_argument` only when the
        // host half is an older build that does not know the six views: DSH
        // loads the host at startup, so the fix is a restart, not a retry.
        setErrorCode(code === 'invalid_argument' ? 'host_too_old' : code)
        setPhase('error')
      }
    },
    [view, search],
  )

  React.useEffect(() => {
    return () => {
      // Never let an in-flight snapshot write into an unmounted panel.
      abortRef.current?.abort()
    }
  }, [])

  React.useEffect(() => {
    // F6.8 / UX-15: surface a newer-schema file instead of silently pretending
    // the writes work. The health call is cheap and runs once per mount.
    void api
      .health()
      .then((snapshot) => setReadOnly(snapshot.readOnly === true))
      .catch(() => setReadOnly(false))
  }, [])

  React.useEffect(() => {
    void load(view, '', true)
    // The initial load must not re-run on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(view, search, true)
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
    // FIX-05 / F7.18: a recurring task that has never fired has no current
    // occurrence; "complete" means "skip the next run" rather than an error.
    const skipNext = task.kind === 'recurring' && task.state.lastOccurrenceKey === null
    void mutate(
      () => api.complete(task.id, undefined, skipNext),
      skipNext ? t('toast.skippedNext') : t('toast.completed'),
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
    search,
    today,
    t,
    firstRun,
    examples: examples(),
    onRetry: () => void load(view, search),
    onNew: openNew,
    onClearSearch: () => setSearch(''),
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
        await api.create({ ...payload, title: `${task.title}${t('task.copySuffix')}` })
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
      onReport: () => setReportOpen(true),
      onNew: openNew,
      onSelect: setView,
    }),
    h(PanelToolbar, {
      t,
      search,
      onSearch: setSearch,
      searchRef,
      nlpEnabled: settings?.nlp?.enabled === true,
      timeZone: settings?.timeZone ?? 'Asia/Shanghai',
      onParsed: (draft: TaskDraft, result: NlpParsePayload) =>
        setEditor({
          draft,
          id: null,
          revision: null,
          fieldStatus: result.fieldStatus,
          banner:
            result.missingRequired.length > 0
              ? t('nlp.missing', { fields: result.missingRequired.join('、') })
              : t('nlp.banner'),
        }),
      onDegraded: (text: string) =>
        setEditor({
          draft: { ...emptyDraft(settings?.timeZone ?? 'Asia/Shanghai'), kind: 'once', title: text.slice(0, 200), startAtSource: 'created' },
          id: null,
          revision: null,
        }),
    }),
    h(TaskList, buildTaskListProps()),
    editor === null
      ? null
      : h(TaskEditor, {
          initial: editor.draft,
          editingId: editor.id,
          editingRevision: editor.revision,
          fieldStatus: editor.fieldStatus,
          banner: editor.banner,
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
      : h(TaskContextMenu, {
          t,
          task: menu.task,
          x: menu.x,
          y: menu.y,
          onClose: () => setMenu(null),
          onEdit: () => openEdit(menu.task),
          onPin: () =>
            void mutate(() => api.pin(menu.task.id, !menu.task.pinned), menu.task.pinned ? t('toast.unpinned') : t('toast.pinned')),
          onDuplicate: () =>
            void mutate(async () => {
              const payload = draftToPayloadOf(draftFromTask(menu.task, settings?.timeZone ?? 'Asia/Shanghai'))
              delete payload['id']
              await api.create({ ...payload, title: `${menu.task.title}${t('task.copySuffix')}` })
            }),
          onRemind: () => void mutate(() => api.remind(menu.task.id), t('toast.reminded')),
          onHistory: () => setHistory(menu.task),
          onDelete: () => setConfirmDelete(menu.task),
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
    reportOpen ? h(ReportModal, { t, timeZone: settings?.timeZone ?? 'Asia/Shanghai', onClose: () => setReportOpen(false) }) : null,
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
