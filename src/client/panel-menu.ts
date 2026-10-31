/**
 * Row context menu (F8.14) — extracted from `panel.ts` for the NF5 budget.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { ContextMenu } from './ui'

const h = React.createElement

/** Props for the task context menu. */
export interface TaskContextMenuProps {
  t: (key: string, params?: Record<string, string | number>) => string
  task: TaskView
  x: number
  y: number
  onClose: () => void
  onEdit: () => void
  onPin: () => void
  onDuplicate: () => void
  onRemind: () => void
  onHistory: () => void
  onDelete: () => void
  /** F8.14 + F8.17: keep all six items but disable invalid ones. */
  canPin?: boolean
  canRemind?: boolean
}

/** The row menu. */
export function TaskContextMenu(props: TaskContextMenuProps): React.ReactNode {
  const { t } = props
  return h(ContextMenu, {
    x: props.x,
    y: props.y,
    onClose: props.onClose,
    items: [
      { label: t('task.edit'), onSelect: props.onEdit },
      { label: props.task.pinned ? t('task.unpin') : t('task.pin'), onSelect: props.onPin, disabled: props.canPin === false },
      { label: t('task.copy'), onSelect: props.onDuplicate },
      { label: t('task.remindNow'), onSelect: props.onRemind, disabled: props.canRemind === false },
      { label: t('task.history'), onSelect: props.onHistory },
      { label: t('task.delete'), danger: true, onSelect: props.onDelete },
    ],
  })
}
