/**
 * `GET /reports` — read-only weekly/monthly report (F11.3).
 *
 * The handler loads the main document plus archive quarters, then delegates to
 * the pure `buildReport`. It never calls `touch()`, so asking for a report can
 * never change `tasks.json`.
 */
import type { Task } from './rules/types.js';
import type { RouteContext, RouteDefinition } from './routes.js';
/**
 * Convert a `YYYY-MM-DD` anchor into a local date key, defaulting to today.
 * @param raw - Query value.
 * @param timeZone - Reporting zone.
 * @param now - Clock.
 * @returns Date key.
 */
export declare function resolveAnchor(raw: string | undefined, timeZone: string, now: Date): string;
/**
 * Load every archived task visible in the archive index.
 * @param ctx - Route context.
 * @returns Archived tasks (empty when the archive is unavailable).
 */
export declare function loadArchivedTasks(ctx: RouteContext): Task[];
/**
 * Build the report routes.
 * @param ctx - Route context.
 * @returns One route definition.
 */
export declare function createReportRoutes(ctx: RouteContext): RouteDefinition[];
