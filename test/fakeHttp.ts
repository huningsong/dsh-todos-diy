/**
 * A minimal `node:http` request/response double for route tests.
 *
 * Routes are plain `(req, res)` listeners, so they can be driven directly with
 * fake objects — no listening socket, no port, no flakiness (§10.1 "路由测试").
 */

import { Readable } from 'node:stream'

/** Recorded response. */
export interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  headersSent: boolean
  writeHead(status: number, headers?: Record<string, string>): FakeResponse
  end(chunk?: string): void
  /** Parsed JSON body (throws when the body is empty). */
  json<T = unknown>(): T
}

/**
 * Build a fake response recorder.
 * @returns Response double.
 */
export function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 0,
    headers: {},
    body: '',
    headersSent: false,
    writeHead(status, headers) {
      response.statusCode = status
      response.headers = { ...headers }
      response.headersSent = true
      return response
    },
    end(chunk) {
      if (typeof chunk === 'string') response.body += chunk
      response.headersSent = true
    },
    json<T = unknown>(): T {
      return JSON.parse(response.body) as T
    },
  }
  return response
}

/** Options for a fake request. */
export interface FakeRequestOptions {
  method?: string
  /** Path plus query string, e.g. `/api/dsh-todos-diy/snapshot?view=todo`. */
  url: string
  body?: unknown
  headers?: Record<string, string>
  /** Socket remote address used by the loopback fallback. */
  remoteAddress?: string
}

/**
 * Build a fake request with an optional JSON body stream.
 * @param options - Method, URL, body and headers.
 * @returns Request double plus the parsed body length.
 */
export function fakeRequest(options: FakeRequestOptions): {
  method: string
  url: string
  headers: Record<string, string>
  socket: { remoteAddress: string }
  [Symbol.asyncIterator](): AsyncIterator<Buffer>
} {
  const payload =
    options.body === undefined ? '' : typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  const stream = Readable.from(payload === '' ? [] : [Buffer.from(payload, 'utf8')])
  return {
    method: options.method ?? 'GET',
    url: options.url,
    headers: {
      host: '127.0.0.1:53364',
      ...(payload === '' ? {} : { 'content-length': String(Buffer.byteLength(payload)) }),
      ...options.headers,
    },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
    [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
  }
}
