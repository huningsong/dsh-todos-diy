/**
 * `POST /parse` — natural-language task parsing (F10.1/F10.5).
 *
 * The route is inert until the user turns the feature on: the settings flag is
 * the consent gate, and everything else degrades to a plain form.
 */

import { route, sendJson } from '../http.js'
import { ok, readObjectBody } from '../routeKit.js'
import { ValidationError } from '../validationError.js'
import { degradedResult, parseTaskText } from './parse.js'
import type { NlpLlm, NlpSelection } from './types.js'
import type { RouteContext, RouteDefinition } from '../routes.js'

/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy'

/** The LLM-shaped slice of the DSH context (absent on very old hosts). */
export interface NlpHost {
  llm?: NlpLlm & {
    listProviders?: () => { id: string; name: string }[]
    listModels?: (provider: string) => Promise<{ id: string; name: string }[]>
  }
  agentDefaultModel?: { currentSelection?: () => { provider?: string; model?: string } | null }
}

/**
 * Resolve the provider/model route.
 * @param host - LLM services from the context.
 * @returns A usable selection, or undefined when no model route exists.
 */
export async function resolveSelection(host: NlpHost): Promise<NlpSelection | undefined> {
  try {
    const selection = host.agentDefaultModel?.currentSelection?.()
    if (selection?.provider !== undefined && selection.model !== undefined) {
      return { provider: selection.provider, model: selection.model }
    }
    const provider = host.llm?.listProviders?.()[0]
    if (provider === undefined) return undefined
    const models = await host.llm?.listModels?.(provider.id)
    const model = models?.[0]
    return model === undefined ? undefined : { provider: provider.id, model: model.id }
  } catch {
    // A host without a configured model route must degrade, not 500.
    return undefined
  }
}

/**
 * Build the parse route.
 * @param ctx - Route context carrying repo/clock plus optional LLM services.
 * @returns One route definition.
 */
export function createNlpRoutes(ctx: RouteContext): RouteDefinition[] {
  return [
    {
      kind: 'exact',
      path: `${PREFIX}/parse`,
      handler: route({ gate: ctx.gate, logger: ctx.logger }, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        if (ctx.repo.settings().nlp.enabled !== true) {
          throw new ValidationError('nlp_disabled', 'natural-language parsing is turned off in settings')
        }
        const text = body['text']
        if (typeof text !== 'string' || text.trim() === '' || text.length > 500) {
          throw new ValidationError('invalid_argument', 'text must be 1–500 characters', { field: 'text' })
        }
        const host = ctx as unknown as NlpHost
        try {
          const selection = await resolveSelection(host)
          ctx.logger.info?.(`${PREFIX} parse: llm=${String(host.llm !== undefined)} selection=${selection === undefined ? 'none' : `${selection.provider}/${selection.model}`}`)
          const result = await parseTaskText({
            text: text.trim(),
            now: ctx.now(),
            timeZone: ctx.repo.settings().timeZone,
            llm: host.llm,
            selection,
          })
          sendJson(res, 200, okEnvelope(result))
        } catch (error) {
          // F10.5: parsing must never surface a 500 — fall back to the plain form.
          ctx.logger.warn?.(`${PREFIX} parse failed: ${error instanceof Error ? error.message : String(error)}`)
          sendJson(res, 200, okEnvelope(degradedResult(text.trim(), ctx.repo.settings().timeZone, 'llm_unavailable')))
        }
      }),
    },
  ]
}

/**
 * Wrap a parse result in the standard success envelope.
 * @param value - Parse result.
 * @returns Envelope object.
 */
function okEnvelope(value: unknown): unknown {
  return { ok: true, value }
}

/** Re-exported so tests can build the same shape without HTTP. */
export { ok, sendJson }
