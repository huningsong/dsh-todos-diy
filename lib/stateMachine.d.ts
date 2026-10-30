/**
 * Task state machine (F1.2).
 *
 * `active` ⇄ `paused`; `active` → `done`; any status → `archived`;
 * `archived` → `active` (restore). Everything else is `invalid_state`.
 * Pure: the caller supplies the task and gets a boolean.
 */
import type { TaskStatus } from './rules/types.js';
/**
 * Whether one status transition is legal.
 * @param from - Current status.
 * @param to - Requested status.
 * @returns True when the state machine allows it.
 */
export declare function canTransition(from: TaskStatus, to: TaskStatus): boolean;
/**
 * Describe an illegal transition for the error message.
 * @param from - Current status.
 * @param to - Requested status.
 * @returns Human-readable explanation.
 */
export declare function describeTransition(from: TaskStatus, to: TaskStatus): string;
