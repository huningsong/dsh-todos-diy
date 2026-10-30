# Changelog

## [0.2.1] 2026-10-30 — Agent 体验补齐（F7.14–F7.18）

### Added
- `todo_reminder_get`：按 id 读取单条任务，返回含 `revision` 的 `TaskView`（F7.14 / AC-46）。
- create 幂等：`todo_reminder_create` 与 `POST /tasks/create` 接受可选 `idempotencyKey`（16–128 字符）；同 key 同 payload 返回原任务并标 `replayed:true`，不同 payload 返回 `conflict`（F7.15 / AC-47）。
- `all` 视图：`todo_reminder_list` 默认 `view="all"`（全部非归档任务）；HTTP `/snapshot` 仍默认 `inProgress`（F7.16 / AC-48）。
- `todo_reminder_remind` / `todo_reminder_deliveries`：立即提醒与投递历史查询（F7.17 / AC-49）。
- `complete` 的 `skipNext`：循环任务尚未触发时可跳过下一次 occurrence（F7.18 / AC-50）。
- `meta.idempotency` 可选索引，上限 200 条 FIFO；不需要 schema 迁移。

### Changed
- 工具总数 9 → **12**（规划稿写 11 为笔误：F7.14 新增 1 个 + F7.17 新增 2 个）。
- `todo_reminder_list` 的 `view` 枚举增加 `all`。
- 版本号 `0.2.1`；`/health.capabilities.agentTools` 动态反映注册数量。

## [0.2.0] 2026-10-30 — D-25 任务时间与状态模型

### Added
- `stage` 派生字段：`notStarted / inProgress / overdue / done / paused / recurring / archived`，读时计算、不落盘。
- 六个互斥视图：四阶段页签 + `recurring` / `paused` 独立筛选；`counts`、`byKind`、`totalDone`。
- `serverTime` / `nextTransitionAt`：客户端在最近边界到点刷新，兜底 60 秒。
- `priority.remainingMinutes`：按 `endAt` / `nextAt` 的毫秒余量在 24h / 72h / 168h 半开区间分档。
- `notify.endReminder`（会议类只提醒开始）、`once.startAtSource`。
- `POST /tasks/remind`（立即提醒一次，不改规则）、`GET /deliveries`（投递历史）。
- `schemaVersion 1 → 2` 迁移：主文件、归档 quarter、`archive/index.json`、`POST /import` 共用同一函数。

### Changed
- 删除 `Task.dueDate`；`once.endAt` 成为单次任务唯一截止时间；API/工具/表单/JSON 均不再接受或返回 `dueDate`（显式传入返回 `invalid_argument`）。
- 单次任务 `startAt` 可省略：默认 `createdAt` 且不产生 `#start` 提醒。
- `advanceMinutes` 仅作用于单次任务的 `#end` 节点；`#start` 与循环任务不提前。
- 取消每日 00:05 优先级重算与 `lastPriorityRefreshAt`。
- `done → active` 撤销会清空 `doneAt` 与 `pinned`。
- 工具不再要求 `exec.agent`：主会话、子 Agent、无 Agent 上下文的宿主调用均可使用（F7.10 v1.3）。

### Fixed
- 结束时间到点不再自动 `done`；未完成保持 `active` / `stage="overdue"`，只有显式完成才写 `doneAt`。
- 循环任务永远不会进入 `done`；`complete` 只推进当前 occurrence。
- 循环任务误设 `advanceMinutes` 时不再扩大回溯窗口、不再重复计入 missed。

## [0.1.0] 2026-10-30
- 初版 DSH 工作待办提醒插件：循环规则、单次开始/结束提醒、三视图、`dueDate` 派生优先级、置顶、季度归档、9 个 Agent 工具。
