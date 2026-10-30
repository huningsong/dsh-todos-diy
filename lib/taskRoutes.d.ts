/**
 * Task CRUD routes (§7.8): the read/create/update/mutate endpoints.
 *
 * Split from `routes.ts` to stay inside the NF5 line budget. The helper
 * `taskRoutes(ctx, options)` returns the registrations in the same shape the
 * main route table uses, so `index.ts` registers them uniformly.
 */
import type { RouteContext, RouteDefinition } from './routes.js';
/**
 * Build the task routes.
 * @param ctx - Route context.
 * @param options - Gate holder and logger from `routes.ts`.
 * @returns Route definitions.
 */
export declare function taskRoutes(ctx: RouteContext, options: {
    gate: RouteContext['gate'];
    logger: RouteContext['logger'];
}): RouteDefinition[];
