/**
 * `/health` payload assembly (NF10).
 *
 * Kept separate from the route so the shape is unit-testable without a fake
 * request, and so M2 can add storage facts without touching routing code.
 */
import type { PluginConfig } from './config.js';
import type { HolidayTable } from './rules/holidays.js';
import type { TickPlan } from './rules/types.js';
/** Storage lifecycle states mirrored from `store.ts`. */
export type StorageStateName = 'ready' | 'unsupported-version' | 'migration-failed' | 'corrupt';
/** A recovery event as surfaced to the UI. */
export interface RecoveryInfo {
    at: string;
    reason: string;
    message: string;
    backupFile: string | null;
}
/** Mutable scheduler facts the tick updates. */
export interface HealthState {
    /** Replace the tick facts after a successful pass. */
    recordTick(now: Date, plan: TickPlan, taskCount: number, todayLocalDate?: string): void;
    /** Record a tick that was skipped because the previous one was still running. */
    recordSkippedTick(): void;
    /** Record a failed tick without stopping the scheduler. */
    recordError(error: unknown, now: Date): void;
    /** Mark the scheduler as stopped (plugin disposal). */
    markStopped(): void;
    /** Record the holiday coverage discovered at load time. */
    setHolidayCoverage(years: number[], source: string): void;
    /** Record the storage facts discovered at load time. */
    setStorage(path: string, state: StorageStateName, recovery: RecoveryInfo | null): void;
    /** Mark the scheduler as running (before the first successful tick). */
    markRunning(): void;
    /** Record one archive run that moved tasks. */
    recordArchive(archived: {
        quarter: string;
        count: number;
    }[]): void;
    /** Record how many agent tools were registered (0 when `tools` is absent). */
    setToolCount(count: number): void;
    /** Record that DND held `count` reminders in the latest tick. */
    recordDndHeld(count: number): void;
    /** Record the browser's Notification permission as reported by the client. */
    setSystemNotificationCapability(granted: boolean): void;
    /** Mark this process as read-only because the file is newer than the plugin. */
    markReadOnly(): void;
    /** Build the `value` object of `GET /health`. */
    snapshot(holidays: HolidayTable): HealthSnapshot;
}
/** The `value` object returned by `GET /health`. */
export interface HealthSnapshot {
    version: string;
    uptimeMs: number;
    dshVersion: string | null;
    scheduler: {
        running: boolean;
        lastTickAt: string | null;
        nextWakeAt: string | null;
        lastPriorityRefreshAt: string | null;
        skippedTicks: number;
        lastErrorAt: string | null;
        lastError: string | null;
    };
    storage: {
        path: string;
        healthy: boolean;
        state: 'ready' | 'unsupported-version' | 'migration-failed' | 'corrupt';
        lastRecovery: unknown;
    };
    capabilities: {
        /**
         * Whether the browser granted the Notification permission, as reported by
         * the client. `null` means "not reported yet" — the host cannot inspect a
         * browser API, and guessing `true` would make AC-15 unverifiable.
         */
        systemNotification: boolean | null;
        holidayCalendar: {
            available: boolean;
            years: number[];
            source: string;
        };
        /** Number of `todo_reminder_*` tools registered in this composition. */
        agentTools: number;
    };
    config: PluginConfig & {
        warnings: string[];
    };
    taskCount: number;
    archive: {
        lastRunAt: string | null;
        lastArchived: {
            quarter: string;
            count: number;
        }[];
    };
    /** Reminders held by DND since startup (surfaced for diagnostics). */
    dndHeld: number;
    /** True when the on-disk file belongs to a newer plugin (F6.8). */
    readOnly: boolean;
}
/**
 * Create a health holder.
 * @param version - Plugin version.
 * @param config - Effective config (echoed for support).
 * @param warnings - Config fallbacks applied at load time.
 * @returns Mutable health state.
 */
export declare function createHealthState(version: string, config: PluginConfig, warnings: string[]): HealthState;
