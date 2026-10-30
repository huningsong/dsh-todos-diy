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
import { createToolDefinitions, type ToolDeps } from './toolDefs.js';
/** Minimal shape of a tool definition the registry accepts. */
export interface RawToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render: (args: unknown, value: unknown) => {
            type: 'text';
            text: string;
        }[];
    };
    execute: (args: Record<string, unknown>, exec: ToolExec) => Promise<unknown>;
}
/** The slice of `exec` the tools rely on. */
export interface ToolExec {
    /** Present only for a real agent turn; absent for programmatic calls. */
    agent?: {
        session?: {
            header?: {
                delegationDepth?: number;
            };
        };
        options?: {
            subagentDepth?: number;
        };
    };
    signal?: AbortSignal;
}
/** A tool failure the model reads as a structured JSON envelope. */
export declare class ToolFailure extends Error {
    /** The structured envelope carried in `message`. */
    readonly payload: {
        code: string;
        message: string;
        details?: unknown;
    };
    /**
     * @param code - Envelope code (§7.12).
     * @param message - Diagnostic.
     * @param details - Optional extra context.
     */
    constructor(code: string, message: string, details?: unknown);
}
/**
 * Delegation depth of the calling agent (0 for a main-session call).
 *
 * Reads both signals the harness exposes: the session header's
 * `delegationDepth` and the agent runtime's `subagentDepth`.
 * @param exec - Tool execution context.
 * @returns Non-negative depth.
 */
export declare function delegationDepthOf(exec: ToolExec): number;
/**
 * Caller policy for F7.10 (v1.3): every caller is allowed.
 *
 * Reminders are global data, not session data (D-02), so there is nothing to
 * scope by agent, depth or session. Kept as a function so every tool body has a
 * single, uniform hook.
 * @param _exec - Tool execution context (unused).
 */
export declare function assertToolCaller(_exec: ToolExec): void;
/**
 * Register all nine tools through one disposer.
 * @param toolCtx - Context carrying `tools.register`.
 * @param deps - Repository, holiday table and clock.
 * @returns Disposer that unregisters every tool.
 */
export declare function registerTools(toolCtx: {
    tools: {
        register: (definition: RawToolDefinition) => unknown;
    };
}, deps: ToolDeps): () => void;
export { createToolDefinitions };
export type { ToolDeps };
