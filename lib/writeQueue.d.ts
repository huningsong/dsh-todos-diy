/**
 * Serialized write queue (§7.7.2 "单进程内 Promise 队列串行").
 *
 * Every mutation goes through one queue so two concurrent `POST /tasks/update`
 * requests cannot interleave read-modify-write. A debounce window turns a burst
 * of updates into one physical write (F6.9 "1 秒内 50 次更新只产生 ≤2 次写").
 */
/** Queue handle. */
export interface WriteQueue {
    /**
     * Run one mutation exclusively.
     * @param work - Work to run inside the critical section.
     * @returns Whatever `work` returns.
     */
    run<T>(work: () => T | Promise<T>): Promise<T>;
    /** Whether work is queued or running right now. */
    readonly busy: boolean;
    /** Stop the debounce timer and fail any pending item. */
    dispose(): void;
}
/**
 * Create a FIFO queue that awaits each item before starting the next.
 * @returns Queue handle.
 */
export declare function createWriteQueue(): WriteQueue;
/**
 * Create a write scheduler that coalesces a burst into one flush.
 *
 * `schedule()` marks the store dirty and arms a timer; `flushNow()` cancels the
 * timer and flushes immediately (used on disposal and by tests).
 * @param flush - Function that performs the physical write.
 * @param delayMs - Debounce window.
 * @param setTimer - Timer factory (injectable for tests).
 * @param clearTimer - Timer canceller (injectable for tests).
 * @returns Scheduler handle.
 */
export declare function createDebouncedFlush(flush: () => void, delayMs: number, setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>, clearTimer?: (handle: ReturnType<typeof setTimeout>) => void): {
    schedule(): void;
    flushNow(): void;
    dispose(): void;
    readonly pending: boolean;
};
