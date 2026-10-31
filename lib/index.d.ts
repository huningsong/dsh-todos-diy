/**
 * dsh-todos-diy — host entry.
 *
 * Mounted by the `todos-diy` loader row from `cordis.patch.yml`. Order follows
 * §7.6 / F6.3: **load → migrate → ready → tick**. The scheduler starts only
 * after the store has been read and validated, so a corrupt file can never
 * trigger a reminder, and no UI has to be opened for reminders to work.
 *
 * Zero `@deepseek-ai/*` runtime imports: only Node built-ins.
 */
import type { Task } from './rules/types.js';
import { sendError } from './http.js';
import { emptyState } from './state.js';
/** Loader/display identity; the package name is `dsh-todos-diy`. */
export declare const name = "dsh-todos-diy";
/**
 * Required services. `timer` supplies `ctx.interval` / `ctx.timeout`
 * (`cordis-plugin-timer`). Everything else is acquired optionally through
 * `ctx.inject`, so a minimal composition still loads this plugin.
 */
export declare const inject: string[];
/** Plugin version reported by `/health`; kept in sync with `package.json`. */
export declare const PLUGIN_VERSION = "0.5.2";
/**
 * Mount the plugin on the host context.
 * @param ctx - Cordis context.
 * @param rawConfig - Loader row config from `cordis.patch.yml`.
 */
export declare function apply(ctx: any, rawConfig: unknown): void;
export { sendError };
export { emptyState };
export type { Task };
