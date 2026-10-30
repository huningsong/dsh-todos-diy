/**
 * Convert a tick plan into the repository's `applyTick` changes.
 *
 * Extracted so the exact mapping the scheduler uses is unit-testable: a missing
 * field here (notably `node`) silently breaks one-off missed de-duplication
 * while every lower-level test still passes.
 */
import type { Occurrence } from './rules/types.js';
import type { TickChange } from './repoTypes.js';
import type { Task } from './rules/types.js';
/**
 * Map a tick plan to repository changes.
 *
 * Both lists carry the occurrence's own instant and its one-off node:
 * - `firedAt` / `missedAt` are the occurrence instants, never the tick time, so
 *   a backlog watermark stays correct when several occurrences are caught up at
 *   once;
 * - `node` lets `applyTick` settle `firedStart`/`firedEnd` (or the missed
 *   equivalents) for one-off tasks.
 * @param plan - Result of `resolveTick`.
 * @returns Changes ready for `repo.applyTick`.
 */
export declare function planToChanges(plan: {
    fire: Occurrence[];
    markMissed: Occurrence[];
}, tasks?: readonly Task[]): TickChange[];
