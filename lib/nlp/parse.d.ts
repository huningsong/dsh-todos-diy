/**
 * Call the model and turn its answer into a draft (F10.1–F10.5).
 *
 * The parse path is deliberately fail-open: any transport, timeout or JSON
 * problem returns `degraded: true` with the raw sentence in `title`, so the user
 * always lands in the normal form instead of seeing an error dialog.
 */
import type { NlpLlm, NlpParseResult, NlpSelection } from './types.js';
/** Everything the parser needs. */
export interface ParseTaskTextOptions {
    text: string;
    now: Date;
    timeZone: string;
    llm: NlpLlm | undefined;
    selection: NlpSelection | undefined;
    signal?: AbortSignal;
    /** Model call budget; the route uses 8 s (F10.5). */
    timeoutMs?: number;
}
/**
 * Extract the first JSON object from a model answer (tolerates code fences).
 * @param text - Model output.
 * @returns Parsed JSON, or null when there is no object.
 */
export declare function extractJson(text: string): unknown;
/**
 * Build the degraded result used whenever parsing cannot complete.
 * @param text - Original sentence.
 * @param timeZone - Target zone.
 * @param reason - Why it degraded.
 * @returns A one-off draft carrying the raw text as the title.
 */
export declare function degradedResult(text: string, timeZone: string, reason: NlpParseResult['reason']): NlpParseResult;
/**
 * Parse one Chinese/English sentence into a task draft.
 * @param options - Text, clock, zone and LLM route.
 * @returns The draft plus provenance; never throws.
 */
export declare function parseTaskText(options: ParseTaskTextOptions): Promise<NlpParseResult>;
/**
 * Render the current instant as a readable local wall-clock string.
 * @param now - Instant.
 * @param timeZone - IANA zone.
 * @returns `YYYY-MM-DD HH:mm (周X)`.
 */
export declare function formatNow(now: Date, timeZone: string): string;
