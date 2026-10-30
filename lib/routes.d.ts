/**
 * HTTP routes (§7.8), split from `index.ts` so the entry point stays readable.
 *
 * Every route is registered through `ctx.webServer.register({kind:'exact'})` and
 * wrapped by `route()`, which applies the `connection.requestRejection` gate
 * before anything else. Exact routes win over the official `/api` prefix, so
 * skipping that gate would leave the plugin unauthenticated (§4.4).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Repository } from './repo.js';
import type { Store } from './store.js';
import type { HolidayTable } from './rules/holidays.js';
import { type ArchiveFs } from './archive.js';
import { type LoggerLike } from './http.js';
/** Shared state every route needs. */
export interface RouteContext {
    repo: Repository;
    store: Store;
    holidays: HolidayTable;
    logger: LoggerLike;
    /** Effective plugin config (tick interval, zone, grace). */
    config: {
        timeZone: string;
        tickIntervalMs: number;
        graceMinutes: number;
    };
    /** Health snapshot provider from `health.ts`. */
    healthSnapshot: () => unknown;
    /** Today's local date in the global zone. */
    today: () => string;
    /** Current instant; injected for tests. */
    now: () => Date;
    /**
     * Admission gate delegating to `connection.requestRejection` (§4.4). Applied
     * to every route except `/health`, which §7.8 keeps outside the gate.
     */
    gate: (req: IncomingMessage) => 401 | 403 | undefined;
    /**
     * Loopback-only gate used by `/health`: the route is exempt from the login
     * gate, but must still refuse a non-loopback caller so a tunnel cannot read
     * scheduler state.
     */
    loopbackGate: (req: IncomingMessage) => 401 | 403 | undefined;
    /** Archive filesystem seam; defaults to `node:fs` (tests inject a double). */
    archiveFs?: ArchiveFs;
    /** Record the browser Notification capability reported by the client. */
    setSystemNotification?: (granted: boolean) => void;
    /** LLM service for natural-language parsing (F10); absent on old hosts. */
    llm?: unknown;
    /** Default-model service used to pick the parse route (F10). */
    agentDefaultModel?: unknown;
}
/** One route registration. */
export interface RouteDefinition {
    kind: 'exact';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}
/**
 * Build every route.
 * @param ctx - Route context.
 * @returns Route definitions in registration order.
 */
export declare function createRoutes(ctx: RouteContext): RouteDefinition[];
