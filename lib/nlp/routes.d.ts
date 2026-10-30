/**
 * `POST /parse` — natural-language task parsing (F10.1/F10.5).
 *
 * The route is inert until the user turns the feature on: the settings flag is
 * the consent gate, and everything else degrades to a plain form.
 */
import { sendJson } from '../http.js';
import { ok } from '../routeKit.js';
import type { NlpLlm, NlpSelection } from './types.js';
import type { RouteContext, RouteDefinition } from '../routes.js';
/** The LLM-shaped slice of the DSH context (absent on very old hosts). */
export interface NlpHost {
    llm?: NlpLlm & {
        listProviders?: () => {
            id: string;
            name: string;
        }[];
        listModels?: (provider: string) => Promise<{
            id: string;
            name: string;
        }[]>;
    };
    agentDefaultModel?: {
        currentSelection?: () => {
            provider?: string;
            model?: string;
        } | null;
    };
}
/**
 * Resolve the provider/model route.
 * @param host - LLM services from the context.
 * @returns A usable selection, or undefined when no model route exists.
 */
export declare function resolveSelection(host: NlpHost): Promise<NlpSelection | undefined>;
/**
 * Build the parse route.
 * @param ctx - Route context carrying repo/clock plus optional LLM services.
 * @returns One route definition.
 */
export declare function createNlpRoutes(ctx: RouteContext): RouteDefinition[];
/** Re-exported so tests can build the same shape without HTTP. */
export { ok, sendJson };
