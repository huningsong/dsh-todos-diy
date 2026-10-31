/**
 * NLP handler assembly for the panel (F10.11) — extracted for the NF5 budget.
 */

import type { NlpParsePayload } from './api'
import { degradedReasonKey, normalizeDegradedReason, type NlpDegradedContext } from './nlp-degraded'
import { emptyDraft, type TaskDraft } from './task-draft'
import type { PanelEditorState } from './panel-editor'

/** Dependencies used to build the handlers. */
export interface NlpHandlerDeps {
  t: (key: string, params?: Record<string, string | number>) => string
  timeZone: string
  setEditor: (editor: PanelEditorState | null) => void
  setDegraded: (context: NlpDegradedContext | null) => void
  setNlpHint: (hint: string | null) => void
}

/** Handlers passed to `PanelToolbar`. */
export interface NlpHandlers {
  onParsed: (draft: TaskDraft, result: NlpParsePayload) => void
  onDegraded: (context: { text: string; reason: string }) => void
}

/**
 * Build the parsed/degraded handlers.
 * @param deps - Panel state setters and translator.
 * @returns The two callbacks.
 */
export function createNlpHandlers(deps: NlpHandlerDeps): NlpHandlers {
  return {
    onParsed: (draft, result) => {
      deps.setDegraded(null)
      deps.setNlpHint(null)
      deps.setEditor({
        draft,
        id: null,
        revision: null,
        fieldStatus: result.fieldStatus,
        banner:
          result.missingRequired.length > 0
            ? deps.t('nlp.missing', { fields: result.missingRequired.join('、') })
            : deps.t('nlp.banner'),
      })
    },
    onDegraded: (context) => {
      const reason = normalizeDegradedReason(context.reason)
      deps.setDegraded({ text: context.text, reason })
      deps.setNlpHint(`${deps.t('nlp.degraded.title')} · ${deps.t(degradedReasonKey(reason))}`)
      deps.setEditor({
        draft: { ...emptyDraft(deps.timeZone), kind: 'once', title: context.text.slice(0, 200), startAtSource: 'created' },
        id: null,
        revision: null,
        degraded: { text: context.text, reason },
      })
    },
  }
}
