/**
 * Route helpers shared by every handler: envelope writing, body reading and the
 * mapping from a thrown error to a §7.12 response.
 */
import { HttpError, installErrorResponder, readJsonBody, sendError, sendJson } from './http.js';
import { ValidationError } from './validationError.js';
/** HTTP status for each envelope code (§7.12). */
const STATUS_BY_CODE = {
    invalid_argument: 400,
    invalid_cron: 400,
    invalid_timezone: 400,
    payload_too_large: 413,
    not_found: 404,
    invalid_state: 409,
    no_occurrence: 409,
    conflict: 409,
    read_only: 409,
    storage_read_only: 409,
    schema_mismatch: 400,
    storage_error: 500,
    forbidden: 403,
    internal_error: 500,
    unauthorized: 401,
};
/**
 * Map a thrown value to an HTTP status.
 * @param error - Whatever was thrown.
 * @returns Status code, defaulting to 500.
 */
export function statusFor(error) {
    if (error instanceof HttpError)
        return error.status;
    if (error instanceof ValidationError)
        return STATUS_BY_CODE[error.code] ?? 500;
    return 500;
}
/**
 * Answer with the shared error envelope for a thrown value.
 *
 * Unknown errors become `internal_error` with a generic message: an internal
 * stack trace must never leak through the API.
 * @param res - Response.
 * @param error - Whatever was thrown.
 * @param logger - Optional logger for unexpected errors.
 */
export function fail(res, error, logger) {
    if (res.headersSent) {
        res.end();
        return;
    }
    if (error instanceof HttpError) {
        sendError(res, error.status, error.code, error.message, error.details);
        return;
    }
    if (error instanceof ValidationError) {
        sendError(res, STATUS_BY_CODE[error.code] ?? 500, error.code, error.message, error.details);
        return;
    }
    logger?.warn?.(`todos-diy: route failed: ${String(error)}`);
    sendError(res, 500, 'internal_error', 'Internal error');
}
/**
 * Wrap one async handler so any throw becomes an error envelope.
 * @param handler - Handler body.
 * @param logger - Optional logger.
 * @returns Node request listener.
 */
export function guard(handler, logger) {
    return async (req, res, url) => {
        try {
            await handler(req, res, url);
        }
        catch (error) {
            fail(res, error, logger);
        }
    };
}
/**
 * Read a JSON body and require it to be an object.
 * @param req - Incoming request.
 * @returns The body as a plain record.
 * @throws HttpError with `invalid_argument` when the body is not an object.
 */
export async function readObjectBody(req) {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'invalid_argument', 'Request body must be a JSON object');
    }
    return body;
}
/**
 * Read one query parameter.
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns The value, or undefined when absent.
 */
export function queryValue(url, name) {
    const value = url.searchParams.get(name);
    return value === null || value === '' ? undefined : value;
}
/**
 * Read a boolean query parameter (`1`/`true`/`yes` count as true).
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns True/false, or undefined when absent.
 */
export function queryFlag(url, name) {
    const value = queryValue(url, name);
    if (value === undefined)
        return undefined;
    const normalized = value.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
/**
 * Read an integer query parameter.
 * @param url - Request URL.
 * @param name - Parameter name.
 * @returns Parsed integer, or undefined when absent.
 * @throws HttpError with `invalid_argument` when present but not an integer.
 */
export function queryInt(url, name) {
    const value = queryValue(url, name);
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        throw new HttpError(400, 'invalid_argument', `Query parameter ${JSON.stringify(name)} must be an integer`);
    }
    return parsed;
}
/** Success envelope writer. */
export function ok(res, value, status = 200) {
    sendJson(res, status, { ok: true, value });
}
// Break the import cycle at module load: `route()` needs the envelope-aware
// responder, but `http.ts` cannot import this module (routeKit imports it).
installErrorResponder(fail);
