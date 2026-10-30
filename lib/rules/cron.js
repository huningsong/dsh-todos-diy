/**
 * 5-field Vixie cron: parsing, canonicalization and matching.
 *
 * Dialect — identical to the DSH built-in scheduler (§4.6):
 *  - `*`, a single value, `a-b`, `*​/n`, `a-b/n`, and comma-separated lists;
 *  - minute 0–59, hour 0–23, day-of-month 1–31, month 1–12, day-of-week 0–7
 *    (both 0 and 7 mean Sunday);
 *  - rejects `L` / `W` / `#`, English month or weekday names, `@daily` macros
 *    and 6-field (seconds) expressions.
 *
 * Day-of-month / day-of-week follow Vixie's AND/OR rule: when either field is
 * `*`-led the two fields AND together, otherwise a date matches if *either*
 * field matches.
 *
 * Pure module: no clock, no IO, no globals.
 */
/** Error thrown by {@link parseCron}; `field` names the offending cron field. */
export class CronError extends Error {
    /** Machine-readable reason shared with the API error envelope. */
    code;
    /** Which of the five fields failed, or `'expression'` for shape errors. */
    field;
    /**
     * @param message - Human-readable diagnostic (English, API-level).
     * @param field - Offending field name.
     */
    constructor(message, field) {
        super(message);
        this.name = 'CronError';
        this.code = 'invalid_cron';
        this.field = field;
    }
}
const FIELD_SPECS = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day-of-month', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12 },
    { name: 'day-of-week', min: 0, max: 7, foldMaxTo: 0 },
];
/** Fields a cron expression may contain; anything else is a dialect error. */
const CRON_SAFE_CHARACTER = /^[\d*,/\-\s]+$/;
/**
 * Expand one comma-separated field into its matched value set.
 * @param raw - Field text.
 * @param spec - Field bounds.
 * @returns Ascending matched values with the fold applied.
 */
function expandField(raw, spec) {
    const matched = new Set();
    for (const element of raw.split(',')) {
        if (element === '') {
            throw new CronError(`${spec.name} field must not contain an empty list element`, spec.name);
        }
        if (element === '*') {
            for (let value = spec.min; value <= spec.max; value += 1)
                matched.add(value);
            continue;
        }
        if (element.startsWith('*')) {
            const stepMatch = /^\*\/(\d+)$/.exec(element);
            if (stepMatch === null)
                throw invalidElement(spec, element);
            const step = readStep(stepMatch[1], spec);
            for (let value = spec.min; value <= spec.max; value += step)
                matched.add(value);
            continue;
        }
        const rangeMatch = /^(\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(element);
        if (rangeMatch === null)
            throw invalidElement(spec, element);
        const start = readValue(rangeMatch[1], spec);
        const endText = rangeMatch[2];
        const stepText = rangeMatch[3];
        if (endText === undefined) {
            if (stepText !== undefined)
                throw invalidElement(spec, element);
            matched.add(start);
            continue;
        }
        const end = readValue(endText, spec);
        if (start > end) {
            throw new CronError(`${spec.name} field range ${start}-${end} is inverted`, spec.name);
        }
        const step = stepText === undefined ? 1 : readStep(stepText, spec);
        for (let value = start; value <= end; value += step)
            matched.add(value);
    }
    const folded = new Set();
    for (const value of matched) {
        folded.add(spec.foldMaxTo !== undefined && value === spec.max ? spec.foldMaxTo : value);
    }
    return [...folded].sort((left, right) => left - right);
}
/** Build the diagnostic for a malformed list element. */
function invalidElement(spec, element) {
    return new CronError(`${spec.name} field element ${JSON.stringify(element)} must be *, a value, a-b, */n, a-b/n, or a comma-separated list of those`, spec.name);
}
/** Read a single in-range value. */
function readValue(text, spec) {
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) {
        throw new CronError(`${spec.name} field value ${text} is outside ${spec.min}-${spec.max}`, spec.name);
    }
    return value;
}
/** Read a positive step. */
function readStep(text, spec) {
    const step = Number(text);
    if (!Number.isSafeInteger(step) || step < 1) {
        throw new CronError(`${spec.name} field step must be a positive integer`, spec.name);
    }
    return step;
}
/**
 * Encode an ascending value set as the shortest equivalent field text.
 * @param values - Ascending, non-empty.
 * @returns Field text that re-parses to the same set.
 */
