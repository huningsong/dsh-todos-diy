/**
 * HTTP plumbing shared by every route: the admission gate, the JSON envelope and
 * the method guard.
 *
 * §4.4 is the reason this module exists: an `exact` route is matched **before**
 * the official `/api` prefix fence, so a plugin route that does not delegate to
 * `connection.requestRejection` would be unauthenticated. The gate here always
 * delegates when the service exists and falls back to a strict loopback check
 * when a headless composition has no `connection`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** Base path of every route this plugin owns. */
export declare const API_PREFIX = "/api/dsh-todos-diy";
/** Minimal logger surface; the Cordis logger satisfies it. */
export interface LoggerLike {
    info?: (message: string) => void;
    warn?: (message: string) => void;
}
/** Admission decision: `undefined` admits, `401`/`403` refuse. */
export type Rejection = 401 | 403 | undefined;
/** Whether a socket address literal is loopback. */
export declare function isLoopbackAddress(address: unknown): boolean;
/**
 * Extract the hostname from a `Host` header (`host[:port]`, IPv6 bracketed).
 * @param host - Raw header value.
 * @returns Lower-cased hostname, or an empty string.
 */
export declare function hostHeaderName(host: unknown): string;
/**
 * Loopback fallback used when the host publishes no `connection` gate.
 *
 * Requires a loopback socket, a loopback `Host`, and a same-origin (or absent)
 * `Sec-Fetch-Site`.
 * @param req - Incoming request.
 * @returns 401/403 to refuse, undefined to admit.
 */
export declare function loopbackRejection(req: IncomingMessage): Rejection;
/**
 * Build the request gate for this plugin instance.
 * @param ctx - Cordis context (used to reach `connection`).
 * @returns Gate function.
 */
export declare function createRequestGate(ctx: {
    get?: (name: string) => unknown;
}): (req: IncomingMessage) => Rejection;
/**
 * Write one JSON response with the plugin envelope.
 * @param res - Response.
 * @param status - HTTP status.
 * @param payload - Body, serialized as-is.
 */
export declare function sendJson(res: ServerResponse, status: number, payload: unknown): void;
/**
 * Write the shared error envelope `{error:{code,message,details?}}`.
 * @param res - Response.
 * @param status - HTTP status.
 * @param code - Machine-readable error code (§7.12).
 * @param message - English diagnostic; clients translate by code.
 * @param details - Optional structured context.
 */
export declare function sendError(res: ServerResponse, status: number, code: string, message: string, details?: unknown): void;
/**
 * Answer a gate refusal: 401 asks for login, 403 blames the origin.
 * @param res - Response.
 * @param status - 401 or 403.
 */
export declare function sendRejection(res: ServerResponse, status: 401 | 403): void;
/** Options shared by every route wrapper. */
export interface RouteOptions {
    gate: (req: IncomingMessage) => Rejection;
    logger?: LoggerLike;
}
/** A route handler body with a pre-parsed URL. */
export type RouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>;
/**
 * Wrap one handler with the admission gate, a method assertion and error
 * containment, so no route can forget any of the three.
 * @param options - Gate and logger.
 * @param method - Required HTTP method.
 * @param handler - Route body.
 * @returns A raw `node:http` request listener.
 */
export declare function route(options: RouteOptions, method: string, handler: RouteHandler): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Late-bound error responder.
 *
 * Injected by `routeKit` at module load to avoid a circular import
 * (`routeKit` imports `HttpError`/`sendError` from this module).
 */
type FailFn = (res: ServerResponse, error: unknown, logger?: LoggerLike) => void;
/**
 * Install the real error responder (called once from `routeKit`).
 * @param fn - Responder implementation.
 */
export declare function installErrorResponder(fn: FailFn): void;
/** Request body ceiling enforced before any byte is buffered (NF7: 1 MB). */
export declare const MAX_BODY_BYTES = 1048576;
/** Error carrying an HTTP status and an envelope code. */
export declare class HttpError extends Error {
    /** HTTP status to answer with. */
    readonly status: number;
    /** Envelope error code (§7.12). */
    readonly code: string;
    /** Optional structured details. */
    readonly details: unknown;
    /**
     * @param status - HTTP status.
     * @param code - Envelope code.
     * @param message - Diagnostic.
     * @param details - Optional context.
     */
    constructor(status: number, code: string, message: string, details?: unknown);
}
/**
 * Read and parse a JSON request body.
 *
 * Rejects oversized bodies with 413 and malformed JSON with `invalid_argument`.
 * @param req - Incoming request.
 * @returns Parsed JSON value.
 * @throws HttpError for 413/400 cases.
 */
export declare function readJsonBody(req: IncomingMessage): Promise<unknown>;
export {};
