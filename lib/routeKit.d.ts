/**
 * Route helpers shared by every handler: envelope writing, body reading and the
 * mapping from a thrown error to a §7.12 response.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/**
 * Map a thrown value to an HTTP status.
 * @param error - Whatever was thrown.
 * @returns Status code, defaulting to 500.
 */
export declare function statusFor(error: unknown): number;
/**
 * Answer with the shared error envelope for a thrown value.
 *
 * Unknown errors become `internal_error` with a generic message: an internal
 * stack trace must never leak through the API.
 * @param res - Response.
 * @param error - Whatever was thrown.
 * @param logger - Optional logger for unexpected errors.
 */
export declare function fail(res: ServerResponse, error: unknown, logger?: {
    warn?: (message: string) => void;
}): void;
/**
 * Wrap one async handler so any throw becomes an error envelope.
 * @param handler - Handler body.
 * @param logger - Optional logger.
 * @returns Node request listener.
 */
export declare function guard(handler: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>, logger?: {
    warn?: (message: string) => void;
}): (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;
/**
 * Read a JSON body and require it to be an object.
 * @param req - Incoming request.
 * @returns The body as a plain record.
 * @throws HttpError with `invalid_argument` when the body is not an object.
 */
export declare function readObjectBody(req: IncomingMessage): Promise<Record<string, unknown>>;
/**
 * Read one query parameter.
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns The value, or undefined when absent.
 */
export declare function queryValue(url: URL, name: string): string | undefined;
/**
 * Read a boolean query parameter (`1`/`true`/`yes` count as true).
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns True/false, or undefined when absent.
 */
export declare function queryFlag(url: URL, name: string): boolean | undefined;
/**
 * Read an integer query parameter.
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns Parsed integer, or undefined when absent.
 * @throws HttpError with `invalid_argument` when present but not an integer.
 */
export declare function queryInt(url: URL, name: string): number | undefined;
/** Success envelope writer. */
export declare function ok(res: ServerResponse, value: unknown, status?: number): void;
