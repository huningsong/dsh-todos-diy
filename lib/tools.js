/**
 * Tool registration plus the caller gate for `todo_reminder_*` (F7.9–F7.11).
 *
 * Tools are registered with **raw JSON Schema** rather than `defineTool`, so the
 * host half keeps zero `@deepseek-ai/*` runtime imports (§7.10). Every tool calls
 * the same repository methods as the HTTP routes, which is what makes F7.11
 * ("不允许绕过状态机") true by construction.
 *
 * F7.10 (v1.3): tools are **not** bound to an Agent session. A main-session
 * turn, a delegated sub-agent and a programmatic host call all work; nothing is
 * ever posted back into a conversation (D-02). `assertToolCaller` therefore
 * accepts every caller and exists only as the single place a future policy
 * would live.
 */
import { createToolDefinitions } from './toolDefs.js';
/** A tool failure the model reads as a structured JSON envelope. */
export class ToolFailure extends Error {
    /** The structured envelope carried in `message`. */
    payload;
    /**
     * @param code - Envelope code (§7.12).
     * @param message - Diagnostic.
     * @param details - Optional extra context.
     */
    constructor(code, message, details) {
        super(JSON.stringify(details === undefined ? { code, message } : { code, message, details }));
        this.name = 'ToolFailure';
        this.payload = details === undefined ? { code, message } : { code, message, details };
    }
}
/**
 * Delegation depth of the calling agent (0 for a main-session call).
 *
 * Reads both signals the harness exposes: the session header's
 * `delegationDepth` and the agent runtime's `subagentDepth`.
 * @param exec - Tool execution context.
 * @returns Non-negative depth.
 */
export function delegationDepthOf(exec) {
    const header = exec.agent?.session?.header?.delegationDepth;
    const runtime = exec.agent?.options?.subagentDepth;
    const fromHeader = typeof header === 'number' && Number.isSafeInteger(header) ? header : 0;
    const fromRuntime = typeof runtime === 'number' && Number.isSafeInteger(runtime) ? runtime : 0;
    return Math.max(fromHeader, fromRuntime);
}
/**
 * Caller policy for F7.10 (v1.3): every caller is allowed.
 *
 * Reminders are global data, not session data (D-02), so there is nothing to
 * scope by agent, depth or session. Kept as a function so every tool body has a
 * single, uniform hook.
 * @param _exec - Tool execution context (unused).
 */
export function assertToolCaller(_exec) {
    // Intentionally empty: see the F7.10 (v1.3) note in the module header.
}
/**
 * Register all nine tools through one disposer.
 * @param toolCtx - Context carrying `tools.register`.
 * @param deps - Repository, holiday table and clock.
 * @returns Disposer that unregisters every tool.
 */
export function registerTools(toolCtx, deps) {
    const disposers = createToolDefinitions(deps).map((definition) => toolCtx.tools.register(definition));
    return () => {
        for (const dispose of disposers) {
            if (typeof dispose === 'function')
                dispose();
        }
    };
}
export { createToolDefinitions };
