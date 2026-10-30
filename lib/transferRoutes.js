/**
 * Import / export routes (§7.8 / F9.4).
 *
 * Split from `routes.ts` to stay inside the NF5 budget. Export serializes the
 * whole document; import validates first, backs the live file up, and only then
 * mutates memory.
 */
import { route, sendJson } from './http.js';
import { ok, readObjectBody } from './routeKit.js';
import { backupBeforeImport, buildExport, mergeTasks, parseImport, settingsExport } from './transfer.js';
import { defaultSettings } from './state.js';
import { assertStoreWritable } from './repoGuard.js';
import { ValidationError } from './validationError.js';
/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy';
/**
 * Build the import/export routes.
 * @param ctx - Route context.
 * @param options - Admission gate and logger.
 * @returns Route definitions.
 */
export function transferRoutes(ctx, options) {
    const routes = [
        {
            kind: 'exact',
            path: `${PREFIX}/export`,
            handler: route(options, 'GET', async (_req, res) => {
                const bundle = buildExport(ctx.store.state, ctx.now());
                const body = JSON.stringify(bundle, null, 2);
                res.writeHead(200, {
                    'cache-control': 'no-store',
                    'content-type': 'application/json; charset=utf-8',
                    'content-disposition': `attachment; filename="dsh-todos-diy-${ctx.now().toISOString().slice(0, 10)}.json"`,
                    'content-length': String(Buffer.byteLength(body)),
                });
                res.end(body);
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/import`,
            handler: route(options, 'POST', async (req, res) => {
                assertStoreWritable(ctx.store);
                const body = await readObjectBody(req);
                const mode = body['mode'];
                if (mode !== 'replace' && mode !== 'merge') {
                    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'mode must be replace or merge' } });
                    return;
                }
                let candidate;
                try {
                    candidate = parseImport(body['payload']);
                }
                catch (error) {
                    const code = error.code ?? 'schema_mismatch';
                    sendJson(res, 400, { error: { code, message: String(error.message) } });
                    return;
                }
                const backupFile = backupBeforeImport(ctx.store.paths.stateFile, ctx.now());
                const current = ctx.store.state;
                let imported = candidate.tasks.length;
                if (mode === 'replace') {
                    current.tasks = candidate.tasks;
                    current.deliveries = candidate.deliveries;
                    if (candidate.settings !== null)
                        current.settings = { ...defaultSettings(), ...candidate.settings };
                }
                else {
                    const merged = mergeTasks(current.tasks, candidate.tasks);
                    current.tasks = merged.tasks;
                    // `imported` must report what the merge actually added, not the
                    // number of rows in the file (F9.4 "merge 按 id 去重").
                    imported = merged.added;
                }
                ctx.store.set(current);
                if (!ctx.store.flush()) {
                    throw new ValidationError('storage_error', 'failed to write tasks.json; the import was not persisted');
                }
                ok(res, {
                    imported,
                    skipped: candidate.skipped,
                    backupFile,
                    mode,
                    warnings: candidate.warnings,
                });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/settings/export`,
            handler: route(options, 'GET', async (_req, res) => {
                const body = settingsExport(ctx.repo.settings(), ctx.now());
                res.writeHead(200, {
                    'cache-control': 'no-store',
                    'content-type': 'application/json; charset=utf-8',
                    'content-disposition': 'attachment; filename="dsh-todos-diy-settings.json"',
                    'content-length': String(Buffer.byteLength(body)),
                });
                res.end(body);
            }),
        },
    ];
    return routes;
}
