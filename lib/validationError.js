/**
 * The shared error type for user-input failures (§7.12).
 *
 * Lives in its own module so both `validate.ts` and `validateTime.ts` can throw
 * it without a circular import.
 */
/** A validation failure carrying its envelope code. */
export class ValidationError extends Error {
    /** Envelope code. */
    code;
    /** Field-level details for the UI to attach to an input. */
    details;
    /**
     * @param code - Envelope code.
     * @param message - Diagnostic.
     * @param details - Optional field-level context.
     */
    constructor(code, message, details) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.details = details;
    }
}
