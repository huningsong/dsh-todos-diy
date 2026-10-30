/**
 * Atomic single-file JSON storage (D-23 / F6.5).
 *
 * Write protocol: `writeFile(tmp)` → `rename(tmp, target)`. `rename` within one
 * directory is atomic on POSIX, so a reader (or a crash) only ever observes the
 * previous complete file or the new complete file — never a half-written one.
 * `fsync` is deliberately skipped (v1 accepts the documented risk: a power loss
 * right after `rename` may fall back to the previous version).
 *
 * Everything filesystem-related lives behind the `FileSystem` interface so the
 * store can be unit-tested against an in-memory double, including injected
 * `ENOSPC` / `EACCES` failures (§10.1 "存储测试").
 */
import { dirname } from 'node:path';
import { type PersistedState, type RecoveryRecord } from './state.js';
import { storagePaths, type StoragePaths } from './paths.js';
/** Minimal synchronous filesystem surface used by the store. */
export interface FileSystem {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    rename(from: string, to: string): void;
    unlink(path: string): void;
    mkdir(path: string): void;
    exists(path: string): boolean;
    copyFile(from: string, to: string): void;
    mtimeMs(path: string): number;
}
/** Real `node:fs` implementation. */
export declare const nodeFileSystem: FileSystem;
/** Storage lifecycle state surfaced through `/health`. */
export type StorageState = 'ready' | 'unsupported-version' | 'migration-failed' | 'corrupt';
/** Logger surface. */
export interface StoreLogger {
    info?: (message: string) => void;
    warn?: (message: string) => void;
}
/** Options for {@link createStore}. */
export interface StoreOptions {
    dataDir: string;
    fs?: FileSystem;
    logger?: StoreLogger;
    /** Clock used for metadata and backup file names. */
    now?: () => Date;
}
/** Public store interface. */
export interface Store {
    readonly paths: StoragePaths;
    /** The document currently held in memory. */
    state: PersistedState;
    /** Storage health for `/health`. */
    readonly stateName: StorageState;
    /** Last recovery event, if any. */
    readonly lastRecovery: RecoveryRecord | null;
    /** Load (or create) the document synchronously. Safe to call once at startup. */
    load(): PersistedState;
    /**
     * Replace the whole in-memory document and mark it dirty.
     * @param next - New document.
     */
    set(next: PersistedState): void;
    /** Serialize pending changes to disk (tmp + rename). Returns false on failure. */
    flush(): boolean;
    /** Whether `flush()` would write anything. */
    readonly dirty: boolean;
    /** Mark the in-memory document as needing a write (mutations done in place). */
    markDirty(): void;
    /** Force a synchronous flush and drop the pending flag (disposal path). */
    flushSync(): void;
    /** `mtimeMs` of the state file, or null when absent. Used by write-amplification tests. */
    fileMtimeMs(): number | null;
}
/**
 * Create the store for one data directory.
 *
 * Loading order (F6.3): read → parse → migrate → validate → build the in-memory
 * state. No delivery can happen during load because the caller starts the timer
 * only afterwards.
 * @param options - Data directory, filesystem, logger and clock.
 * @returns Store handle.
 */
export declare function createStore(options: StoreOptions): Store;
/** Re-exported so callers can type against the state without importing `state.ts`. */
export type { PersistedState };
export { storagePaths };
export { dirname };
