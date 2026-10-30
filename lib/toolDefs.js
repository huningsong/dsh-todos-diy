/**
 * The nine `todo_reminder_*` tool definitions (F7.1–F7.13).
 *
 * Split from `tools.ts` (which owns the caller gate, the error translation and
 * the registration effect) to stay inside the NF5 line budget.
 *
 * Every tool is raw JSON Schema, not `defineTool`, so the host half keeps zero
 * `@deepseek-ai/*` runtime imports (§7.10). The descriptions state the time-zone
 * semantics, the cron dialect, the "both nodes remind" rule for one-off tasks,
 * and the pause-vs-complete distinction, and they tell the model not to use the
 * built-in `schedule_*` tools for these tasks (D-19).
 */
import { nextFireAt } from './rules/occurrence.js';
import { toTaskView } from './taskView.js';
import { ValidationError } from './validationError.js';
import { rejectLegacyFields } from './validate.js';
import { assertToolCaller, ToolFailure } from './tools.js';
/**
 * Build the nine tool definitions.
 * @param deps - Repository, holiday table and clock.
 * @returns Registry-ready definitions.
 */
export function createToolDefinitions(deps) {
    const { repo, holidays, timeZone, now } = deps;
    /** Project one task against a single `now`. */
    const view = (task) => toTaskView(task, { now: now(), holidays });
    /** Render one tool result as a JSON text block. */
    const text = (value) => [
        { type: 'text', text: JSON.stringify(value, null, 2) },
    ];
    /** Turn a repository validation failure into a structured tool failure. */
    const translate = (error) => {
        if (error instanceof ValidationError)
            throw new ToolFailure(error.code, error.message, error.details);
        throw error;
    };
    return [
        {
            name: 'todo_reminder_list',
            description: '管理工作待办（非会话提醒）。列出工作待办任务，可按视图/状态/类型/关键字过滤。' +
                '时区：每条任务按其自身 IANA 时区（默认 Asia/Shanghai）计算「今天」与优先级。' +
                '不要用 schedule_* 内置工具管理本插件任务（那是会话内提醒）。',
            parameters: {
                type: 'object',
                properties: {
                    view: {
                        type: 'string',
                        enum: ['notStarted', 'inProgress', 'overdue', 'done', 'recurring', 'paused'],
                        description: '视图，默认 inProgress',
                    },
                    status: { type: 'string', enum: ['active', 'paused', 'done', 'archived'] },
                    kind: { type: 'string', enum: ['recurring', 'once'] },
                    query: { type: 'string', description: '标题/说明模糊搜索' },
                    limit: { type: 'integer', minimum: 1, maximum: 200, description: '默认 50，最大 200' },
                    cursor: { type: 'string' },
                },
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    const result = repo.list({
                        view: args['view'] ?? 'inProgress',
                        status: args['status'],
                        kind: args['kind'],
                        query: typeof args['query'] === 'string' ? args['query'] : undefined,
                        limit: typeof args['limit'] === 'number' ? args['limit'] : undefined,
                        cursor: typeof args['cursor'] === 'string' ? args['cursor'] : undefined,
                    });
                    return {
                        items: result.items.map(view),
                        counts: result.counts,
                        byKind: result.byKind,
                        totalDone: result.totalDone,
                        prioritySummary: result.prioritySummary,
                        nextCursor: result.nextCursor,
                        serverTime: result.serverTime,
                        nextTransitionAt: result.nextTransitionAt,
                    };
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_create',
            description: '管理工作待办（非会话提醒）。创建一条工作待办。循环任务用 rule（preset=workdays/weekly/monthly/custom，' +
                '可带 skipDates/extraWorkdays）；单次任务用 once{startAt,endAt}，**开始和结束都会各提醒一次**（D-03），' +
                'endAt 必填且必须晚于 startAt。cron 为 5 字段 Vixie 方言（拒绝 L/W/#、英文名、宏、6 字段）。' +
                '时区默认 Asia/Shanghai。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', minLength: 1, maxLength: 200 },
                    description: { type: 'string', maxLength: 2000 },
                    kind: { type: 'string', enum: ['recurring', 'once'] },
                    rule: {
                        type: 'object',
                        description: '{preset,time?,weekdays?,monthDays?,cron?,timeZone?,skipDates?,extraWorkdays?}',
                    },
                    once: {
                        type: 'object',
                        description: '{startAt?,endAt,timeZone?}；endAt 必填且是唯一截止时间；startAt 省略时取创建时间且不产生开始提醒',
                    },
                    notify: { type: 'object' },
                    timeZone: { type: 'string' },
                },
                required: ['title', 'kind'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    rejectLegacyFields(args);
                    const task = await repo.create({
                        title: args['title'],
                        description: args['description'],
                        kind: args['kind'],
                        rule: args['rule'],
                        once: args['once'],
                        notify: args['notify'],
                        timeZone: args['timeZone'],
                    });
                    return view(task);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_update',
            description: '管理工作待办（非会话提醒）。修改任务；必须传 expectedRevision（取自 list/get），不匹配返回 conflict。' +
                '可改 title/description/rule/once/notify/pinned。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    expectedRevision: { type: 'integer', minimum: 1 },
                    patch: { type: 'object' },
                },
                required: ['id', 'expectedRevision', 'patch'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    const updated = await repo.update(args['id'], args['expectedRevision'], (args['patch'] ?? {}));
                    return view(updated);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_delete',
            description: '管理工作待办（非会话提醒）。删除任务：默认软删除（进回收站，可 restore）；' +
                'purge=true 彻底删除，需同时传 confirm=true。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    purge: { type: 'boolean', description: '默认 false' },
                    confirm: { type: 'boolean', description: 'purge 时必须为 true' },
                },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    const purge = args['purge'] === true;
                    if (purge && args['confirm'] !== true) {
                        throw new ValidationError('invalid_argument', 'purge requires confirm: true');
                    }
                    return await repo.remove(args['id'], purge);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_pause',
            description: '管理工作待办（非会话提醒）。暂停整条任务：暂停期间不提醒、不算超期、不参与优先级、不计入待办徽标。' +
                '与 complete 的区别：pause 是整条规则挂起，complete 只是跳过本次 occurrence。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    return await repo.pause(args['id']);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_resume',
            description: '管理工作待办（非会话提醒）。恢复已暂停的任务，从下一个未来时刻继续，**不补发**暂停期间的提醒。' +
                '不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    return await repo.resume(args['id']);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_complete',
            description: '管理工作待办（非会话提醒）。「完成本次」：循环任务跳过当前 occurrence 并推进到下一周期（任务仍 active）；' +
                '单次任务直接进入 done。与 pause 不同，这不会挂起整条规则。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    occurrenceKey: { type: 'string', description: '默认使用该任务当前 occurrence' },
                },
                required: ['id'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    const id = args['id'];
                    const key = typeof args['occurrenceKey'] === 'string' ? args['occurrenceKey'] : undefined;
                    const result = await repo.complete(id, key);
                    const next = result.task.status === 'active' ? nextFireAt(result.task, now(), holidays) : null;
                    return { id, completedOccurrenceKey: result.completedOccurrenceKey, nextAt: next === null ? null : next.toISOString() };
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_snooze',
            description: '管理工作待办（非会话提醒）。「稍后提醒」：minutes 1–1440，只对当前 occurrence 生效，不改变原规则。' +
                '不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    minutes: { type: 'integer', minimum: 1, maximum: 1440 },
                },
                required: ['id', 'minutes'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    return await repo.snooze(args['id'], args['minutes']);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
        {
            name: 'todo_reminder_pin',
            description: '管理工作待办（非会话提醒）。置顶/取消置顶。置顶任务永远在待办最上方，超期也不下沉（D-21）；' +
                '完成时自动取消置顶。不要用 schedule_* 内置工具管理本插件任务。',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    pinned: { type: 'boolean' },
                },
                required: ['id', 'pinned'],
                additionalProperties: false,
            },
            output: { schema: { type: 'object' }, render: (_args, value) => text(value) },
            async execute(args, exec) {
                assertToolCaller(exec);
                try {
                    return await repo.pin(args['id'], args['pinned'] === true);
                }
                catch (error) {
                    return translate(error);
                }
            },
        },
    ];
}
