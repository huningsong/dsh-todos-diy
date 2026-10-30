/**
 * Shared task/rule data model.
 *
 * Mirrors `需求-v1.md` §7.4. Everything here is plain data: no dates are read
 * from the system clock, no file is touched. `rules/*` may import this module
 * freely; only `store.ts` / `repo.ts` are allowed to do IO.
 */
/** Recurrence preset shown to users; the stored `cron` is always canonical. */
export type RulePreset = 'workdays' | 'weekly' | 'monthly' | 'custom';
/** Monthly overflow policy for days 29–31 that do not exist in a month. */
export type MonthlyOverflow = 'skip' | 'lastDay';
/** Which holiday calendar a `workdays` rule follows. */
export type HolidayCalendar = 'CN' | 'none';
/** Task lifetime state (F1.2). */
export type TaskStatus = 'active' | 'paused' | 'done' | 'archived';
/** Task kind. */
export type TaskKind = 'recurring' | 'once';
/** Reminder phases. `null` means a recurring task's plain on-time occurrence. */
export type Phase = 'start' | 'end' | 'advance';
/** Delivery channels; `session` is deliberately absent (D-02). */
export type Channel = 'overlay' | 'system';
/** Rule definition, isomorphic to the persisted `rule` field (§7.5). */
export interface RecurrenceRule {
    preset: RulePreset;
    /** Canonical 5-field Vixie expression; derived from the preset, read-only. */
    cron: string;
    /** IANA time zone the rule is evaluated in. */
    timeZone: string;
    /** Local `YYYY-MM-DD` dates that never fire (F2.5). */
    skipDates: string[];
    /** Local `YYYY-MM-DD` dates that fire even on non-workdays (F2.5). */
    extraWorkdays: string[];
    /** `CN` follows the built-in holiday table; `none` is plain Mon–Fri. */
    holidayCalendar: HolidayCalendar;
    /** What to do when the selected day does not exist in a month (D-05). */
    monthlyOverflow: MonthlyOverflow;
}
/** One-off task window (D-03: both nodes always remind). */
export interface OnceWindow {
    /** ISO 8601 with offset, normalized to UTC on write. */
    startAt: string;
    /** ISO 8601 with offset; strictly later than `startAt`. */
    endAt: string;
}
/** Per-task notification settings. */
export interface NotifySettings {
    channels: Channel[];
    template: string;
    /** 0–1440 minutes; replaces the on-time occurrence (UX-06). */
    advanceMinutes: number;
    sound: boolean;
}
/** Mutable per-task firing state (F1.3). */
export interface TaskState {
    lastFiredAt: string | null;
    lastOccurrenceKey: string | null;
    firedStart: boolean;
    firedEnd: boolean;
    missedAt: string | null;
    missedCount: number;
    snoozeUntil: string | null;
    completedOccurrenceKey: string | null;
}
/** A stored task; `priority` is derived at read time and never persisted. */
export interface Task {
    id: string;
    title: string;
    description: string;
    kind: TaskKind;
    status: TaskStatus;
    dueDate: string | null;
    pinned: boolean;
    doneAt: string | null;
    archivedQuarter: string | null;
    rule: RecurrenceRule | null;
    once: OnceWindow | null;
    notify: NotifySettings;
    state: TaskState;
    revision: number;
    createdAt: string;
    updatedAt: string;
}
/** An occurrence that should fire (or was missed) at `at`. */
export interface Occurrence {
    taskId: string;
    at: Date;
    phase: Phase | null;
    /** `taskId@<UTC ISO>Z[#phase]` — the global de-duplication key (F1.4). */
    key: string;
    kind: TaskKind;
    /**
     * For one-off tasks, which node this occurrence belongs to. Carried through
     * firing so the repository knows whether to set `firedStart` or `firedEnd`.
     * Always `null` for recurring tasks.
     */
    node?: 'start' | 'end' | null;
}
/** Pure output of `resolveTick`: what to fire, what to mark, when to wake. */
export interface TickPlan {
    fire: Occurrence[];
    markMissed: Occurrence[];
    nextWakeAt: Date | null;
}
/** Derived priority key (D-20). */
export type PriorityKey = 'high' | 'mid' | 'low' | 'none' | 'paused';
/** Derived priority value; `daysLeft` is null when there is no due date. */
export interface Priority {
    key: PriorityKey;
    daysLeft: number | null;
}
/** Three list views (F4.10). */
export type TaskViewName = 'todo' | 'done' | 'overdue';
/** Result of `selectView`, including the badges every view needs. */
export interface ViewResult {
    items: Task[];
    counts: {
        todo: number;
        done: number;
        overdue: number;
    };
    prioritySummary: {
        high: number;
        mid: number;
        low: number;
        none: number;
    };
}
