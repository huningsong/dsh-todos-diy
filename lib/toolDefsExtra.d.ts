/**
 * The 0.2.1 Agent tools: get / remind / deliveries (F7.14, F7.17).
 *
 * Split from `toolDefs.ts` to stay inside the NF5 line budget. They share the
 * same helpers as the core tools, passed in so this module owns no state.
 */
import type { Repository } from './repo.js';
import type { Task } from './rules/types.js';
import { type RawToolDefinition } from './tools.js';
/** Helpers borrowed from the core definitions. */
export interface ExtraToolDeps {
    repo: Repository;
    now: () => Date;
    view: (task: Task) => unknown;
    translate: (error: unknown) => unknown;
}
/**
 * Build the extra tool definitions.
 * @param deps - Repository, clock and the shared projection/error helpers.
 * @returns Three registry-ready definitions.
 */
export declare function extraToolDefinitions(deps: ExtraToolDeps): RawToolDefinition[];