function encodeField(values) {
    const head = values[0];
    if (head === undefined)
        throw new CronError('field matched no value', 'expression');
    if (values.length === 1)
        return String(head);
    const tail = values[values.length - 1];
    const step = values[1] - head;
    // A two-value set is shorter and clearer as a list: `1,30`, never `1-30/29`.
    let uniform = values.length >= 3;
    for (let index = 2; index < values.length && uniform; index += 1) {
        if (values[index] - values[index - 1] !== step) {
            uniform = false;
        }
    }
    if (uniform && step === 1)
        return `${head}-${tail}`;
    if (uniform)
        return `${head}-${tail}/${step}`;
    const parts = [];
    let runStart = head;
    for (let index = 1; index < values.length; index += 1) {
        const current = values[index];
        const previous = values[index - 1];
        if (current === previous + 1)
            continue;
        parts.push(runStart === previous ? String(runStart) : `${runStart}-${previous}`);
        runStart = current;
    }
    parts.push(runStart === tail ? String(runStart) : `${runStart}-${tail}`);
    return parts.join(',');
}
/**
 * Encode a field whose author wrote a leading `*`.
 *
 * A `*`-led field keeps a `*`-led spelling so that re-parsing reproduces the
 * star flag, which decides the Vixie AND/OR branch for dom/dow. Notably
 * `*` + `/2` in the day-of-week field stays a stepped star and does not
 * degrade to the explicit list `0,2,4,6`.
 * @param values - Matched values, ascending.
 * @param spec - Field bounds.
 * @returns Canonical `*`-led field text.
 */
function encodeStarField(values, spec) {
    if (values.length === foldRange(spec).length)
        return '*';
    const present = new Set(values);
    let bestStep;
    let bestWalk = [];
    for (let step = 1; step <= spec.max - spec.min + 1; step += 1) {
        const walk = [];
        for (let value = spec.min; value <= spec.max; value += step) {
            walk.push(spec.foldMaxTo !== undefined && value === spec.max ? spec.foldMaxTo : value);
        }
        const unique = [...new Set(walk)].sort((left, right) => left - right);
        if (unique.length > bestWalk.length && unique.every((value) => present.has(value))) {
            bestStep = step;
            bestWalk = unique;
        }
    }
    if (bestStep === undefined)
        throw new CronError('field cannot keep a leading "*"', spec.name);
    const walked = new Set(bestWalk);
    const remaining = values.filter((value) => !walked.has(value));
    const walkText = `*/${bestStep}`;
    return remaining.length === 0 ? walkText : `${walkText},${encodeField(remaining)}`;
}
/**
 * Every value a bare `*` matches, after the day-of-week fold, ascending.
 * @param spec - Field bounds.
 * @returns Folded full value set (7 entries for day-of-week, not 8).
 */
function foldRange(spec) {
    const all = new Set();
    for (let value = spec.min; value <= spec.max; value += 1) {
        all.add(spec.foldMaxTo !== undefined && value === spec.max ? spec.foldMaxTo : value);
    }
    return [...all].sort((left, right) => left - right);
}
/**
 * Parse one field.
 * @param raw - Field text.
 * @param spec - Field bounds.
 * @returns Parsed field.
 */
function parseField(raw, spec) {
    const values = expandField(raw, spec);
    const star = raw.startsWith('*');
    return {
        values,
        canonical: star ? encodeStarField(values, spec) : encodeField(values),
        star,
    };
}
/**
 * Parse and canonicalize a 5-field Vixie cron expression.
 * @param expression - Candidate expression.
 * @returns Parsed spec with the canonical spelling attached.
 * @throws CronError with `code: 'invalid_cron'` and the offending `field`.
 */
