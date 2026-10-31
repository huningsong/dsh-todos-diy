# Changelog

## [0.5.2] 2026-10-31 — 列表分页与全量分组计数

### Fixed
- **普通视图分页（F8.20）**：每页 200 条，列表顶部显示「共 N 条 · 已显示 K 条」与「加载更多」；`/snapshot` 新增 `groupCounts`，分组标题改用全量计数（如高 96），分页未加载时显示「已加载 X/Y」；搜索也用精确总数。
- **自然语言输入弹窗（F10.1 / UX-22）**：入口改为多行输入弹窗（≥6 行/160px），解析/取消、Ctrl/⌘+Enter；解析或降级后关闭弹窗，沿用编辑器降级横幅。

### Changed
- `GET /snapshot` 响应新增 `groupCounts`（六组全量计数）；`api.snapshot` 支持 `cursor`，客户端 `ViewName` 含 `all`。
- 版本号 `0.5.2`。

## [0.5.1] 2026-10-31 — 体验收口（搜索范围 / NLP 降级提示）

### Fixed
- **搜索范围（F8.17）**：搜索默认跨全部非归档任务；搜索框旁「全部任务 / 当前视图」切换；结果行显示阶段徽标；「已完成」页签搜索不再落入归档视图；当前视图无结果时一键「在全部任务中搜索」；所有刷新路径统一走 `resolveSearchTarget`，搜索结果 `limit=200` 并提示截断。
- **NLP 降级提示（F10.11）**：解析降级时编辑器显示警告横幅（原因、重试、关闭），标题保留原文；重试成功按「仅覆盖未修改字段」合并并清除提示；重试异常保留重试入口；重试中关闭编辑器 abort 请求；输入条提示由 Panel 统一持有/清除。

### Changed
- 版本号 `0.5.1`；无后端契约/数据模型改动。
- `api.parse` 增加可选 `AbortSignal`；客户端 `ViewName` 增加 `all`。

## [0.5.0] 2026-10-31 — 周报 / 月报（F11）

### Added
- `CompletionEvent` + `schemaVersion 3`：单次与循环任务每次完成都追加一条事件（F11.2）；保留最近 5000 条/24 个月；v2→v3 迁移补空数组，不伪造历史。
- `GET /reports?kind=weekly|monthly&anchor=YYYY-MM-DD`：只读聚合本周期完成、逾期、新增、下周期计划与统计（F11.3/F11.4）；完成项合并主文件与归档 quarter 并去重。
- 顶部「生成报告」按钮 + `ReportModal`：周报/月报 Tab、本周/上周/本月/上月周期、Markdown 预览、复制、导出 `.md`（F11.5/F11.6）。
- 导出文件名 `工作周报-YYYY-MM-DD.md` / `工作月报-YYYY-MM.md`；空章节保留标题并显示「无」（F11.8）。
- 报告路由不调用 `touch()`，调用前后 `tasks.json` 字节不变（F11.3）。
- 需求 v1.7 新增 F11.1–F11.8 / AC-REP-01–08。

### Changed
- `schemaVersion` 2 → 3（主文件、归档 quarter、`archive/index.json`、`POST /import` 同一迁移链）。
- 路由表 29 → 30（新增 `/reports`）。
- 版本号 `0.5.0`。

## [0.4.0] 2026-10-30 — 自然语言录入（F10）

### Added
- `POST /parse`：用 `ctx.llm.stream()` 把一句中文/英文解析成任务草稿；返回 `draft/fieldStatus/missingRequired/unsupported/confidence`（F10.1–F10.5）。
- 任务列表「✨ 自然语言新建」入口；解析结果填入现有编辑器，用户确认后保存（F10.2）。
- 字段三态徽标：`explicit` / `default`（默认）/ `missing`（需补充）（F10.3）。
- 单时间句子默认 `endAt=+1h`、`endReminder=false`，并标为默认值（F10.4）。
- 设置项 `settings.nlp.enabled`（默认关闭）；关闭时 `/parse` 返回 `nlp_disabled`（F10.7）。
- 模型不可用 / 超时 8s / 非法 JSON → 原文回填普通表单，接口永不 5xx（F10.5）。
- 能力边界（每 N 天/每 N 小时/每月最后一个工作日/农历等）返回 `unsupported`（F10.8）。
- 模型路由：`agentDefaultModel.currentSelection()` → 首个可用 provider/model → 降级（F10.10）。

### Changed
- NF8 隐私口径修订：默认不联网；仅用户手动开启 F10 后发送当次解析文本，不发送任务库/设置/历史。
- 版本号 `0.4.0`；`/health.capabilities.agentTools` 仍为 12。周报/月报见 0.5.0。
- 路由表 28 → 29（新增 `/parse`）。

## [0.2.1] 2026-10-30 — Agent 体验补齐（F7.14–F7.18）

### Added
- `todo_reminder_get`：按 id 读取单条任务，返回含 `revision` 的 `TaskView`（F7.14 / AC-46）。
- create 幂等：`todo_reminder_create` 与 `POST /tasks/create` 接受可选 `idempotencyKey`（16–128 字符）；同 key 同 payload 返回原任务并标 `replayed:true`，不同 payload 返回 `conflict`（F7.15 / AC-47）。
- `all` 视图：`todo_reminder_list` 默认 `view="all"`（全部非归档任务）；HTTP `/snapshot` 仍默认 `inProgress`（F7.16 / AC-48）。
- `todo_reminder_remind` / `todo_reminder_deliveries`：立即提醒与投递历史查询（F7.17 / AC-49）。
- `complete` 的 `skipNext`：循环任务尚未触发时可跳过下一次 occurrence（F7.18 / AC-50）。
- `meta.idempotency` 可选索引，上限 200 条 FIFO；不需要 schema 迁移。

### Fixed（第二轮体验反馈）
- 筛选竞态：快速切换页签/搜索时只有最新快照能写状态，切换期间显示骨架屏（FIX-01）。
- 设置弹窗保存按钮改为「保存设置」，不再复用「保存任务」（FIX-02）。
- 「仅截止」任务行只显示「单次 · 截止 …」，不再展示内部默认开始时间（FIX-03）。
- 单次任务未填结束时间/起止倒置时给出字段级红框与提示，不再只报「参数不合法」（FIX-04）。
- 循环任务未触发前点「完成」改为跳过下一次 occurrence（toast「已跳过下一次提醒」），不再报 `no_occurrence`（FIX-05）。
- 搜索框占位文案改为「在当前视图内搜索」，明确搜索范围（P2-F）。

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
