/**
 * Call the model and turn its answer into a draft (F10.1–F10.5).
 *
 * The parse path is deliberately fail-open: any transport, timeout or JSON
 * problem returns `degraded: true` with the raw sentence in `title`, so the user
 * always lands in the normal form instead of seeing an error dialog.
 */
import { buildSystemPrompt, buildUserMessage, emptyNlpDraft } from './prompt.js';
import { normalizeNlpOutput } from './normalize.js';
/** An answer that was not usable JSON. */
class BadOutput extends Error {
}
/**
 * Extract the first JSON object from a model answer (tolerates code fences).
 * @param text - Model output.
 * @returns Parsed JSON, or null when there is no object.
 */
export function extractJson(text) {
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start)
        return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
/**
 * Stream one model answer.
 * @param llm - LLM service.
 * @param selection - Provider/model route.
 * @param system - System prompt.
 * @param user - User message.
 * @param signal - Cancellation.
 * @returns Concatenated text deltas.
 */
async function collect(llm, selection, system, user, signal) {
    let text = '';
    for await (const chunk of llm.stream({
        provider: selection.provider,
        model: selection.model,
        messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
        system,
        maxTokens: 800,
        signal,
    })) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string')
            text += chunk.text;
    }
    return text;
}
/**
 * Build the degraded result used whenever parsing cannot complete.
 * @param text - Original sentence.
 * @param timeZone - Target zone.
 * @param reason - Why it degraded.
 * @returns A one-off draft carrying the raw text as the title.
 */
export function degradedResult(text, timeZone, reason) {
    const draft = emptyNlpDraft(timeZone);
    draft.kind = 'once';
    draft.title = text.trim().slice(0, 200);
    draft.startAtSource = 'created';
    return {
        draft,
        fieldStatus: { title: 'explicit', kind: 'missing', startAt: 'missing', endAt: 'missing' },
        missingRequired: ['endAt'],
        unsupported: [],
        confidence: 0,
        degraded: true,
        reason,
    };
}
/**
 * Parse one Chinese/English sentence into a task draft.
 * @param options - Text, clock, zone and LLM route.
 * @returns The draft plus provenance; never throws.
 */
export async function parseTaskText(options) {
    const { text, now, timeZone, llm, selection } = options;
    if (llm === undefined || selection === undefined)
        return degradedResult(text, timeZone, 'llm_unavailable');
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    const system = buildSystemPrompt(formatNow(now, timeZone), timeZone);
    try {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const answer = await collect(llm, selection, system, buildUserMessage(text), controller.signal);
                // A slow provider may resolve after the budget: never accept that answer.
                if (controller.signal.aborted)
                    break;
                const json = extractJson(answer);
                if (json === null)
                    throw new BadOutput('model did not return JSON');
                const normalized = normalizeNlpOutput(json, { now, timeZone, fallbackTitle: text });
                return { ...normalized, degraded: false };
            }
            catch (error) {
                lastError = error;
                if (controller.signal.aborted)
                    break;
            }
        }
        if (controller.signal.aborted)
            return degradedResult(text, timeZone, 'timeout');
        return degradedResult(text, timeZone, lastError instanceof BadOutput ? 'bad_output' : 'llm_unavailable');
    }
    finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
    }
}
/**
 * Render the current instant as a readable local wall-clock string.
 * @param now - Instant.
 * @param timeZone - IANA zone.
 * @returns `YYYY-MM-DD HH:mm (周X)`.
 */
export function formatNow(now, timeZone) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
            hourCycle: 'h23',
        }).formatToParts(now);
        const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
        return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')} ${pick('weekday')}`;
    }
    catch {
        return now.toISOString();
    }
}
