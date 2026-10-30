/**
 * Repository: the single write path for HTTP routes **and** agent tools
 * (F7.11). Mutations are serialized through a FIFO queue; the physical write is
 * debounced so a burst of edits coalesces (F6.9), and disposal forces a flush
 * (F6.6).
 *
 * The repository never formats times for display and never decides "today" —
 * both are arguments, keeping the layer testable.
 */
import { localDateKey } from './rules/timezone.js';
import type { Repository, RepositoryOptions } from './repoTypes.js';
export type { CompleteResult, CreateTaskInput, ListQuery, ListResult, Repository, RepositoryOptions, TickChange, UpdateTaskPatch, } from './repoTypes.js';
/**
 * Create the repository over a loaded store.
 * @param options - Store, clock and debounce window.
 * @returns Repository handle.
 */
export declare function createRepository(options: RepositoryOptions): Repository;
/** Today's local date helper, re-exported for routes that need the same default. */
export { localDateKey };
