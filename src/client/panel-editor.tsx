/**
 * Editor slot for the panel (extracted from `panel.ts` for the NF5 budget).
 */

import * as React from 'react'

import type { NlpParsePayload } from './api'
import { TaskEditor, type TaskDraft } from './task-editor'
import type { NlpDegradedContext } from './nlp-degraded'

const h = React.createElement

/** Everything the panel keeps about the open editor. */
export interface PanelEditorState {
  draft: TaskDraft
  id: string | null
  revision: number | null
  fieldStatus?: Record<string, 'explicit' | 'default' | 'missing'>
  banner?: string
  degraded?: NlpDegradedContext
}

/** Props for {@link PanelEditor}. */
export interface PanelEditorProps {
  t: (key: string, params?: Record<string, string | number>) => string
  editor: PanelEditorState | null
  onClose: () => void
  onSaved: () => void
  onRetryParse: (text: string, signal: AbortSignal) => Promise<NlpParsePayload>
  onDegradedSuccess: () => void
}

/** Render the task editor when one is open. */
export function PanelEditor(props: PanelEditorProps): React.ReactNode {
  if (props.editor === null) return null
  return h(TaskEditor, {
    initial: props.editor.draft,
    editingId: props.editor.id,
    editingRevision: props.editor.revision,
    fieldStatus: props.editor.fieldStatus,
    banner: props.editor.banner,
    degraded: props.editor.degraded,
    t: props.t,
    onRetryParse: props.onRetryParse,
    onDegradedSuccess: props.onDegradedSuccess,
    onClose: props.onClose,
    onSaved: props.onSaved,
  })
}
