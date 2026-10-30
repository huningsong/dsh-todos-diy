/**
 * Applying one scheduler tick to the task list (F5.5 / F6.4 / D-25).
 *
 * Split from `repo.ts` to stay inside the NF5 budget. Pure with respect to the
 * clock: the instant is supplied by the caller.
 */
import type { Task } from './rules/types.js';
import type { TickChange } from './repoTypes.js';
/**
 * Apply one change to a task's state block and return the updated task.
 *
 * A fired occurrence sets the matching node flag — `advance` marks the
 * *advance* flag, because an advance reminder replaces the on-time one but must
 * not claim the natural node was announced (F3.4 / F5.7). A missed occurrence
 * advances the durable watermark so the same backlog is never counted twice
 * (F6.4).
 * @param task - Task before the change.
 * @param change - Scheduler change.
 * @param stamp - Tick instant as ISO, used when the change omits its own time.
 * @returns A new task object.
 */
export declare function applyTickChange(task: Task, change: TickChange, stamp: string): Task;
