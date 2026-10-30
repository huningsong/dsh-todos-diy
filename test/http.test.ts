/**
 * HTTP plumbing tests (§4.4 / NF7): the admission gate, the loopback fallback,
 * the body reader and the envelope writers.
 */

import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'

import {
  MAX_BODY_BYTES,
  HttpError,
  createRequestGate,
  hostHeaderName,
  isLoopbackAddress,
  loopbackRejection,
  readJsonBody,
  sendError,
  sendJson,
  sendRejection,
} from '../src/host/http.js'
import { fakeResponse } from './fakeHttp.js'

/** Build a minimal request for the gate and body reader. */
function request(options: {
  headers?: Record<string, string>
  remoteAddress?: string
  body?: string
}) {
  const payload = options.body ?? ''
  const stream = Readable.from(payload === '' ? [] : [Buffer.from(payload, 'utf8')])
  return {
    headers: {
      host: '127.0.0.1:53364',
      ...(payload === '' ? {} : { 'content-length': String(Buffer.byteLength(payload)) }),
      ...options.headers,
    },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
    [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
  }
}

describe('isLoopbackAddress', () => {
  it('accepts v4/v6 loopback forms', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true)
    assert.equal(isLoopbackAddress('127.5.6.7'), true)
    assert.equal(isLoopbackAddress('::1'), true)
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
  })

  it('rejects everything else', () => {
    assert.equal(isLoopbackAddress('10.0.0.7'), false)
    assert.equal(isLoopbackAddress('::2'), false)
    assert.equal(isLoopbackAddress(undefined), false)
  })
})

describe('hostHeaderName', () => {
  it('strips a port', () => {
    assert.equal(hostHeaderName('127.0.0.1:53364'), '127.0.0.1')
    assert.equal(hostHeaderName('EXAMPLE.com:80'), 'example.com')
  })

  it('handles IPv6 brackets', () => {
    assert.equal(hostHeaderName('[::1]:53364'), '::1')
    assert.equal(hostHeaderName('[::1]'), '::1')
  })

  it('returns an empty string for junk', () => {
    assert.equal(hostHeaderName(''), '')
    assert.equal(hostHeaderName(undefined), '')
    assert.equal(hostHeaderName('[::1'), '')
  })
})

describe('loopbackRejection (no connection service)', () => {
  it('admits a loopback socket with a loopback host', () => {
    assert.equal(loopbackRejection(request({}) as never), undefined)
  })

  it('refuses a non-loopback socket with 403', () => {
    assert.equal(loopbackRejection(request({ remoteAddress: '10.1.2.3' }) as never), 403)
  })

  it('refuses a non-loopback Host header with 403', () => {
    assert.equal(loopbackRejection(request({ headers: { host: 'evil.example:80' } }) as never), 403)
  })

  it('refuses a cross-site fetch with 403', () => {
    assert.equal(loopbackRejection(request({ headers: { 'sec-fetch-site': 'cross-site' } }) as never), 403)
  })

  it('admits same-origin and same-site fetches', () => {
    assert.equal(loopbackRejection(request({ headers: { 'sec-fetch-site': 'same-origin' } }) as never), undefined)
    assert.equal(loopbackRejection(request({ headers: { 'sec-fetch-site': 'same-site' } }) as never), undefined)
  })
})

describe('createRequestGate', () => {
  it('delegates to connection.requestRejection when present', () => {
    const ctx = { get: () => ({ requestRejection: () => 401 }) }
    assert.equal(createRequestGate(ctx)(request({}) as never), 401)
  })

  it('passes an admitted request through', () => {
    const ctx = { get: () => ({ requestRejection: () => undefined }) }
    assert.equal(createRequestGate(ctx)(request({}) as never), undefined)
  })

  it('maps any non-401 rejection to 403', () => {
    const ctx = { get: () => ({ requestRejection: () => 500 }) }
    assert.equal(createRequestGate(ctx)(request({}) as never), 403)
  })

  it('fails closed when the gate throws', () => {
    const ctx = {
      get: () => ({
        requestRejection: () => {
          throw new Error('boom')
        },
      }),
    }
    assert.equal(createRequestGate(ctx)(request({}) as never), 403)
  })

  it('falls back to loopback when the service is absent', () => {
    const ctx = { get: () => undefined }
    assert.equal(createRequestGate(ctx)(request({}) as never), undefined)
    assert.equal(createRequestGate(ctx)(request({ remoteAddress: '8.8.8.8' }) as never), 403)
  })

  it('survives a ctx.get that throws', () => {
    const ctx = {
      get: () => {
        throw new Error('not ready')
      },
    }
    assert.equal(createRequestGate(ctx)(request({}) as never), undefined)
  })
})

describe('sendJson / sendError / sendRejection', () => {
  it('writes the success envelope with no-store', () => {
    const res = fakeResponse()
    sendJson(res as never, 200, { ok: true, value: { a: 1 } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.deepEqual(res.json(), { ok: true, value: { a: 1 } })
  })

  it('writes the error envelope without details by default', () => {
    const res = fakeResponse()
    sendError(res as never, 400, 'invalid_argument', 'bad')
    assert.deepEqual(res.json(), { error: { code: 'invalid_argument', message: 'bad' } })
  })

  it('includes details when provided', () => {
    const res = fakeResponse()
    sendError(res as never, 409, 'conflict', 'stale', { currentRevision: 2 })
    assert.deepEqual(res.json(), { error: { code: 'conflict', message: 'stale', details: { currentRevision: 2 } } })
  })

  it('writes 401 as unauthorized', () => {
    const res = fakeResponse()
    sendRejection(res as never, 401)
    assert.equal(res.statusCode, 401)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'unauthorized')
  })

  it('writes 403 as forbidden', () => {
    const res = fakeResponse()
    sendRejection(res as never, 403)
    assert.equal(res.statusCode, 403)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'forbidden')
  })
})

describe('readJsonBody', () => {
  it('parses a JSON object', async () => {
    const body = await readJsonBody(request({ body: '{"a":1}' }) as never)
    assert.deepEqual(body, { a: 1 })
  })

  it('returns undefined for an empty body', async () => {
    assert.equal(await readJsonBody(request({}) as never), undefined)
  })

  it('rejects malformed JSON with invalid_argument', async () => {
    await assert.rejects(readJsonBody(request({ body: '{bad' }) as never), (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.code, 'invalid_argument')
      return true
    })
  })

  it('rejects a declared oversized body with 413', async () => {
    await assert.rejects(
      readJsonBody(request({ body: '{}', headers: { 'content-length': String(MAX_BODY_BYTES + 1) } }) as never),
      (error: unknown) => {
        assert.ok(error instanceof HttpError)
        assert.equal(error.status, 413)
        return true
      },
    )
  })

  it('rejects a stream that exceeds the cap without a declared length', async () => {
    const chunk = 'x'.repeat(600_000)
    const req = request({ body: chunk + chunk })
    // Drop the declared length so the streaming guard is the one that fires.
    delete (req.headers as Record<string, string>)['content-length']
    await assert.rejects(readJsonBody(req as never), (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.status, 413)
      return true
    })
  })
})
