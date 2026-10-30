/**
 * Tool registration plus the caller gate for `todo_reminder_*` (F7.9–F7.11).
 *
 * Tools are registered with **raw JSON Schema** rather than `defineTool`, so the
 * host half keeps zero `@deepseek-ai/*` runtime imports (§7.10). Every tool calls
 * the same repository methods as the HTTP routes, which is what makes F7.11
 * ("不允许绕过状态机") true by construction.
 *
 * F7.10: a call is refused when it has no `exec.agent` (nothing to report back
 * to) or when the caller is a delegated sub-agent. The DSH tool pipeline turns a
 * throw into an `isError` tool result, so a refusal **throws** a `ToolFailure`
 * whose message is the JSON `{code:'forbidden', ...}` envelope — the model still
 * sees a structured, machine-readable code.
 */

import { createToolDefinitions, type ToolDeps } from './toolDefs.js'

/** Minimal shape of a tool definition the registry accepts. */
export interface RawToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render: (args: unknown, value: unknown) => { type: 'text'; text: string }[]
  }
  execute: (args: Record<string, unknown>, exec: ToolExec) => Promise<unknown>
}

/** The slice of `exec` the tools rely on. */
export interface ToolExec {
  /** Present only for a real agent turn; absent for programmatic calls. */
  agent?: {
    session?: { header?: { delegationDepth?: number } }
    options?: { subagentDepth?: number }
  }
  signal?: AbortSignal
}

/** A tool failure the model reads as a structured JSON envelope. */
export class ToolFailure extends Error {
  /** The structured envelope carried in `message`. */
  readonly payload: { code: string; message: string; details?: unknown }

  /**
   * @param code - Envelope code (§7.12).
   * @param message - Diagnostic.
   * @param details - Optional extra context.
   */
  constructor(code: string, message: string, details?: unknown) {
    super(JSON.stringify(details === undefined ? { code, message } : { code, message, details }))
    this.name = 'ToolFailure'
    this.payload = details === undefined ? { code, message } : { code, message, details }
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
export function delegationDepthOf(exec: ToolExec): number {
  const header = exec.agent?.session?.header?.delegationDepth
  const runtime = exec.agent?.options?.subagentDepth
  const fromHeader = typeof header === 'number' && Number.isSafeInteger(header) ? header : 0
  const fromRuntime = typeof runtime === 'number' && Number.isSafeInteger(runtime) ? runtime : 0
  return Math.max(fromHeader, fromRuntime)
}

/**
 * Enforce F7.10 before any tool body runs.
 * @param exec - Tool execution context.
 * @throws ToolFailure `forbidden` when the caller may not manage reminders.
 */
export function assertToolCaller(exec: ToolExec): void {
  if (exec.agent === undefined) {
    throw new ToolFailure('forbidden', 'todo_reminder_* tools must be called from an agent session')
  }
  if (delegationDepthOf(exec) > 0) {
    throw new ToolFailure('forbidden', 'sub-agents may not manage the user’s todo reminders')
  }
}

/**
 * Register all nine tools through one disposer.
 * @param toolCtx - Context carrying `tools.register`.
 * @param deps - Repository, holiday table and clock.
 * @returns Disposer that unregisters every tool.
 */
export function registerTools(
  toolCtx: { tools: { register: (definition: RawToolDefinition) => unknown } },
  deps: ToolDeps,
): () => void {
  const disposers = createToolDefinitions(deps).map((definition) => toolCtx.tools.register(definition))
  return () => {
    for (const dispose of disposers) {
      if (typeof dispose === 'function') (dispose as () => void)()
    }
  }
}

export { createToolDefinitions }
export type { ToolDeps }
