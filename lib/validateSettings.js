/**
 * Validation for a partial settings update (§7.8 `POST /settings/update`).
 *
 * A present field must be valid: persisting `null` or an out-of-range number
 * would silently change reminder behaviour (F9.1–F9.3).
 */
import { ValidationError } from './validationError.js';
import { validateTimeZone } from './validate.js';
/**
 * Validate a partial settings update (§7.8 `POST /settings/update`).
 *
 * Every field is optional, but a *present* field must be valid: a bad value has
 * to be rejected instead of being persisted as `null` or an out-of-range
 * number, which would silently change reminder behaviour (F9.1–F9.3).
 * @param body - Request body.
 * @returns A validated patch.
 * @throws ValidationError `invalid_argument` for any malformed field.
 */
export function validateSettingsPatch(body) {
    const patch = {};
    if (body['timeZone'] !== undefined)
        patch.timeZone = validateTimeZone(body['timeZone']);
    if (body['tickIntervalMs'] !== undefined) {
        patch.tickIntervalMs = requireInt(body['tickIntervalMs'], 30_000, 300_000, 'tickIntervalMs');
    }
    if (body['graceMinutes'] !== undefined) {
        patch.graceMinutes = requireInt(body['graceMinutes'], 0, 60, 'graceMinutes');
    }
    if (body['retentionDays'] !== undefined) {
        patch.retentionDays = requireInt(body['retentionDays'], 1, 3650, 'retentionDays');
    }
    if (body['defaultChannels'] !== undefined) {
        if (!Array.isArray(body['defaultChannels'])) {
            throw new ValidationError('invalid_argument', 'defaultChannels must be an array', {
                field: 'defaultChannels',
            });
        }
        const channels = body['defaultChannels'].filter((channel) => channel === 'overlay' || channel === 'system');
        if (channels.length === 0 || !channels.includes('overlay')) {
            throw new ValidationError('invalid_argument', 'defaultChannels must include "overlay"', {
                field: 'defaultChannels',
            });
        }
        patch.defaultChannels = [...new Set(channels)];
    }
    if (body['nlp'] !== undefined) {
        const raw = body['nlp'];
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new ValidationError('invalid_argument', 'nlp must be an object', { field: 'nlp' });
        }
        if (raw['enabled'] !== undefined) {
            patch.nlp = { enabled: raw['enabled'] === true };
        }
    }
    if (body['dnd'] !== undefined) {
        const raw = body['dnd'];
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new ValidationError('invalid_argument', 'dnd must be an object', { field: 'dnd' });
        }
        const record = raw;
        // A partial `dnd` patch must not silently disable DND: only fields that are
        // actually present are applied, and the caller keeps the rest.
        patch.dnd = {
            ...(record['enabled'] === undefined ? {} : { enabled: record['enabled'] === true }),
            ...(record['start'] === undefined ? {} : { start: requireClock(record['start'], 'dnd.start') }),
            ...(record['end'] === undefined ? {} : { end: requireClock(record['end'], 'dnd.end') }),
            ...(record['weekdaysOnly'] === undefined ? {} : { weekdaysOnly: record['weekdaysOnly'] === true }),
        };
    }
    return patch;
}
/**
 * Require an integer inside a range.
 * @param value - Candidate.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 * @param field - Field name for the error.
 * @returns The validated integer.
 */
function requireInt(value, min, max, field) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new ValidationError('invalid_argument', `${field} must be an integer between ${String(min)} and ${String(max)}`, {
            field,
        });
    }
    return parsed;
}
/**
 * Require an `HH:mm` clock string.
 * @param value - Candidate.
 * @param field - Field name for the error.
 * @returns The validated text.
 */
function requireClock(value, field) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw new ValidationError('invalid_argument', `${field} must be HH:mm`, { field });
    }
    return value;
}
