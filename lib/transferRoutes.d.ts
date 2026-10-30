/**
 * Import / export routes (§7.8 / F9.4).
 *
 * Split from `routes.ts` to stay inside the NF5 budget. Export serializes the
 * whole document; import validates first, backs the live file up, and only then
 * mutates memory.
 */
import type { RouteContext, RouteDefinition } from './routes.js';
/**
 * Build the import/export routes.
 * @param ctx - Route context.
 * @param options - Admission gate and logger.
 * @returns Route definitions.
 */
export declare function transferRoutes(ctx: RouteContext, options: {
    gate: RouteContext['gate'];
    logger: RouteContext['logger'];
}): RouteDefinition[];
