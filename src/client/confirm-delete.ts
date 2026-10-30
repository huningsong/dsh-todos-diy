/**
 * Destructive-action confirmation (UX-02 / F8.14).
 *
 * A delete always asks first; the 5-second undo in the toast is the second
 * safety net, not a replacement for the dialog.
 */

import * as React from 'react'

import { Modal } from './ui'

const h = React.createElement

/** Props for the confirmation dialog. */
export interface ConfirmDeleteProps {
  title: string
  body: string
  okLabel: string
  cancelLabel: string
  onCancel: () => void
  onConfirm: () => void
}

/** A small modal asking the user to confirm a destructive action. */
export function ConfirmDeleteModal(props: ConfirmDeleteProps) {
  return h(
    Modal,
    {
      title: props.title,
      onClose: props.onCancel,
      footer: [
        h('button', { key: 'c', type: 'button', className: 'dtd-btn ghost', onClick: props.onCancel }, props.cancelLabel),
        h('button', { key: 'd', type: 'button', className: 'dtd-btn', onClick: props.onConfirm }, props.okLabel),
      ],
    },
    h('p', { className: 'dtd-hint' }, props.body),
  )
}
