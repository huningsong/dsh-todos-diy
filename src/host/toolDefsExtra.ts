/**
 * The 0.2.1 Agent tools: get / remind / deliveries (F7.14, F7.17).
 *
 * Split from `toolDefs.ts` to stay inside the NF5 line budget. They share the
 * same helpers as the core tools, passed in so this module owns no state.
 */

import { deliveryRecordsFor } from './delivery.js'
import type { Repository } from './repo.js'
import type { Task } from './rules/types.js'
import type { Occurrence } from './rules/types.js'
import { ValidationError } from './validationError.js'
import { assertToolCaller, type RawToolDefinition, type ToolExec } from './tools.js'

/** Helpers borrowed from the core definitions. */
export interface ExtraToolDeps {
  repo: Repository
  now: () => Date
  view: (task: Task) => unknown
  translate: (error: unknown) => unknown
}

/**
 * Build the extra tool definitions.
 * @param deps - Repository, clock and the shared projection/error helpers.
 * @returns Three registry-ready definitions.
 */
export function extraToolDefinitions(deps: ExtraToolDeps): RawToolDefinition[] {
  const { repo, now, view, translate } = deps
  /** Render a successful value as a JSON text block. */
  const text = (value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  return [
    {
      name: 'todo_reminder_get',
      description:
        '管理工作待办（非会话提醒）。按 id 读取单条任务，返回 TaskView（含 revision）。' +
        '先用它可以拿到最新 revision 再 update，避免 list → 猜 revision 的竞态（F7.14）。' +
        '不要用 schedule_* 内置工具管理本插件任务。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
      async execute(args: Record<string, unknown>, exec: ToolExec) {
        assertToolCaller(exec)
        try {
          const id = args['id'] as string
          const task = repo.get(id)
          if (task === null) {
            throw new ValidationError('not_found', `task ${JSON.stringify(id)} was not found`)
          }
          return view(task)
        } catch (error) {
          return translate(error)
        }
      },
    },
    {
      name: 'todo_reminder_remind',
      description:
        '管理工作待办（非会话提醒）。立即提醒一次（不等原规则）。只写一条临时投递记录，' +
        '不推进原规则、不修改 fired/lastOccurrenceKey（F7.17）。不要用 schedule_* 内置工具管理本插件任务。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
      async execute(args: Record<string, unknown>, exec: ToolExec) {
        assertToolCaller(exec)
        try {
          const id = args['id'] as string
          const task = repo.get(id)
          if (task === null) {
            throw new ValidationError('not_found', `task ${JSON.stringify(id)} was not found`)
          }
          const stamp = now()
          const occurrence: Occurrence = {
            taskId: task.id,
            at: stamp,
            phase: null,
            key: `${task.id}@${stamp.toISOString()}#remind`,
            kind: task.kind,
          }
          await repo.recordDeliveries(deliveryRecordsFor(task, occurrence, stamp))
          return { id: task.id, occurrenceKey: occurrence.key, deliveredAt: stamp.toISOString() }
        } catch (error) {
          return translate(error)
        }
      },
    },
    {
      name: 'todo_reminder_deliveries',
      description:
        '管理工作待办（非会话提醒）。查询投递/回执历史，可按 taskId 过滤，按时间倒序分页（F7.17）。' +
        '不要用 schedule_* 内置工具管理本插件任务。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 200, description: '默认 50' },
          cursor: { type: 'string', description: '上一页返回的 nextCursor（数字偏移）' },
        },
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
      async execute(args: Record<string, unknown>, exec: ToolExec) {
        assertToolCaller(exec)
        try {
          const taskId = typeof args['taskId'] === 'string' ? args['taskId'] : undefined
          if (taskId !== undefined && repo.get(taskId) === null) {
            throw new ValidationError('not_found', `task ${JSON.stringify(taskId)} was not found`)
          }
          const limit = Math.min(200, Math.max(1, typeof args['limit'] === 'number' ? Math.trunc(args['limit']) : 50))
          const offset = Math.max(0, typeof args['cursor'] === 'string' ? Number(args['cursor']) || 0 : 0)
          const all = [...repo.deliveries()].reverse()
          const scoped = taskId === undefined ? all : all.filter((record) => record.occurrenceKey.startsWith(`${taskId}@`))
          return {
            items: scoped.slice(offset, offset + limit),
            nextCursor: offset + limit < scoped.length ? String(offset + limit) : null,
            total: scoped.length,
          }
        } catch (error) {
          return translate(error)
        }
      },
    }
  ]
}
