/**
 * Archive routes (`/archive/index`, `/archive`, `/archive/run`).
 *
 * Split from `routes.ts` to stay inside the NF5 400-line budget. The helper
 * returns the same `RouteDefinition` shape so `createRoutes` can spread it in.
 */

import { archiveCompleted, nodeArchiveFs, readArchiveIndex, readQuarter } from './archive.js'
import { route, sendJson, type LoggerLike } from './http.js'
import { ok, queryInt, queryValue, readObjectBody } from './routeKit.js'
import type { RouteContext, RouteDefinition } from './routes.js'
import { toTaskViews } from './taskView.js'

/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy'

/** Options shared by every archive route. */
export interface ArchiveRouteOptions {
  gate: (req: import('node:http').IncomingMessage) => 401 | 403 | undefined
  logger?: LoggerLike
}

/**
 * Build the three archive routes.
 * @param ctx - Route context.
 * @param options - Admission gate and logger.
 * @returns Route definitions.
 */
export function archiveRoutes(ctx: RouteContext, options: ArchiveRouteOptions): RouteDefinition[] {
  return [
    {
      kind: 'exact',
      path: `${PREFIX}/archive/index`,
      handler: route(options, 'GET', async (_req, res) => {
        ok(res, readArchiveIndex(ctx.store.paths, ctx.archiveFs ?? nodeArchiveFs, ctx.logger))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/archive`,
      handler: route(options, 'GET', async (_req, res, url) => {
        const quarter = queryValue(url, 'quarter')
        if (quarter === undefined) {
          sendJson(res, 400, { error: { code: 'invalid_argument', message: 'quarter is required' } })
          return
        }
        const found = readQuarter(quarter, ctx.store.paths, ctx.archiveFs ?? nodeArchiveFs)
        if (found === null) {
          sendJson(res, 404, { error: { code: 'not_found', message: `quarter ${quarter} has no archive` } })
          return
        }
        const limit = Math.min(200, Math.max(1, queryInt(url, 'limit') ?? 50))
        const offset = Math.max(0, queryInt(url, 'cursor') === undefined ? 0 : Number(queryValue(url, 'cursor')))
        const page = found.tasks.slice(offset, offset + limit)
        ok(res, {
          items: toTaskViews(page, { now: ctx.now(), holidays: ctx.holidays }),
          nextCursor: offset + limit < found.tasks.length ? String(offset + limit) : null,
          quarter,
        })
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/archive/run`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const quarter = typeof body['quarter'] === 'string' ? body['quarter'] : undefined
        const result = archiveCompleted(ctx.store.state, {
          paths: ctx.store.paths,
          fs: ctx.archiveFs ?? nodeArchiveFs,
          now: ctx.now(),
          timeZone: ctx.config.timeZone,
          logger: ctx.logger,
          ...(quarter === undefined ? {} : { keepQuarter: quarter }),
        })
        if (result.archived.length > 0) {
          ctx.store.set(ctx.store.state)
          ctx.store.flush()
        }
        ok(res, result)
      }),
    },
  ]
}
