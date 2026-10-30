# Changelog

## [Unreleased] 0.2.0 — D-25 任务时间与状态模型

### Planned
- 删除 `Task.dueDate`，`once.endAt` 为唯一截止；`schemaVersion 1→2` 迁移。
- 单次任务 `startAt` 可省略（默认 `createdAt`、`startAtSource`；默认开始节点不提醒）。
- `stage` 六态读时派生；四阶段页签 + 循环/暂停独立筛选。
- `notify.endReminder`；会议类可只提醒开始；`advanceMinutes` 仅提前 `#end`。
- 取消 `endAt` 自动 `done`；循环任务不进入 `done`；`done→active` 撤销。
- `counts/byKind/totalDone`、`serverTime`/`nextTransitionAt`、优先级半开区间。
- API/工具/客户端/测试/文档同步（详见 `docs/planning/版本计划.md`）。

## [0.1.0] 2026-10-30
- 初版 DSH 工作待办提醒插件：循环规则、单次开始/结束提醒、三视图、`dueDate` 派生优先级、置顶、季度归档、9 个 Agent 工具。
