/**
 * The eleven `todo_reminder_*` tool definitions (F7.1–F7.18).
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
import type { Repository } from './repo.js';
import type { HolidayTable } from './rules/holidays.js';
import { type RawToolDefinition } from './tools.js';
/** Everything the definitions need to answer. */
export interface ToolDeps {
    repo: Repository;
    holidays: HolidayTable;
    /** Effective default time zone. */
    timeZone: string;
    /** Current instant; injected for tests. */
    now: () => Date;
}
/**
 * Build the core tool definitions (nine) plus the extra ones from `toolDefsExtra`.
 * @param deps - Repository, holiday table and clock.
 * @returns Registry-ready definitions.
 */
export declare function createToolDefinitions(deps: ToolDeps): RawToolDefinition[];