export function parseCron(expression) {
    if (typeof expression !== 'string' || expression.trim() === '') {
        throw new CronError('cron expression must be a non-empty string', 'expression');
    }
    if (expression.trim() !== expression) {
        throw new CronError('cron expression must not have leading or trailing spaces', 'expression');
    }
    if (expression.startsWith('@')) {
        throw new CronError('cron macros such as "@daily" are not supported', 'expression');
    }
    if (expression.includes('#')) {
        throw new CronError('"#" (nth weekday of month) is not supported', 'expression');
    }
    if (!CRON_SAFE_CHARACTER.test(expression)) {
        // Distinguish the named Vixie extensions from plain English names so the
        // client can explain the actual mistake.
        if (/[LWlw]/.test(expression) && !/[A-Za-z]/.test(expression.replace(/[LWlw]/g, ''))) {
            throw new CronError(/[Ww]/.test(expression)
                ? '"W" (nearest weekday) is not supported'
                : '"L" (last day of month) is not supported', 'expression');
        }
        throw new CronError('cron fields must be numeric; names such as "MON" are not supported', 'expression');
    }
    const fields = expression.split(/\s+/);
    if (fields.length !== 5) {
        throw new CronError(`cron expression must contain exactly five whitespace-separated fields (minute hour day-of-month month day-of-week), got ${fields.length}`, 'expression');
    }
    const parsed = fields.map((field, index) => parseField(field, FIELD_SPECS[index]));
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed;
    return {
        expression: parsed.map((field) => field.canonical).join(' '),
        minutes: minute.values,
        hours: hour.values,
        daysOfMonth: dayOfMonth.values,
        months: month.values,
        daysOfWeek: dayOfWeek.values,
        dayOfMonthStar: dayOfMonth.star,
        dayOfWeekStar: dayOfWeek.star,
    };
}
/**
 * Canonicalize a cron expression without exposing the parsed structure.
 * @param expression - Candidate expression.
 * @returns Canonical 5-field spelling.
 * @throws CronError when invalid.
 */
export function canonicalizeCron(expression) {
    return parseCron(expression).expression;
}
/**
 * Whether a local wall clock matches a parsed cron expression.
 *
 * Evaluates Vixie's dom/dow AND/OR branch. `weekday` is ISO 1–7 and is folded
 * to the cron 0–6 scale (Sunday = 0) before the day-of-week test.
 * @param spec - Parsed expression.
 * @param parts - Local date and time to test (seconds ignored).
 * @param weekday - ISO weekday of that date (1 = Monday … 7 = Sunday).
 * @returns True when the expression fires at that wall clock.
 */
export function matchCron(spec, parts, weekday) {
    if (!spec.minutes.includes(parts.minute))
        return false;
    if (!spec.hours.includes(parts.hour))
        return false;
    if (!spec.months.includes(parts.month))
        return false;
    const cronWeekday = weekday % 7;
    const dayOfMonthMatch = spec.daysOfMonth.includes(parts.day);
    const dayOfWeekMatch = spec.daysOfWeek.includes(cronWeekday);
    if (!spec.dayOfMonthStar && !spec.dayOfWeekStar) {
        return dayOfMonthMatch || dayOfWeekMatch;
    }
    return dayOfMonthMatch && dayOfWeekMatch;
}
/**
 * Local times of day a parsed expression fires at, ascending.
 * @param spec - Parsed expression.
 * @returns `{hour, minute}` pairs.
 */
export function cronTimes(spec) {
    const times = [];
    for (const hour of spec.hours) {
        for (const minute of spec.minutes)
            times.push({ hour, minute });
    }
    return times;
}
/**
 * Whether a parsed expression can ever match a calendar date.
 *
 * Detects the classic impossible rules — `0 0 30 2 *` (February never has 30
 * days) and `0 0 31 4,6,9,11 *` — so callers can surface "该规则不会再次触发"
 * instead of scanning forever. A leap year (2024) is the most permissive case
 * for February, and 400 consecutive years would be needed to prove a
 * day-of-week rule impossible; every day-of-week value occurs in every month,
 * so one leap year is sufficient.
 * @param spec - Parsed expression.
 * @returns True when at least one date in a leap year matches.
 */
export function hasAnyMatchingDate(spec) {
    const hour = spec.hours[0];
    const minute = spec.minutes[0];
    if (hour === undefined || minute === undefined)
        return false;
    for (const month of spec.months) {
        const limit = new Date(Date.UTC(2024, month, 0)).getUTCDate();
        for (let day = 1; day <= limit; day += 1) {
            const js = new Date(Date.UTC(2024, month - 1, day)).getUTCDay();
            const weekday = js === 0 ? 7 : js;
            if (matchCron(spec, { year: 2024, month, day, hour, minute }, weekday))
                return true;
        }
    }
    return false;
}
