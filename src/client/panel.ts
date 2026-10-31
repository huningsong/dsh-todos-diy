/**
 * The main panel (F8.1–F8.19): header, views, search and the grouped task list.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api, ApiError, type CountsPayload, type NlpParsePayload, type SettingsPayload, type ViewName } from './api'
import { draftFromTask, draftToPayload, emptyDraft, type TaskDraft } from './task-editor'
import { PanelEditor } from './panel-editor'
import { degradedReasonKey, normalizeDegradedReason, type NlpDegradedContext } from './nlp-degraded'
import { PanelToolbar } from './panel-toolbar'
import { ReportModal } from './report-modal'
import { TaskContextMenu } from './panel-menu'
import { TaskRow } from './task-row'
import { SettingsModal } from './settings-modal'
import { TaskHistoryModal } from './task-history'
import { usePanelActions, type ToastState } from './panel-actions'
import { PanelConfirmDelete, PanelToast } from './panel-dialogs'
import { usePanelShortcuts } from './panel-shortcuts'
import { PanelHeader, STAGE_VIEWS, FILTER_VIEWS } from './panel-header'
import { buildExamples } from './examples'
import { TaskList } from './task-list'
import { SearchResultBar } from './search-result-bar'
import { groupTotal, resolveSearchTarget, searchActive, type SearchScope } from './search-scope'
import { createNlpHandlers } from './panel-nlp'
import { fetchNextPage } from './panel-pagination'
import { Modal, PlusGlyph, SearchGlyph, TodoGlyph, browserToday } from './ui'

const h = React.createElement
/** Props injected by the slot system. */
export interface PanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Stored view preference (F8.11) and first-run marker (F8.15). */
const TAB_KEY = 'dsh-todos-diy.tab'
const FIRST_RUN_KEY = 'dsh-todos-diy.firstRun'
const SEARCH_SCOPE_KEY = 'dsh-todos-diy.searchScope'

