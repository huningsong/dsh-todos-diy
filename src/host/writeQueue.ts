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
  run<T>(work: () => T | Promise<T>): Promise<T>
  /** Whether work is queued or running right now. */
  readonly busy: boolean
  /** Stop the debounce timer and fail any pending item. */
  dispose(): void
}

/**
 * Create a FIFO queue that awaits each item before starting the next.
 * @returns Queue handle.
 */
export function createWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve()
  let pending = 0
  let disposed = false

  return {
    run<T>(work: () => T | Promise<T>): Promise<T> {
      if (disposed) return Promise.reject(new Error('write queue disposed'))
      pending += 1
      const next = tail.then(work, work)
      // Keep the chain alive even when one item rejects.
      tail = next.then(
        () => undefined,
        () => undefined,
      )
      return next.finally(() => {
        pending -= 1
      }) as Promise<T>
    },
    get busy() {
      return pending > 0
    },
    dispose() {
      disposed = true
    },
  }
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
export function createDebouncedFlush(
  flush: () => void,
  delayMs: number,
  setTimer: (callback: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  clearTimer: (handle: ReturnType<typeof setTimeout>) => void = clearTimeout,
): { schedule(): void; flushNow(): void; dispose(): void; readonly pending: boolean } {
  let handle: ReturnType<typeof setTimeout> | null = null
  let requested = false

  const run = (): void => {
    handle = null
    if (!requested) return
    requested = false
    flush()
  }

  return {
    schedule() {
      requested = true
      if (handle !== null) return
      handle = setTimer(run, delayMs)
    },
    flushNow() {
      if (handle !== null) {
        clearTimer(handle)
        handle = null
      }
      run()
    },
    dispose() {
      if (handle !== null) {
        clearTimer(handle)
        handle = null
      }
      run()
    },
    get pending() {
      return requested
    },
  }
}
