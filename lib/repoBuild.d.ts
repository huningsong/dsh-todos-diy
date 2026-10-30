/**
 * Task construction and patching: validation plus object assembly.
 *
 * Split from `repo.ts` (NF5 line budget) and kept free of storage mutation: the
 * functions here take a task and settings and return a *new* task. That makes
 * the field-level rules testable without a store.
 */
import type { Settings } from './state.js';
import type { Task } from './rules/types.js';
import type { CreateTaskInput, UpdateTaskPatch } from './repoTypes.js';
/** Default reminder template (F5.4). */
export declare const DEFAULT_TEMPLATE = "{title}\uFF5C{time}\n{note}";
/**
 * Build a fresh task from user input.
 * @param input - Validated shape from the API/tool caller.
 * @param settings - Current settings (zone and channel defaults).
 * @param now - Creation instant (drives the id and timestamps).
 * @returns A new task in `active` status with a clean state block.
 */
export declare function buildTask(input: CreateTaskInput, settings: Settings, now: Date): Task;
/**
 * Apply one patch onto a copy of a task, validating every provided field.
 *
 * Editing a rule or a one-off window clears the previous firing markers: the
 * old `occurrenceKey` no longer describes anything, and keeping it would make
 * the next solve think the new schedule had already fired.
 * @param current - Task before the edit.
 * @param patch - Partial update.
 * @param settings - Current settings (zone fallback for windows).
 * @param now - Edit instant, used for `updatedAt`.
 * @returns A new task with `revision + 1`.
 */
export declare function patchTask(current: Task, patch: UpdateTaskPatch, settings: Settings, now: Date): Task;
