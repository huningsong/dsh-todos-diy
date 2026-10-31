/**
 * Small panel dialogs extracted from `panel.ts` to stay inside the NF5 budget.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import type { ToastState } from './panel-actions'
import { ConfirmDeleteModal } from './confirm-delete'

const h = React.createElement

/** Undoable toast. */
export function PanelToast(props: {
  t: (key: string) => string
  toast: ToastState | null
  onUndo: (undo: () => void) => void
}): React.ReactNode {
  const { toast } = props
  if (toast === null) return null
  return h(
    'div',
    { className: 'dtd-toast', role: 'status' },
    toast.text,
    toast.undo === undefined
      ? null
      : h('button', { type: 'button', onClick: () => props.onUndo(toast.undo as () => void) }, props.t('toast.undo')),
  )
}

/** Delete confirmation. */
export function PanelConfirmDelete(props: {
  t: (key: string) => string
  task: TaskView | null
  onCancel: () => void
  onConfirm: (task: TaskView) => void
}): React.ReactNode {
  if (props.task === null) return null
  return h(ConfirmDeleteModal, {
    title: props.t('confirm.deleteTitle'),
    body: props.t('confirm.deleteBody'),
    okLabel: props.t('confirm.ok'),
    cancelLabel: props.t('confirm.cancel'),
    onCancel: props.onCancel,
    onConfirm: () => props.onConfirm(props.task as TaskView),
  })
}
