/**
 * Task id generation: `tr_` + 26-character Crockford base32 ULID.
 *
 * A ULID is time-ordered, which keeps `tasks.json` diffs readable and makes
 * "created order" a stable tie-break without a separate sequence. The encoder is
 * written here rather than imported so the package keeps zero dependencies.
 */
/**
 * Generate a task id.
 *
 * `now` and the random source are parameters so tests can pin both.
 * @param now - Timestamp used for the ULID time component.
 * @param random - 10-byte random source; defaults to `crypto.getRandomValues`.
 * @returns `tr_` + 26-character ULID.
 */
export declare function newTaskId(now?: Date, random?: () => Uint8Array): string;
/**
 * Validate the id shape.
 * @param id - Candidate id.
 * @returns True for `tr_` + 26 Crockford characters.
 */
export declare function isTaskId(id: unknown): id is string;
