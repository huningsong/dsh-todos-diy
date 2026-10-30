/**
 * Task construction and patching: validation plus object assembly.
 *
 * Split from `repo.ts` (NF5 line budget) and kept free of storage mutation: the
 * functions here take a task and settings and return a *new* task. That makes
 * the field-level rules testable without a store.
 */
import { newTaskId } from './ids.js';
import { ValidationError, validateDescription, validateDueDate, validateNotify, validateOnce, validateRule, validateTimeZone, validateTitle, } from './validate.js';
/** Default reminder template (F5.4). */
export const DEFAULT_TEMPLATE = '{title}｜{time}\n{note}';
/**
 * Build a fresh task from user input.
 * @param input - Validated shape from the API/tool caller.
 * @param settings - Current settings (zone and channel defaults).
 * @param now - Creation instant (drives the id and timestamps).
 * @returns A new task in `active` status with a clean state block.
 */
export function buildTask(input, settings, now) {
    if (input.kind !== 'recurring' && input.kind !== 'once') {
        throw new ValidationError('invalid_argument', 'kind must be "recurring" or "once"', { field: 'kind' });
    }
    const title = validateTitle(input.title);
    const description = validateDescription(input.description);
    const dueDate = validateDueDate(input.dueDate);
    const zone = validateTimeZone(input.timeZone, settings.timeZone);
    let rule = null;
    let once = null;
    if (input.kind === 'recurring') {
        rule = validateRule(input.rule, zone);
    }
    else {
        once = validateOnce(input.once, zone);
    }
    const notify = validateNotify(input.notify, {
        channels: settings.defaultChannels,
        template: DEFAULT_TEMPLATE,
    });
    return {
        id: newTaskId(now),
        title,
        description,
        kind: input.kind,
        status: 'active',
        dueDate,
        pinned: input.pinned === true,
        doneAt: null,
        archivedQuarter: null,
        rule,
        once,
        notify,
        state: {
            lastFiredAt: null,
            lastOccurrenceKey: null,
            firedStart: false,
            firedEnd: false,
            firedStartAdvance: false,
            firedEndAdvance: false,
            missedStart: false,
            missedEnd: false,
            missedAt: null,
            missedCount: 0,
            snoozeUntil: null,
            completedOccurrenceKey: null,
        },
        revision: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
}
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
export function patchTask(current, patch, settings, now) {
    const next = { ...current };
    if (patch.title !== undefined)
        next.title = validateTitle(patch.title);
    if (patch.description !== undefined)
        next.description = validateDescription(patch.description);
    if (patch.dueDate !== undefined)
        next.dueDate = validateDueDate(patch.dueDate);
    if (patch.pinned !== undefined)
        next.pinned = patch.pinned === true;
    if (patch.rule !== undefined) {
        if (current.kind !== 'recurring') {
            throw new ValidationError('invalid_state', 'cannot set a rule on a one-off task', { field: 'rule' });
        }
        next.rule = validateRule(patch.rule, current.rule?.timeZone ?? settings.timeZone);
        next.state = { ...next.state, lastOccurrenceKey: null, lastFiredAt: null };
    }
    if (patch.once !== undefined) {
        if (current.kind !== 'once') {
            throw new ValidationError('invalid_state', 'cannot set a window on a recurring task', { field: 'once' });
        }
        next.once = validateOnce(patch.once, settings.timeZone);
        next.state = { ...next.state, firedStart: false, firedEnd: false, lastOccurrenceKey: null };
    }
    if (patch.notify !== undefined) {
        next.notify = validateNotify(patch.notify, {
            channels: current.notify.channels,
            template: current.notify.template,
        });
    }
    next.revision = current.revision + 1;
    next.updatedAt = now.toISOString();
    return next;
}
