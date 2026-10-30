/**
 * The F10 system prompt and user message.
 *
 * Kept in its own module so the wording can be reviewed and tested independently
 * of the transport. Every rule here is D-25 compliant: `once.endAt` is the only
 * deadline, `once.startAt` is optional, and a single spoken time becomes a
 * one-off window with the end defaulted to +1 hour.
 */
import type { NlpDraft } from './types.js';
/** Default fields the parser starts from. */
export declare function emptyNlpDraft(timeZone: string): NlpDraft;
/**
 * Build the system prompt.
 * @param now - Current instant (already in the target zone's wall clock).
 * @param timeZone - IANA zone.
 * @returns Prompt text.
 */
export declare function buildSystemPrompt(now: string, timeZone: string): string;
/**
 * Build the user message carrying the raw sentence.
 * @param text - User input.
 * @returns Message text.
 */
export declare function buildUserMessage(text: string): string;
