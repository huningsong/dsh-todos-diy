/**
 * Weekly / monthly report aggregation (F11.1–F11.4).
 *
 * Pure functions only: the route feeds in tasks, archived tasks, completion
 * events and a clock, and gets back a `ReportData` value. Nothing here writes
 * to the store, and no LLM is involved — the report is a deterministic view.
 */
import type { CompletionEvent } from './state.js';
import type { Task, TaskKind } from './rules/types.js';
/** One row in a report section. */
export interface ReportItem {
    id: string;
    title: string;
    kind: TaskKind;
    /** Occurrences completed in the period (recurring); 1 for one-off tasks. */
    count?: number;
    dueAt?: string | null;
    completedAt?: string | null;
    overdueDays?: number;
    nextAt?: string | null;
    /** Zone the row's times should be displayed in (F2.6/B-03). */
    timeZone?: string;
}
/** The JSON contract of `GET /reports`. */
export interface ReportData {
    period: {
        kind: 'weekly' | 'monthly';
        start: string;
        end: string;
        timeZone: string;
    };
    completed: ReportItem[];
    overdue: ReportItem[];
    created: ReportItem[];
    upcoming: ReportItem[];
    stats: {
        completed: number;
        overdue: number;
        inProgress: number;
        recurring: number;
        completionRate: number | null;
    };
    generatedAt: string;
}
/** What {@link buildReport} needs. */
export interface ReportInput {
    kind: 'weekly' | 'monthly';
    anchor: string;
    timeZone: string;
    now: Date;
    tasks: readonly Task[];
    archived: readonly Task[];
    events: readonly CompletionEvent[];
    /** Resolve the next fire instant for a recurring task. */
    nextAtFor?: (task: Task) => string | null;
}
/** A resolved reporting window (end is inclusive, nextStart is exclusive). */
export interface ReportPeriod {
    kind: 'weekly' | 'monthly';
    start: string;
    end: string;
    nextStart: string;
    nextEnd: string;
    localStart: string;
    localEnd: string;
}
/**
 * Resolve the reporting window around an anchor day.
 * @param kind - `weekly` (Mon–Sun) or `monthly` (natural month).
 * @param anchor - `YYYY-MM-DD` in `timeZone`.
 * @param timeZone - IANA zone.
 * @returns Instants plus display dates.
 * @throws Error when the anchor is not a valid local date.
 */
export declare function periodOf(kind: 'weekly' | 'monthly', anchor: string, timeZone: string): ReportPeriod;
/**
 * Build a report from already-loaded data.
 * @param input - Tasks, archive tasks, events and clock.
 * @returns The report value.
 */
export declare function buildReport(input: ReportInput): ReportData;
