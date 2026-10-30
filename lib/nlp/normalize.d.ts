/**
 * Normalize a model answer into a draft (F10.4–F10.6).
 *
 * The model may be vague or wrong; this layer enforces the D-25 invariants that
 * matter before the form is shown, and records which fields were guessed so the
 * editor can mark them.
 */
import type { NlpDraft, NlpFieldSource } from './types.js';
/** Result of a successful normalization. */
export interface NormalizedNlp {
    draft: NlpDraft;
    fieldStatus: Record<string, NlpFieldSource>;
    missingRequired: string[];
    unsupported: string[];
    confidence: number;
}
/**
 * Clean a title: strip filler prefixes and clamp to the API limit.
 * @param raw - Candidate title.
 * @param fallback - Text to use when the model gave nothing usable.
 * @returns Title within 1–200 characters.
 */
export declare function cleanTitle(raw: unknown, fallback: string): string;
/** Whether a value looks like a local `YYYY-MM-DDTHH:mm` value. */
export declare function isLocalDateTime(value: unknown): value is string;
/**
 * Format a local wall-clock value plus an offset in minutes.
 * @param value - `YYYY-MM-DDTHH:mm`.
 * @param minutes - Minutes to add.
 * @returns New local value.
 */
export declare function addMinutesLocal(value: string, minutes: number): string;
/**
 * Normalize one model answer.
 * @param raw - Parsed JSON from the model.
 * @param options - Clock and target zone.
 * @returns A usable draft plus provenance.
 */
export declare function normalizeNlpOutput(raw: unknown, options: {
    now: Date;
    timeZone: string;
    fallbackTitle?: string;
}): NormalizedNlp;
