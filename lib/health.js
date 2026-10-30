/**
 * `/health` payload assembly (NF10).
 *
 * Kept separate from the route so the shape is unit-testable without a fake
 * request, and so M2 can add storage facts without touching routing code.
 */
/**
 * Create a health holder.
 * @param version - Plugin version.
 * @param config - Effective config (echoed for support).
 * @param warnings - Config fallbacks applied at load time.
 * @returns Mutable health state.
 */
export function createHealthState(version, config, warnings) {
    const startedAt = Date.now();
    const state = {
        running: false,
        lastTickAt: null,
        nextWakeAt: null,
        skippedTicks: 0,
        lastErrorAt: null,
        lastError: null,
        taskCount: 0,
        holidayYears: [],
        holidaySource: 'unknown',
        storagePath: '',
        storageState: 'ready',
        storageRecovery: null,
        archiveLastRunAt: null,
        archiveLastArchived: [],
        toolCount: 0,
        dndHeld: 0,
        systemNotification: null,
        readOnlyFlag: false,
    };
    return {
        recordTick(now, plan, taskCount, todayLocalDate) {
            state.running = true;
            state.lastTickAt = now.toISOString();
            state.nextWakeAt = plan.nextWakeAt === null ? null : plan.nextWakeAt.toISOString();
            state.taskCount = taskCount;
            // D-25: priority is derived on every read, so there is no daily refresh
            // timestamp any more (F4.13 / AC-32). `todayLocalDate` is kept for the
            // task-count diagnostics only.
            void todayLocalDate;
        },
        recordSkippedTick() {
            state.skippedTicks += 1;
        },
        recordError(error, now) {
            state.lastErrorAt = now.toISOString();
            state.lastError = error instanceof Error ? error.message : String(error);
        },
        markStopped() {
            state.running = false;
        },
        setHolidayCoverage(years, source) {
            state.holidayYears = years;
            state.holidaySource = source;
        },
        setStorage(path, stateName, recovery) {
            state.storagePath = path;
            state.storageState = stateName;
            state.storageRecovery = recovery;
        },
        markRunning() {
            state.running = true;
        },
        recordArchive(archived) {
            state.archiveLastRunAt = new Date().toISOString();
            state.archiveLastArchived = archived;
        },
        setToolCount(count) {
            state.toolCount = count;
        },
        recordDndHeld(count) {
            state.dndHeld += count;
        },
        setSystemNotificationCapability(granted) {
            state.systemNotification = granted;
        },
        markReadOnly() {
            state.readOnlyFlag = true;
        },
        snapshot(holidays) {
            return {
                version,
                uptimeMs: Date.now() - startedAt,
                dshVersion: readDshVersion(),
                scheduler: {
                    running: state.running,
                    lastTickAt: state.lastTickAt,
                    nextWakeAt: state.nextWakeAt,
                    skippedTicks: state.skippedTicks,
                    lastErrorAt: state.lastErrorAt,
                    lastError: state.lastError,
                },
                storage: {
                    path: state.storagePath,
                    // Only `ready` means the file is usable; a corrupt/migration failure
                    // is reported as unhealthy so the UI can show its banner (F6.7).
                    healthy: state.storageState === 'ready',
                    state: state.storageState,
                    lastRecovery: state.storageRecovery,
                },
                capabilities: {
                    systemNotification: state.systemNotification,
                    holidayCalendar: {
                        available: state.holidayYears.length > 0,
                        years: state.holidayYears,
                        source: state.holidaySource,
                    },
                    agentTools: state.toolCount,
                },
                config: { ...config, warnings },
                taskCount: state.taskCount,
                archive: { lastRunAt: state.archiveLastRunAt, lastArchived: state.archiveLastArchived },
                dndHeld: state.dndHeld,
                readOnly: state.readOnlyFlag,
            };
        },
    };
}
/**
 * The DSH runtime version, when the host exports it.
 *
 * §7.11: read `DSH_VERSION` only; never guess and never reach into app-boot.
 * @returns Version string, or null when unavailable.
 */
function readDshVersion() {
    const value = process.env['DSH_VERSION'];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
/** Local `YYYY-MM-DD` of an instant in a zone. */
function localDateKeyOf(instant, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(instant);
    const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
