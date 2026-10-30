/**
 * Validation for a partial settings update (§7.8 `POST /settings/update`).
 *
 * A present field must be valid: persisting `null` or an out-of-range number
 * would silently change reminder behaviour (F9.1–F9.3).
 */
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
export declare function validateSettingsPatch(body: Record<string, unknown>): {
    timeZone?: string;
    tickIntervalMs?: number;
    graceMinutes?: number;
    defaultChannels?: ('overlay' | 'system')[];
    dnd?: {
        enabled: boolean;
        start: string;
        end: string;
        weekdaysOnly: boolean;
    };
    retentionDays?: number;
    nlp?: {
        enabled: boolean;
    };
};
