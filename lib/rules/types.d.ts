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
/**
 * One-off task window (D-25: `endAt` is the single deadline).
 *
 * `startAt` is always present in storage: when the user leaves it empty the
 * service fills it with the task's `createdAt` and records
 * `startAtSource="created"`. That flag is what suppresses the `#start`
 * reminder later — a resolved timestamp alone cannot tell the two cases apart.
 */
export interface OnceWindow {
    /** ISO 8601, normalized to UTC on write. */
    startAt: string;
    /** ISO 8601; the only deadline for a one-off task; strictly later than `startAt`. */
    endAt: string;
    /** `explicit` when the user supplied `startAt`, `created` when it was defaulted. */
    startAtSource: 'explicit' | 'created';
    /**
     * The task's own IANA zone (F2.6). A one-off task has no `rule`, so without
     * this field every list row would show the global default offset instead of
     * the zone its times were entered in.
     */
    timeZone: string;
}
/** Per-task notification settings. */
export interface NotifySettings {
    channels: Channel[];
    template: string;
    /** 0–1440 minutes; replaces the on-time `#end` occurrence (F5.7). */
    advanceMinutes: number;
    sound: boolean;
    /**
     * When false (meeting-style tasks) only the `#start` node is scheduled.
     * Only meaningful for one-off tasks and requires an explicit `startAt`.
     */
    endReminder: boolean;
}
/** Mutable per-task firing state (F1.3). */
export interface TaskState {
    lastFiredAt: string | null;
    lastOccurrenceKey: string | null;
    firedStart: boolean;
    firedEnd: boolean;
    /**
     * Advance-reminder delivery markers per one-off node.
     *
     * `firedStart`/`firedEnd` describe the natural node (that is what F3.4
     * defines), while an advance reminder fires *before* it. Without a separate
     * marker a task with `advanceMinutes > 0` would never satisfy both booleans
     * and would re-deliver its advance occurrence forever.
     */
    firedStartAdvance: boolean;
    firedEndAdvance: boolean;
    /** Set when a one-off node was recorded as missed, so it is never re-counted. */
    missedStart: boolean;
    missedEnd: boolean;
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
/** Derived priority value (D-20 / D-25). */
export interface Priority {
    key: PriorityKey;
    /** Whole minutes until the deadline (floored); negative once overdue. */
    remainingMinutes: number | null;
}
/**
 * Read-only task stage (D-25). Derived from `status` + `kind` + `now`, never
 * persisted.
 */
export type TaskStage = 'notStarted' | 'inProgress' | 'overdue' | 'done' | 'paused' | 'recurring' | 'archived';
/** The six selectable views (F4.10 / F4.21). */
export type TaskViewName = 'all' | 'notStarted' | 'inProgress' | 'overdue' | 'done' | 'recurring' | 'paused';
/** Mutually exclusive counts for the six views (F4.21). */
export interface Counts {
    notStarted: number;
    inProgress: number;
    overdue: number;
    done: number;
    paused: number;
    recurring: number;
}
/** Result of `selectView`, including the badges every view needs. */
export interface ViewResult {
    items: Task[];
    counts: Counts;
    prioritySummary: {
        high: number;
        mid: number;
        low: number;
        none: number;
    };
}
