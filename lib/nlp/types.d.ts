/**
 * Natural-language task parsing (F10) — shared types.
 *
 * The parser never touches the store: it returns a draft plus provenance so the
 * editor can show what the model guessed. The user still has to save the form.
 */
/** Where a draft field came from (F10.3). */
export type NlpFieldSource = 'explicit' | 'default' | 'missing';
/** The draft shape; mirrors the client `TaskDraft` so it can be merged directly. */
export interface NlpDraft {
    kind: 'recurring' | 'once';
    title: string;
    description: string;
    timeZone: string;
    preset: 'workdays' | 'weekly' | 'monthly' | 'custom';
    time: string;
    weekdays: number[];
    monthDays: number[];
    holidayCalendar: 'CN' | 'none';
    monthlyOverflow: 'lastDay' | 'skip';
    skipDates: string[];
    extraWorkdays: string[];
    channels: ('overlay' | 'system')[];
    advanceMinutes: number;
    sound: boolean;
    template: string;
    startAt: string;
    endAt: string;
    endReminder: boolean;
    startAtSource: 'explicit' | 'created';
}
/** Parse outcome returned by `POST /parse` (F10.1–F10.5). */
export interface NlpParseResult {
    draft: NlpDraft;
    fieldStatus: Record<string, NlpFieldSource>;
    missingRequired: string[];
    unsupported: string[];
    confidence: number;
    /** True when the model was unavailable or returned unusable output. */
    degraded: boolean;
    /** Error code for the degraded path, when any. */
    reason?: 'llm_unavailable' | 'timeout' | 'bad_output' | 'disabled';
}
/** The minimal LLM surface the parser needs (satisfied by `ctx.llm`). */
export interface NlpLlm {
    stream(options: {
        provider: string;
        model: string;
        messages: {
            role: 'user';
            content: {
                type: 'text';
                text: string;
            }[];
        }[];
        system?: string;
        maxTokens?: number;
        signal?: AbortSignal;
    }): AsyncIterable<{
        type: string;
        text?: string;
    }>;
}
/** Provider/model route used for the parse call. */
export interface NlpSelection {
    provider: string;
    model: string;
}
