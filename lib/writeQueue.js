/**
 * Serialized write queue (§7.7.2 "单进程内 Promise 队列串行").
 *
 * Every mutation goes through one queue so two concurrent `POST /tasks/update`
 * requests cannot interleave read-modify-write. A debounce window turns a burst
 * of updates into one physical write (F6.9 "1 秒内 50 次更新只产生 ≤2 次写").
 */
/**
 * Create a FIFO queue that awaits each item before starting the next.
 * @returns Queue handle.
 */
export function createWriteQueue() {
    let tail = Promise.resolve();
    let pending = 0;
    let disposed = false;
    return {
        run(work) {
            if (disposed)
                return Promise.reject(new Error('write queue disposed'));
            pending += 1;
            const next = tail.then(work, work);
            // Keep the chain alive even when one item rejects.
            tail = next.then(() => undefined, () => undefined);
            return next.finally(() => {
                pending -= 1;
            });
        },
        get busy() {
            return pending > 0;
        },
        dispose() {
            disposed = true;
        },
    };
}
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
export function createDebouncedFlush(flush, delayMs, setTimer = setTimeout, clearTimer = clearTimeout) {
    let handle = null;
    let requested = false;
    const run = () => {
        handle = null;
        if (!requested)
            return;
        requested = false;
        flush();
    };
    return {
        schedule() {
            requested = true;
            if (handle !== null)
                return;
            handle = setTimer(run, delayMs);
        },
        flushNow() {
            if (handle !== null) {
                clearTimer(handle);
                handle = null;
            }
            run();
        },
        dispose() {
            if (handle !== null) {
                clearTimer(handle);
                handle = null;
            }
            run();
        },
        get pending() {
            return requested;
        },
    };
}
