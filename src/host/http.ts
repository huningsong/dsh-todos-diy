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

import type { IncomingMessage, ServerResponse } from 'node:http'

/** Base path of every route this plugin owns. */
export const API_PREFIX = '/api/dsh-todos-diy'

/** Anything with the shape of the host's connection service. */
interface ConnectionLike {
  requestRejection?: (request: { headers: Record<string, unknown> }) => number | undefined
}

/** Minimal logger surface; the Cordis logger satisfies it. */
export interface LoggerLike {
  info?: (message: string) => void
  warn?: (message: string) => void
}

/** Admission decision: `undefined` admits, `401`/`403` refuse. */
export type Rejection = 401 | 403 | undefined

/**
 * Resolve the host `connection` service lazily.
 *
 * It is constructed after the host's async init, so reading it at mount time
 * would permanently narrow the fence to loopback (§7.8 / dsh-market #729).
 * @param ctx - Cordis context.
 * @returns The service, or undefined when this composition has none.
 */
function getConnection(ctx: { get?: (name: string) => unknown }): ConnectionLike | undefined {
  try {
    const value = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
    return value !== null && typeof value === 'object' ? (value as ConnectionLike) : undefined
  } catch {
    return undefined
  }
}

/** Whether a socket address literal is loopback. */
export function isLoopbackAddress(address: unknown): boolean {
  if (typeof address !== 'string') return false
  return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.')
}

/**
 * Extract the hostname from a `Host` header (`host[:port]`, IPv6 bracketed).
 * @param host - Raw header value.
 * @returns Lower-cased hostname, or an empty string.
 */
export function hostHeaderName(host: unknown): string {
  if (typeof host !== 'string' || host.trim() === '') return ''
  const trimmed = host.trim()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    return end === -1 ? '' : trimmed.slice(1, end).toLowerCase()
  }
  const colon = trimmed.lastIndexOf(':')
  const name = colon === -1 ? trimmed : trimmed.slice(0, colon)
  return name.toLowerCase()
}

/**
 * Loopback fallback used when the host publishes no `connection` gate.
 *
 * Requires a loopback socket, a loopback `Host`, and a same-origin (or absent)
 * `Sec-Fetch-Site`.
 * @param req - Incoming request.
 * @returns 401/403 to refuse, undefined to admit.
 */
export function loopbackRejection(req: IncomingMessage): Rejection {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return 403
  const host = hostHeaderName(req.headers.host)
  if (host !== 'localhost' && host !== '::1' && !host.startsWith('127.')) return 403
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site.toLowerCase() === 'cross-site') return 403
  return undefined
}

/**
 * Build the request gate for this plugin instance.
 * @param ctx - Cordis context (used to reach `connection`).
 * @returns Gate function.
 */
export function createRequestGate(ctx: { get?: (name: string) => unknown }): (req: IncomingMessage) => Rejection {
  return (req) => {
    const connection = getConnection(ctx)
    const reject = connection?.requestRejection
    if (typeof reject === 'function') {
      try {
        const status = reject.call(connection, { headers: req.headers as Record<string, unknown> })
        if (status === undefined || status === null) return undefined
        return status === 401 ? 401 : 403
      } catch {
        // A gate that throws has admitted nothing.
        return 403
      }
    }
    return loopbackRejection(req)
  }
}

/**
 * Write one JSON response with the plugin envelope.
 * @param res - Response.
 * @param status - HTTP status.
 * @param payload - Body, serialized as-is.
 */
export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
  })
  res.end(body)
}

/**
 * Write the shared error envelope `{error:{code,message,details?}}`.
 * @param res - Response.
 * @param status - HTTP status.
 * @param code - Machine-readable error code (§7.12).
 * @param message - English diagnostic; clients translate by code.
 * @param details - Optional structured context.
 */
export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  sendJson(res, status, {
    error: details === undefined ? { code, message } : { code, message, details },
  })
}

/**
 * Answer a gate refusal: 401 asks for login, 403 blames the origin.
 * @param res - Response.
 * @param status - 401 or 403.
 */
export function sendRejection(res: ServerResponse, status: 401 | 403): void {
  if (status === 401) {
    sendError(res, 401, 'unauthorized', 'DSH login required: reopen the URL printed by dsh web')
    return
  }
  sendError(res, 403, 'forbidden', 'Request origin is not trusted')
}

/** Options shared by every route wrapper. */
export interface RouteOptions {
  gate: (req: IncomingMessage) => Rejection
  logger?: LoggerLike
}

/** A route handler body with a pre-parsed URL. */
export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => void | Promise<void>

/**
 * Wrap one handler with the admission gate, a method assertion and error
 * containment, so no route can forget any of the three.
 * @param options - Gate and logger.
 * @param method - Required HTTP method.
 * @param handler - Route body.
 * @returns A raw `node:http` request listener.
 */
export function route(
  options: RouteOptions,
  method: string,
  handler: RouteHandler,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const rejection = options.gate(req)
    if (rejection !== undefined) {
      sendRejection(res, rejection)
      return
    }
    if (req.method !== method) {
      res.writeHead(405, { allow: method })
      res.end()
      return
    }
    let url: URL
    try {
      url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    } catch {
      sendError(res, 400, 'invalid_argument', 'Malformed request URL')
      return
    }
    try {
      await handler(req, res, url)
    } catch (error) {
      // `routeKit.fail` maps ValidationError/HttpError onto their §7.12 status;
      // anything unknown becomes a generic 500 without leaking a stack trace.
      failWith(res, error, options.logger)
    }
  }
}

/**
 * Late-bound error responder.
 *
 * Injected by `routeKit` at module load to avoid a circular import
 * (`routeKit` imports `HttpError`/`sendError` from this module).
 */
type FailFn = (res: ServerResponse, error: unknown, logger?: LoggerLike) => void

let failWith: FailFn = (res, error, logger) => {
  logger?.warn?.(`todos-diy: route failed: ${String(error)}`)
  if (!res.headersSent) sendError(res, 500, 'internal_error', 'Internal error')
  else res.end()
}

/**
 * Install the real error responder (called once from `routeKit`).
 * @param fn - Responder implementation.
 */
export function installErrorResponder(fn: FailFn): void {
  failWith = fn
}

/** Request body ceiling enforced before any byte is buffered (NF7: 1 MB). */
export const MAX_BODY_BYTES = 1_048_576

/** Error carrying an HTTP status and an envelope code. */
export class HttpError extends Error {
  /** HTTP status to answer with. */
  readonly status: number
  /** Envelope error code (§7.12). */
  readonly code: string
  /** Optional structured details. */
  readonly details: unknown

  /**
   * @param status - HTTP status.
   * @param code - Envelope code.
   * @param message - Diagnostic.
   * @param details - Optional context.
   */
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Read and parse a JSON request body.
 *
 * Rejects oversized bodies with 413 and malformed JSON with `invalid_argument`.
 * @param req - Incoming request.
 * @returns Parsed JSON value.
 * @throws HttpError for 413/400 cases.
 */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers['content-length'] ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Request body exceeds 1 MB')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer)
    total += buffer.byteLength
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(413, 'payload_too_large', 'Request body exceeds 1 MB')
    }
    chunks.push(buffer)
  }
  if (total === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid_argument', 'Request body is not valid JSON')
  }
}
