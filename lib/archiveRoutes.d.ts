/**
 * Archive routes (`/archive/index`, `/archive`, `/archive/run`).
 *
 * Split from `routes.ts` to stay inside the NF5 400-line budget. The helper
 * returns the same `RouteDefinition` shape so `createRoutes` can spread it in.
 */
import { type LoggerLike } from './http.js';
import type { RouteContext, RouteDefinition } from './routes.js';
/** Options shared by every archive route. */
export interface ArchiveRouteOptions {
    gate: (req: import('node:http').IncomingMessage) => 401 | 403 | undefined;
    logger?: LoggerLike;
}
/**
 * Build the three archive routes.
 * @param ctx - Route context.
 * @param options - Admission gate and logger.
 * @returns Route definitions.
 */
export declare function archiveRoutes(ctx: RouteContext, options: ArchiveRouteOptions): RouteDefinition[];
