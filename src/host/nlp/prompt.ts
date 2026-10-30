/**
 * The F10 system prompt and user message.
 *
 * Kept in its own module so the wording can be reviewed and tested independently
 * of the transport. Every rule here is D-25 compliant: `once.endAt` is the only
 * deadline, `once.startAt` is optional, and a single spoken time becomes a
 * one-off window with the end defaulted to +1 hour.
 */

import type { NlpDraft } from './types.js'

/** Default fields the parser starts from. */
export function emptyNlpDraft(timeZone: string): NlpDraft {
  return {
    kind: 'recurring',
    title: '',
    description: '',
    timeZone,
    preset: 'workdays',
    time: '09:00',
    weekdays: [],
    monthDays: [],
    holidayCalendar: 'CN',
    monthlyOverflow: 'lastDay',
    skipDates: [],
    extraWorkdays: [],
    channels: ['overlay'],
    advanceMinutes: 0,
    sound: false,
    template: '{title}',
    startAt: '',
    endAt: '',
    endReminder: true,
    startAtSource: 'explicit',
  }
}

/**
 * Build the system prompt.
 * @param now - Current instant (already in the target zone's wall clock).
 * @param timeZone - IANA zone.
 * @returns Prompt text.
 */
export function buildSystemPrompt(now: string, timeZone: string): string {
  return [
    '你是「工作待办」插件的任务解析器。把用户的一句话解析成 JSON，只输出 JSON，不要 Markdown。',
    `当前时间：${now}（${timeZone}）`,
    `默认时区：${timeZone}`,
    '',
    '规则（D-25 模型）：',
    '- kind: "once" 或 "recurring"；只说一个具体日期/时刻 → "once"，出现「每周/每天/每月/工作日」→ "recurring"。',
    '- once.startAt 可省略；once.endAt 必填，是唯一截止时间，必须晚于 startAt。',
    '- 用户只说了开始时间：startAt=该时间，endAt=该时间+1 小时，endReminder=false，singleTime=true。',
    '- 用户只说了日期没说时间：时间按 09:00（标记 default）。',
    '- recurring.preset: "workdays" | "weekly" | "monthly" | "custom"。',
    '- 每周：time + weekdays [1..7]（周一=1）；只说「每周」未说星期几 → weekdays 留空并写入 missing。',
    '- 每月：time + monthDays [1..31]；「月底」→ monthDays=[31] + monthlyOverflow="lastDay"。',
    '- advanceMinutes: 0–1440 整数，未说填 0。',
    '- title: 去掉「提醒我/记得/别忘了」后的核心短语，≤200 字；无法切分时用原文。',
    '- 用户没明确说的字段填 null，不要编造日期。',
    '- 不支持的表达（每N天、每N小时、每月最后一个工作日、农历、第N个星期几）放进 unsupported。',
    '',
    '输出 JSON 结构：',
    '{',
    '  "kind": "once|recurring|null",',
    '  "title": "string|null",',
    '  "description": "string|null",',
    '  "once": {"startAt":"YYYY-MM-DDTHH:mm|null","endAt":"YYYY-MM-DDTHH:mm|null"}|null,',
    '  "rule": {"preset":"workdays|weekly|monthly|custom","time":"HH:mm","weekdays":[1],"monthDays":[1],"holidayCalendar":"CN|none","monthlyOverflow":"lastDay|skip"}|null,',
    '  "notify": {"advanceMinutes":0,"sound":false}|null,',
    '  "singleTime": true|false,',
    '  "missing": ["..."],',
    '  "unsupported": ["..."],',
    '  "confidence": 0.0',
    '}',
  ].join('\n')
}

/**
 * Build the user message carrying the raw sentence.
 * @param text - User input.
 * @returns Message text.
 */
export function buildUserMessage(text: string): string {
  return `用户输入：${text}\n请输出 JSON。`
}
