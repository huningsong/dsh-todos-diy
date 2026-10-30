/**
 * Task id generation: `tr_` + 26-character Crockford base32 ULID.
 *
 * A ULID is time-ordered, which keeps `tasks.json` diffs readable and makes
 * "created order" a stable tie-break without a separate sequence. The encoder is
 * written here rather than imported so the package keeps zero dependencies.
 */

/** Crockford base32 alphabet (no I, L, O, U to avoid transcription errors). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** ULID timestamp length and randomness length, in characters. */
const TIME_CHARS = 10
const RANDOM_CHARS = 16

/**
 * Encode a non-negative integer into `length` Crockford base32 characters.
 * @param value - Integer to encode.
 * @param length - Fixed output length.
 * @returns Encoded text.
 */
function encodeTime(value: number, length: number): string {
  let remaining = value
  let out = ''
  for (let index = 0; index < length; index += 1) {
    const mod = remaining % 32
    out = (ALPHABET[mod] as string) + out
    remaining = Math.floor(remaining / 32)
  }
  return out
}

/**
 * Encode a byte array into Crockford base32 characters.
 * @param bytes - Random bytes (10 bytes → 16 characters).
 * @returns Encoded text.
 */
function encodeRandom(bytes: Uint8Array): string {
  // 80 bits → 16 characters of 5 bits each, most significant first.
  let bits = 0n
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte)
  let out = ''
  for (let index = 0; index < RANDOM_CHARS; index += 1) {
    const shift = BigInt(5 * (RANDOM_CHARS - 1 - index))
    out += ALPHABET[Number((bits >> shift) & 31n)] as string
  }
  return out
}

/**
 * Generate a task id.
 *
 * `now` and the random source are parameters so tests can pin both.
 * @param now - Timestamp used for the ULID time component.
 * @param random - 10-byte random source; defaults to `crypto.getRandomValues`.
 * @returns `tr_` + 26-character ULID.
 */
export function newTaskId(
  now: Date = new Date(),
  random: () => Uint8Array = defaultRandom,
): string {
  const time = Math.max(0, Math.floor(now.getTime()))
  const bytes = random()
  if (bytes.byteLength !== 10) throw new Error('newTaskId requires exactly 10 random bytes')
  return `tr_${encodeTime(time, TIME_CHARS)}${encodeRandom(bytes)}`
}

/** Cryptographically strong default random source. */
function defaultRandom(): Uint8Array {
  const bytes = new Uint8Array(10)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Validate the id shape.
 * @param id - Candidate id.
 * @returns True for `tr_` + 26 Crockford characters.
 */
export function isTaskId(id: unknown): id is string {
  return typeof id === 'string' && /^tr_[0-9A-HJKMNP-TV-Z]{26}$/.test(id)
}