export function TodoPanel(props: PanelProps) {
  const { t } = props
  const [view, setView] = React.useState<ViewName>(() => {
    const stored = window.localStorage.getItem(TAB_KEY) ?? ''
    return [...STAGE_VIEWS, ...FILTER_VIEWS].some((candidate) => candidate === stored) ? (stored as ViewName) : 'inProgress'
  })
  const [search, setSearch] = React.useState('')
  const [searchScope, setSearchScope] = React.useState<SearchScope>(() =>
    window.localStorage.getItem(SEARCH_SCOPE_KEY) === 'view' ? 'view' : 'all',
  )
  const [groupCounts, setGroupCounts] = React.useState<{ pinned: number; high: number; mid: number; low: number; none: number; paused: number } | null>(null)
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [items, setItems] = React.useState<TaskView[]>([])
  const [counts, setCounts] = React.useState<CountsPayload>({ notStarted: 0, inProgress: 0, overdue: 0, done: 0, paused: 0, recurring: 0 })
  const [totals, setTotals] = React.useState({ once: 0, recurring: 0, done: 0 })
  const [nextTransitionAt, setNextTransitionAt] = React.useState<string | null>(null)
  const [settings, setSettings] = React.useState<SettingsPayload | null>(null)
  const [phase, setPhase] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [errorCode, setErrorCode] = React.useState<string>('internal_error')
  const [editor, setEditor] = React.useState<import('./panel-editor').PanelEditorState | null>(null)
  const [degraded, setDegraded] = React.useState<NlpDegradedContext | null>(null)
  const [nlpHint, setNlpHint] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number; task: TaskView } | null>(null)
  const [toast, setToast] = React.useState<ToastState | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [history, setHistory] = React.useState<TaskView | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<TaskView | null>(null)
  const [firstRun, setFirstRun] = React.useState(false)
  const [readOnly, setReadOnly] = React.useState(false)
  const nlpHandlers = createNlpHandlers({
    t,
    timeZone: settings?.timeZone ?? 'Asia/Shanghai',
    setEditor,
    setDegraded,
    setNlpHint,
  })
  const searchRef = React.useRef<HTMLInputElement | null>(null)
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
        const effective = resolveSearchTarget(target, searchScope, query)
        const snapshot = await api.snapshot(effective, query, controller.signal, 200)
        if (seq !== requestSeqRef.current) return
        setItems(snapshot.items)
        setCounts(snapshot.counts)
        setTotals({ once: snapshot.byKind.once, recurring: snapshot.byKind.recurring, done: snapshot.totalDone })
        setNextTransitionAt(snapshot.nextTransitionAt)
        setGroupCounts(snapshot.groupCounts)
        setNextCursor(snapshot.nextCursor)
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
    [view, search, searchScope],
  )

  const loadMore = React.useCallback(async (): Promise<void> => {
    if (nextCursor === null || loadingMore) return
    setLoadingMore(true)
    try {
      const snapshot = await fetchNextPage({ view, search, searchScope, cursor: nextCursor })
      setItems((current) => [...current, ...snapshot.items])
      setGroupCounts(snapshot.groupCounts)
      setNextCursor(snapshot.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }, [view, search, searchScope, nextCursor, loadingMore])

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
    void load(view, search, true)
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

  React.useEffect(() => {
    window.localStorage.setItem(SEARCH_SCOPE_KEY, searchScope)
    void load(view, search, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchScope])

  React.useEffect(() => {
    if (phase !== 'ready') return
    const seen = window.localStorage.getItem(FIRST_RUN_KEY)
    const total = counts.notStarted + counts.inProgress + counts.overdue + counts.done + counts.recurring + counts.paused
    setFirstRun(seen === null && total === 0)
  }, [phase, counts])

  // F4.13: refresh at the next stage boundary (60 s fallback).
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

  const openNew = (): void => {
    setEditor({ draft: emptyDraft(settings?.timeZone ?? 'Asia/Shanghai'), id: null, revision: null })
  }

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

  const examples = (): ReturnType<typeof buildExamples> => buildExamples(settings?.timeZone ?? 'Asia/Shanghai', t)

  const useExample = (draft: TaskDraft): void => {
    void mutate(async () => {
      await api.create(draftToPayloadOf(draft))
      window.localStorage.setItem(FIRST_RUN_KEY, '1')
    })
  }

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
    searchActive: searchActive(search),
    searchScope,
    onSearchAll: () => setSearchScope('all'),
    groupCounts: groupCounts ?? undefined,
    total: groupCounts === null ? undefined : groupTotal(groupCounts),
    loaded: items.length,
    hasMore: nextCursor !== null,
    loadingMore,
    onLoadMore: () => void loadMore(),
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
      filtersDimmed: searchActive(search) && searchScope === 'all',
    }),
    h(PanelToolbar, {
      t,
      search,
      onSearch: setSearch,
      searchRef,
      searchScope,
      onSearchScope: setSearchScope,
      nlpEnabled: settings?.nlp?.enabled === true,
      timeZone: settings?.timeZone ?? 'Asia/Shanghai',
      onParsed: nlpHandlers.onParsed,
      onDegraded: nlpHandlers.onDegraded,
      nlpHint,
    }),
    h(SearchResultBar, {
      t,
      scope: searchScope,
      query: search,
      count: groupCounts === null ? items.length : groupTotal(groupCounts),
      truncated: nextCursor !== null,
    }),
    h(TaskList, buildTaskListProps()),
    h(PanelEditor, {
      t,
      editor,
      onClose: () => setEditor(null),
      onSaved: () => {
        setEditor(null)
        setDegraded(null)
        setNlpHint(null)
        void load(view, search)
        window.dispatchEvent(new CustomEvent('dsh-todos-diy:changed'))
      },
      onRetryParse: (text: string, signal: AbortSignal) => api.parse(text, signal),
      onDegradedSuccess: () => {
        setDegraded(null)
        setNlpHint(null)
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
          canPin: menu.task.status !== 'done' && menu.task.status !== 'archived',
          canRemind: menu.task.status === 'active',
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
    h(PanelConfirmDelete, { t, task: confirmDelete, onCancel: () => setConfirmDelete(null), onConfirm: (target) => { setConfirmDelete(null); onDelete(target) } }),
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
    h(PanelToast, { t, toast, onUndo: (undo) => { undo(); setToast(null) } }),
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
