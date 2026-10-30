/**
 * Task CRUD routes (§7.8): the read/create/update/mutate endpoints.
 *
 * Split from `routes.ts` to stay inside the NF5 line budget. The helper
 * `taskRoutes(ctx, options)` returns the registrations in the same shape the
 * main route table uses, so `index.ts` registers them uniformly.
 */

import type { ServerResponse } from 'node:http'

import type { Task } from './rules/types.js'
import { route, sendJson } from './http.js'
import { rejectLegacyFields } from './validate.js'
import { nodeArchiveFs } from './archive.js'
import { ok, queryValue, readObjectBody } from './routeKit.js'
import { toTaskView } from './taskView.js'
import type { RouteContext, RouteDefinition } from './routes.js'
import { restoreArchivedTask } from './archiveRestore.js'
import { deliveryRecordsFor } from './delivery.js'
import type { Occurrence } from './rules/types.js'

/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy'

/**
 * Projection options for one task's own time zone.
 * @param ctx - Route context.
 * @returns Projection options.
 */
function optionsFor(ctx: RouteContext): { now: Date; holidays: typeof ctx.holidays } {
  return { now: ctx.now(), holidays: ctx.holidays }
}

/**
 * Read `id` from a body, answering 400 when missing.
 * @param body - Request body.
 * @param res - Response used for the error.
 * @returns The id, or null when missing (a response has been sent).
 */
function requireId(body: Record<string, unknown>, res: ServerResponse): string | null {
  const id = body['id']
  if (typeof id !== 'string' || id === '') {
    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'id is required' } })
    return null
  }
  return id
}

/**
 * Build the task routes.
 * @param ctx - Route context.
 * @param options - Gate holder and logger from `routes.ts`.
 * @returns Route definitions.
 */
export function taskRoutes(
  ctx: RouteContext,
  options: { gate: RouteContext['gate']; logger: RouteContext['logger'] },
): RouteDefinition[] {
  const routes: RouteDefinition[] = [
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/get`,
      handler: route(options, 'GET', async (_req, res, url) => {
        const id = queryValue(url, 'id')
        const task = id === undefined ? null : ctx.repo.get(id)
        if (task === null) {
          sendJson(res, 404, { error: { code: 'not_found', message: 'task not found' } })
          return
        }
        ok(res, toTaskView(task, optionsFor(ctx)))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/create`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        rejectLegacyFields(body)
        const task = await ctx.repo.create({
          title: body['title'] as string,
          description: body['description'] as string | undefined,
          kind: body['kind'] as never,
          rule: body['rule'],
          once: body['once'],
          notify: body['notify'],
          timeZone: body['timeZone'] as string | undefined,
          pinned: body['pinned'] === true,
        })
        ok(res, toTaskView(task, optionsFor(ctx)), 201)
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/update`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = body['id']
        if (typeof id !== 'string') {
          sendJson(res, 400, { error: { code: 'invalid_argument', message: 'id is required' } })
          return
        }
        const revision = Number(body['expectedRevision'])
        if (!Number.isInteger(revision)) {
          sendJson(res, 400, { error: { code: 'invalid_argument', message: 'expectedRevision is required' } })
          return
        }
        const patch = body['patch']
        if (patch !== null && typeof patch === 'object') rejectLegacyFields(patch as Record<string, unknown>)
        const updated = await ctx.repo.update(
          id,
          revision,
          patch !== null && typeof patch === 'object' ? (patch as never) : ({} as never),
        )
        ok(res, toTaskView(updated, optionsFor(ctx)))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/pause`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        ok(res, await ctx.repo.pause(id))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/resume`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        ok(res, await ctx.repo.resume(id))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/complete`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        const occurrenceKey = typeof body['occurrenceKey'] === 'string' ? body['occurrenceKey'] : undefined
        const result = await ctx.repo.complete(id, occurrenceKey)
        ok(res, {
          id,
          completedOccurrenceKey: result.completedOccurrenceKey,
          nextAt: result.nextAt,
        })
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/snooze`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        ok(res, await ctx.repo.snooze(id, Number(body['minutes'])))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/pin`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        ok(res, await ctx.repo.pin(id, body['pinned'] === true))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/remind`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        const task = ctx.repo.get(id)
        if (task === null) {
          sendJson(res, 404, { error: { code: 'not_found', message: `task ${JSON.stringify(id)} was not found` } })
          return
        }
        // F8.14 / §7.8: one immediate reminder. It is a transient occurrence
        // keyed by the send instant, so it neither advances the rule nor marks
        // either node as fired.
        const now = ctx.now()
        const key = `${task.id}@${now.toISOString()}#remind`
        const occurrence: Occurrence = { taskId: task.id, at: now, phase: null, key, kind: task.kind }
        await ctx.repo.recordDeliveries(deliveryRecordsFor(task, occurrence, now))
        ok(res, { id: task.id, occurrenceKey: key })
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/delete`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        const purge = body['purge'] === true
        if (purge && body['confirm'] !== true) {
          sendJson(res, 400, { error: { code: 'invalid_argument', message: 'purge requires confirm: true' } })
          return
        }
        ok(res, await ctx.repo.remove(id, purge))
      }),
    },
    {
      kind: 'exact',
      path: `${PREFIX}/tasks/restore`,
      handler: route(options, 'POST', async (req, res) => {
        const body = await readObjectBody(req)
        const id = requireId(body, res)
        if (id === null) return
        // F4.18: a task archived into a quarterly file is not in the live
        // document, so fall back to moving it back out of the archive.
        const inLive = ctx.repo.get(id) !== null
        if (!inLive) {
          const result = restoreArchivedTask(
            ctx.store.state,
            id,
            ctx.store.paths,
            ctx.archiveFs ?? nodeArchiveFs,
            ctx.now(),
          )
          if (!result.restored) {
            sendJson(res, 404, { error: { code: 'not_found', message: `task ${JSON.stringify(id)} was not found` } })
            return
          }
          ctx.store.set(ctx.store.state)
          ctx.store.flush()
          ok(res, toTaskView(result.task, optionsFor(ctx)))
          return
        }
        const restored = await ctx.repo.restore(id)
        ok(res, toTaskView(restored, optionsFor(ctx)))
      }),
    },
  ]
  return routes
}
