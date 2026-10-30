# 02 实现差距审计：需求 v1.2（D-25）对照现有实现

> 审计对象：`/Users/huningsong/Desktop/work/tmp/dsh-todos-diy`（dsh-todos-diy v0.1.0 + 未提交「独立代码评审修复」）
> 审计基线：`d6adcc2 feat: DSH 工作待办提醒插件 v0.1.0` + 当前工作树（`git status --short` 有 69 个已修改文件、9 个未跟踪源码/测试文件，另有 6 个 `lib/` 产物与 3 个文档）
> 审计日期：2026-10-30 ｜ 审计人：impl-auditor
> 说明：本文件只读审计结论，未修改任何源码、测试、文档。

---

## 1. 审计范围与方法

### 1.1 需求依据

| 文件 | 使用章节 |
|---|---|
| `需求-v1.md`（v1.2，1375 行） | F1.1–F1.6、F3.1–F3.8、F4.1–F4.21、F6.1–F6.9、F7.1–F7.13、F8.1–F8.16、§7.4 数据模型、§7.5 纯函数签名、§7.6 tick 伪代码、§7.8 HTTP API、§7.13 决策 D-19…D-25 |
| `评估-任务时间与状态逻辑.md` | 全部（3 个 P0：endAt 语义、循环任务阶段、暂停归属；5 个 P1：默认开始时间、循环优先级、统计口径、serverTime、startAt 编辑语义） |
| `优化-任务时间与状态模型.md` | 全部（dueDate 删除、startAt/endAt 模型、phase 六态、counts 设计、落地顺序） |

### 1.2 代码范围

已逐文件阅读以下源码（共约 12,000 行）：

- **宿主数据模型与迁移**：`src/host/rules/types.ts`、`state.ts`、`repoTypes.ts`、`repoBuild.ts`、`validate.ts`、`validateTime.ts`、`migrations.ts`、`store.ts`、`archive.ts`、`archiveRestore.ts`、`transfer.ts`、`transferRoutes.ts`
- **宿主派生**：`src/host/rules/priority.ts`、`taskView.ts`、`repoQuery.ts`、`repo.ts`
- **宿主调度**：`src/host/rules/occurrence.ts`、`rules/resolveTick.ts`、`tickChanges.ts`、`index.ts`、`health.ts`
- **宿主路由/工具**：`src/host/routes.ts`、`taskRoutes.ts`、`routeKit.ts`、`toolDefs.ts`、`tools.ts`、`delivery.ts`
- **客户端**：`src/client/panel.ts`、`task-list.ts`、`grouping.ts`、`task-row.ts`、`task-editor.ts`、`editor-fields.ts`、`archive-view.ts`、`overlay.ts`、`api.ts`、`dictionary-zh.ts`、`dictionary-en.ts`、`dictionary.ts`、`examples.ts`、`styles.ts`、`ui.ts`、`index.ts`，以及评审修复新增的 `panel-actions.ts`、`panel-shortcuts.ts`、`task-history.ts`、`confirm-delete.ts`、`notify-permission.ts`
- **测试**：`test/` 全部 28 个文件（重点为 `fixtures.ts`、`priority.test.ts`、`state.test.ts`、`validate.test.ts`、`repo.test.ts`、`store.test.ts`、`archive.test.ts`、`transfer.test.ts`、`routes.test.ts`、`tools.test.ts`、`review-fixes.test.ts`）

### 1.3 方法

1. 用 `grep -rn` 建立符号清单：`dueDate`、`daysLeft`、`selectView(`、`derivePriority(`、`todayFor`、`counts.`、`schemaVersion` 等，记录文件:行号。
2. 以 `tsc --noEmit` 建立基线（见 1.4）。
3. 按「需求条目 → 现状函数 → 差距 → 改法」逐域对照；对现有实现中的**旧模型假设**与**评审修复测试中固化的旧行为**单独标记。
4. 只报告事实与可执行改法；需要产品拍板的先列入 §7，不阻塞其余改造。

### 1.4 基线事实

| 检查项 | 结果 |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json`（宿主） | **0 错误**（exit 0） |
| `./node_modules/.bin/tsc --noEmit -p tsconfig.client.json`（客户端） | **0 错误**（exit 0） |
| `./node_modules/.bin/tsc -p tsconfig.test.json`（测试编译） | **0 错误**（exit 0） |
| 当前模型版本 | `SCHEMA_VERSION = 1`（`src/host/state.ts:17`），`MIGRATIONS = []`（`src/host/migrations.ts:32`） |
| 当前视图模型 | 三视图 `todo / done / overdue`（`src/host/rules/types.ts:148-155`） |
| `dueDate` 代码足迹 | **113 处 / 23 个文件**（src 46 处 / 13 文件；test 67 处 / 10 文件），另有 `lib/` 编译产物 50 处 / 11 文件 |
| 旧行为固化 | `test/review-fixes.test.ts` 有 4 个测试块断言「单次任务两节点结束后自动 done」（`review-fixes.test.ts:143-163`、`273-307`、`369-395`、`412-444`），与 v1.2 F3.6/D-25 直接冲突 |

> 结论先行：这不是一次「加几个字段」的增量改造，而是一次**跨模型、迁移、派生、调度、API 与客户端表单的模型替换**。当前工作树的评审修复质量不错（守卫、tickChanges、validateSettings 均有价值），但它把 v0.1.0 的 `dueDate` 三视图假设固化的测试也带进来了，改造时必须先反选这些测试预期。

---

## 2. 总体结论

**结论：可以直接开工，不需要先补需求文档；但有 3 个契约点建议在批次 1 开始前用 30 分钟拍板（Q1–Q3，见 §7），它们只影响类型签名/边界，不影响模型与迁移先行。**

理由：

1. **模型现状清楚**：`Task.dueDate` 仍是持久化一等字段（`rules/types.ts:102`），`CreateTaskInput`/`UpdateTaskPatch` 仍接受 `dueDate`（`repoTypes.ts:18,31`），`buildTask`/`patchTask` 仍在写它（`repoBuild.ts:40,59,102`）。D-25 要求 API、工具、表单、JSON 全部不出现 `dueDate`，因此必须做一次「删除字段 + schemaVersion 1→2 + 全链路清理」。
2. **三视图 → 六态是全局改动**：`TaskViewName`、`ViewResult.counts`、`ListResult.counts`、`/snapshot` 的 `view` 校验、工具 `view` 枚举、客户端 `ViewName` 全部是 3 值；改成 `notStarted/inProgress/overdue/done/recurring/paused` 会同时触碰 host/client/test。
3. **自动 done 是反向行为**：当前 `repo.applyTick()` 在单次任务两个节点 settled 后自动 `status='done'`（`repo.ts:360-370`）。D-25 明确取消该行为（F3.6），且现有 4 个测试断言旧行为；必须先改实现再改测试，不能只改测试。
4. **剩余最大的未知不在代码，而在需求边界**：循环任务 `nextAt` 需要节假日表，`totalDone` 需要归档索引，`startAtSource` 的 round-trip 语义在 F1.1 与 F3.1 之间存在歧义；这三点建议先拍板（见 §7）。

**工作量校准**：需求 §11 对 D-25 的追加估算是 **+3–5 人日**；本审计按真实代码影响（23 个文件、113 处 dueDate、归档三文件迁移、28 个测试文件）估算为 **8.5–13 人日（乐观/保守）**，详见 §6，差异主要来自测试与归档迁移被原估算低估。

---

## 3. 差距矩阵（需求 → 现状 → 差距 → 改法）

### 3.1 数据模型

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| M1 | F1.1/F4.11：`Task` 无 `dueDate`；创建/更新输入也无 `dueDate` | `Task.dueDate` `rules/types.ts:102`；`CreateTaskInput.dueDate` `repoTypes.ts:18`；`UpdateTaskPatch.dueDate` `repoTypes.ts:31`；`buildTask` `repoBuild.ts:40,59`；`patchTask` `repoBuild.ts:102`；`coerceTask` `state.ts:239,274-279`；`validateDueDate` `validate.ts:69-85`；HTTP `taskRoutes.ts:82`；工具 `toolDefs.ts:117,137,153` | 字段同时存在于持久化模型、创建/更新输入、校验、API、工具 schema、客户端表单，删除后会暴露 113 处引用 | 从 `Task`/`CreateTaskInput`/`UpdateTaskPatch` 删除；删除 `validateDueDate`；`coerceTask` 丢弃未知 `dueDate`；新增迁移 1→2 丢弃并 warning；HTTP/工具对显式传入 `dueDate` 建议 `invalid_argument`（Q4） |
| M2 | F3.1/F3.2：`once.startAt` 可省略，省略时取 `createdAt`，`startAtSource="created"`；`endAt` 必填且为唯一截止 | `validateOnce` 强制 startAt 必填 `validateTime.ts:20-22`；`OnceWindow` 只有 startAt/endAt/timeZone，无 `startAtSource` `rules/types.ts:48-59`；`coerceOnce` 要求两端 `state.ts:311-318`；`buildTask` 直接调用 `validateOnce(input.once, zone)` `repoBuild.ts:47` | 当前无法表达「只给 endAt」的任务；没有来源字段；`endAt` 仍只是窗口结束，不是唯一截止 | `validateOnce(value, {timeZone, createdAt, current?})`：startAt 缺省用 createdAt，返回 `startAtSource`；`buildTask` 对 created 来源设 `state.firedStart=true`；`OnceWindow` 增加 `startAtSource: 'explicit' \| 'created'` |
| M3 | F3.2：`endAt` 只选日期未选时间时默认该日 `23:59:59.999`（任务时区） | `parseInstant` 明确拒绝日期-only：`validateTime.ts:50-52`；测试也断言拒绝 `validate.test.ts:268-270` | 表单只能输入 `datetime-local`，自然语言/日期输入无法落到默认时间 | 新增 `parseEndInstant`：`YYYY-MM-DD` → `YYYY-MM-DDT23:59:59.999` 按任务时区；`validateOnce` 的 `endAt` 走该函数，`startAt` 仍要求时间 |
| M4 | F3.3：`notify.endReminder`（默认 true；false 时只产生 `#start`，且必须显式 startAt） | `NotifySettings` 无该字段 `rules/types.ts:61-68`；`validateNotify` 无该字段 `validate.ts:144-200`；`coerceTask` notify 组装无该字段 `state.ts:245-252` | 会议类任务无法关闭结束提醒；也没有「无开始提醒即无提醒」的合法性校验 | `NotifySettings.endReminder: boolean`；`validateNotify` 校验 boolean；`repoBuild` 保存；`coerceTask` 默认 true；校验 `endReminder=false && startAtSource='created'` → `invalid_argument` |
| M5 | F3.4/F1.3：省略 startAt 创建后 `firedStart=true`；`fired` 只读派生严格等于 `firedStart && firedEnd` | `buildTask` 初始 `firedStart:false` `repoBuild.ts:69`；`toTaskView.fired` 使用 `(firedStart\|\|firedStartAdvance\|\|missedStart) && (firedEnd\|\|firedEndAdvance\|\|missedEnd)` `taskView.ts:72-76`；测试 `review-fixes.test.ts:447-467` 断言 advance-only 时 fired=true | 默认开始节点在外观上仍「未完成」；`fired` 把 advance/missed 混入，偏离 F3.4 | 创建 created 来源时 `firedStart=true`；`fired` 改为严格 `firedStart && firedEnd`（单次）且循环恒 false；advance/missed 用独立字段展示 |
| M6 | F4.12：`Priority = {key, remainingMinutes}`；单次按 `endAt`、循环按 `nextAt` 与 `now` 实时计算；paused 返回 `paused` | `Priority.daysLeft` `rules/types.ts:141-145`；`derivePriority(dueDate, todayLocalDate)` 日期级 `rules/priority.ts:36-46`；`priorityOf` `55-61`；`TaskView.priority` `taskView.ts:24-25` | 旧实现按「日期差」分档（高=今天/超期、中≤3天、低≤7天），无法表达 24 小时/剩余分钟；循环任务完全没有 `nextAt` 参与 | 重写 `derivePriority(task, now, opts?)`：单次 `remainingMinutes = endAt - now`；循环 `nextAt - now`；`<=1440`→high、`<=4320`→mid、`<=10080`→low、否则 none；paused→`{key:'paused', remainingMinutes:null}`；不改 `priority.key` 取值集合（兼容 UI） |
| M7 | F4.10/F4.21：六个阶段 `notStarted/inProgress/overdue/done/recurring/paused`；计数 `{notStarted,inProgress,overdue,done,paused,recurring}` + `byKind` + `totalDone` | `TaskViewName = 'todo'\|'done'\|'overdue'` `rules/types.ts:148`；`ViewResult.counts` 三值 `types.ts:150-155`；`ListResult.counts` 三值 `repoTypes.ts:51-57`；路由只接受三值 `routes.ts:121-124`；工具枚举三值 `toolDefs.ts:71`；客户端 `ViewName` 三值 `panel.ts:31` | 全域三值假设 | 六值 union；`ViewResult` 增加 `byKind:{once,recurring}`、`totalDone:number`；`ListResult` 同步；客户端 tabs 改四阶段 + 两个独立筛选 |
| M8 | F4.10：`paused` 不混入任何阶段页签；`recurring` 独立筛选；完成页只 `status=done` | `selectView` 把 `paused` 拼进 todo `priority.ts:166-169`；panel 只有三 tab `panel.ts:243-257`；`task-list` 只在 todo 分组 `task-list.ts:152-171` | paused 混入 todo；没有 recurring/paused 筛选；没有四阶段拆分 | `selectView` 六视图；`paused`/`recurring` 独立；`groupItems` 只用于阶段视图（或按视图分组） |
| M9 | F1.2/F3.6：`done` 只能由用户/Agent 显式完成，`endAt` 到期不自动 done | `repo.applyTick` 两节点 settled 自动 `status='done'`、写 `doneAt`、清 `pinned` `repo.ts:360-370`；4 个测试断言该行为 `review-fixes.test.ts:143-163/273-307/369-395/412-444` | 与 D-25 完全相反：过了 endAt 会消失为 done，永远看不到「已超期」 | 删除 `repo.ts:360-370` 整段；`applyTick` 只更新 state；测试改为 `status='active'` + `phase='overdue'`；显式 `complete` 才 done |
| M10 | F4.7/F4.14：排序 = 置顶 → 优先级 → 结束时间（循环按 `nextAt`）→ 标题 | `sortTasksForView(tasks,today)` 只按 `dueDate` `priority.ts:96-112`；`TaskView.nextAt` 有值但排序不用 `taskView.ts:33` | 没有 `endAt`/`nextAt` 排序；无 `nextAt` 时最后 | 重写 `sortTasksForView(tasks, now, opts?)`：取 `endAt`（once）或 `nextAt`（recurring），null 最后；同分 title/id |

### 3.2 迁移与持久化

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| P1 | F6.8/F9.5：`schemaVersion` 1→2；主文件、归档目录所有 JSON 都要迁移 | `SCHEMA_VERSION = 1` `state.ts:17`；`MIGRATIONS = []` `migrations.ts:32`；`migrateState` 已支持链 `migrations.ts:49-85` | 无 v1→v2 迁移函数；主文件一旦升到 v2 后旧插件读不了，但当前构建仍是 v1 | 新增 `{from:1, describe:'v1→v2 删除 dueDate / 补 startAtSource 与 endReminder', run}`；`SCHEMA_VERSION=2`；迁移纯函数、可单测 |
| P2 | F6.8：迁移 v1 `once.startAt` 保留并补 `startAtSource="explicit"`；丢弃 `dueDate`；warning | `coerceTask` 目前只是 `dueDate: coerceDueDate(raw['dueDate'])` `state.ts:239`；`migrateState` 无 warnings 通道 `migrations.ts:34-37` | 迁移无法向调用方报告「丢弃 dueDate」warning；`coerceOnce` 没有 source 默认值 | `MigrateResult` 增加 `warnings: string[]`；任务级迁移：删 `dueDate`、`once.startAtSource ??= 'explicit'`、`notify.endReminder ??= true`；`store.load` 把 warning 写日志 |
| P3 | F6.2：`state` 需持久化 `firedStart/firedEnd/missed...`；`fired` 不落盘 | 当前 `TaskState` 无 `fired` 持久化（正确），但 `coerceTask` 忽略 `state.fired` 且无 warning `state.ts:253-267` | F3.4 要求导入 `fired:true` 但两布尔 false 时忽略并 warning；当前静默忽略 | `coerceTask` 增加 warning 收集（或 `coerceTaskWithWarnings`）：发现 `state.fired` 且与派生不一致时返回 warning；仍不写回 |
| P4 | F6.8：`tasks.json` 迁移；高于当前版本拒绝启动 | `store.load` 已有版本守卫与迁移调用 `store.ts:248-290`；`coerceState` 对 `<SCHEMA_VERSION` 直接返回 `migration-failed` `state.ts:155-157` | 框架具备，但 v1→v2 链为空；迁移后未立即标脏，磁盘仍是 v1 直到下一次写 | 加迁移后 `store` 在 load 成功后 `isDirty`（或显式 flush）一次，把 v2 落盘；保留 `tasks.json.bak` 一份 |
| P5 | F6.8：`archive/completed-*.json` 同样迁移，`schemaVersion=2` | `QuarterFile.schemaVersion` `archive.ts:104-108`；`readArchiveIndex` 默认 1 `archive.ts:148`；`rebuildIndex` 返回 1 `archive.ts:168,174,196`；`archiveCompleted` 写 1 `archive.ts:266`；index 写 1 `archive.ts:291`；`readQuarter` 直接返回原始 tasks `archive.ts:339-355` | 归档文件完全绕过 `coerceTask`/`migrateState`；v1 归档任务缺 `startAtSource/endReminder` 会直接进入 TaskView；写回永远是 1 | 抽 `loadQuarterFile()`：解析 → 版本检查/迁移 → `coerceTask` → 返回 v2 tasks；所有写点改用 `SCHEMA_VERSION`；`readQuarter`/`findArchivedTask` 走同一 helper |
| P6 | F6.8/F4.18：归档恢复也走迁移，保留 `startAt` 与 source | `archiveRestore.ts:35-54` 原始 JSON 取任务；`70-115` 直接 `...found.task`、写 index `schemaVersion:1` `:101` | 恢复会把 v1 字段（含 `dueDate`）原样带回主文件；绕过 `coerceTask`；`startAtSource` 未定义 | 恢复前 `findArchivedTask` 返回迁移后的 Task；`restoreArchivedTask` 对任务跑 `coerceTask`；`restored` 保留原 `once.startAt`/`startAtSource`；index 写 `SCHEMA_VERSION` |
| P7 | F6.8：`archive/index.json` 也要 1→2 | `readArchiveIndex` 读 `parsed.schemaVersion ?? 1` `archive.ts:148`；写入点固定 1 `archive.ts:291`、`archiveRestore.ts:101` | index 版本从不升级；旧 index 无迁移 | `readArchiveIndex` 对 `<2` 执行 index 迁移（仅补 schemaVersion，entries 不变）；`rebuildIndex` 返回 2 |
| P8 | F9.4/F6.8：导入 v1 文件要迁移；导出为当前版本 | `parseImport` 只做 `version > SCHEMA_VERSION` 拒绝 `transfer.ts:88-96`；随后直接 `coerceTask` `:104-112`；`buildExport` 使用 `SCHEMA_VERSION` 但当前=1 `:42-51` | v1 导入不会被迁移；缺失 `startAtSource/endReminder` 静默默认；导出测试仍断言 1 | `parseImport`：`version < SCHEMA_VERSION` → `migrateState(payload)`，warning 合并；再 `coerceTask`；`buildExport.schemaVersion` 自动变 2 |

### 3.3 派生（phase / priority / view / counts）

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| D1 | §7.5 `phaseOf(task, now)`：六态读时派生；`endAt` 当秒仍算进行中，`now > endAt` 才 overdue | 无 `phaseOf`；`isOverdue` 基于 `dueDate < today` `priority.ts:70-77`；`TaskView` 无 `phase` `taskView.ts:17-40` | 没有任务阶段概念；超期按「日期」而非「时刻」 | 新增 `phaseOf(task, now): TaskPhase`：archived（status/archivedQuarter）→ done → paused → recurring → once 比较 `startAt ≤ now ≤ endAt`；`now > endAt` 才 overdue；输出 `TaskView.phase` |
| D2 | F4.12 优先级阈值：≤24h 高、1–3 天中、4–7 天低、>7 天无；paused 不参与 | `derivePriority` 日期差 `priority.ts:36-46`；`prioritySummary` 只对 active `:140-144` | 没有 `remainingMinutes`；循环任务无 `nextAt` 输入；paused 的 `daysLeft` 仍计算 | 见 M6；`prioritySummary` 用同一 `derivePriority`，paused 跳过、done/archived 跳过 |
| D3 | F4.10/F4.21 六视图与六计数；四阶段只覆盖单次；循环/暂停独立 | `selectView` 三视图 `priority.ts:128-170`；`counts.todo/done/overdue` `:134-138`；`queryTasks` 传单 `today` `repoQuery.ts:54-97` | 缺少六视图；`todo` 把循环/暂停混在一起；计数语义与新口径不一致 | 重写 `selectView(tasks, view, now, totalDone?)`；`counts` 六值 + `byKind` + `totalDone`；`done` 按 `doneAt` 倒序；`recurring` 按 `nextAt`；`paused` 独立 |
| D4 | F4.21 `byKind:{once,recurring}`（全部非归档）与 `totalDone`（含历史归档） | 无 `byKind`、无 `totalDone`；`counts.done` 只统计主文件 `priority.ts:136` | 无法回答「总共完成多少」；`selectView` 只看 tasks，天然拿不到归档数量 | `byKind` 在 `selectView` 内对非 archived 任务计算；`totalDone` 由路由层叠加 `archive index` 计数（或由 repository 注入）；见 Q2 |
| D5 | F4.13 `nextTransitionAt(tasks, now)`：所有可见任务最近未来边界（`startAt`/`endAt`/`nextAt`） | 无该函数；只有 `nextWakeAt`（按提醒时刻，提前量已偏移）`occurrence.ts:283-296`、`resolveTick.ts:168-181` | 客户端不知道何时该刷新 phase | 新增纯函数 `nextTransitionAt(tasks, now, holidays?)`：active 任务取未来 `startAt`、`endAt`、`nextFireAt`（含 advance 偏移）最小者；paused/done/archived 跳过；与 `nextWakeAt` 分开（见 Q7） |
| D6 | F4.21 所有计数与 phase 用**同一个 now** | `/snapshot` 中 `ctx.today()` 与 `ctx.now()` 分开调用 `routes.ts:126,140`；`repo.list` 自己再取 `clock()` `repo.ts:113`；`toTaskView` 又用 `options.now` `taskView.ts:78` | 一次请求内可能有 2–3 个 now，跨秒边界时计数/行 phase 不一致 | 路由先 `const now = ctx.now()`，把 `now` 传 `repo.list({now})` 与 `toTaskViews({now})`；`repo.list` 不再自己取 clock |
| D7 | §8.1 多任务时区：阶段按绝对时刻，展示按任务时区 | 见 §4.2（67 处 today 相关）；`repo.list` 单一全局 `today` `repo.ts:113`；`routes` 的 counts 用全局 today `:126`，行 `todayFor` 用任务时区 `:142`；`taskRoutes.optionsFor` 只用 `task.rule?.timeZone` `:29-32`；`toolDefs.view` 同 `:42-45`；`delivery.buildReminderCard` 同 `:92`；`archive.quarterOf` 同 `:225,233` | 多时区下列表行 phase 可能与徽标不一致；once 任务的 task zone 被忽略（详情/提醒/季度归档） | D-25 后 phase/priority 全用绝对时刻，可去除大多数 `today`；仅 `overdueDays` 仍用任务时区本地日期。逐处改用 `taskTimeZone(task, fallback)` |
| D8 | §7.5 `ViewResult.prioritySummary` 与 counts 同源 | `prioritySummary` 基于 `dueDate` `priority.ts:140-144`；`selectView` 每次都重算 | 与 priority 改造同步；重复计算 | 复用同一 `derivePriority`；paused/done/archived 排除；作为 `selectView` 输出 |

### 3.4 调度（occurrence / resolveTick / index / tick）

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| S1 | F3.3：显式 startAt 才有 `#start`；minimal startAt 只 `#end`；endReminder=false 只 `#start` | `onceOccurrences` 无条件返回 start+end `occurrence.ts:144-151`；`resolveTick.collectOnceDue` 按 fired 标记过滤 `resolveTick.ts:130-148`；`nextFireAt` 同样 `occurrence.ts:255-274` | 无 `startAtSource` 判断；默认创建的任务仍会排 start occurrence；endReminder=false 仍排 end | `onceOccurrences` 按 `task.once.startAtSource` 与 `task.notify.endReminder` 生成节点；`buildTask` 对 created 来源设 `firedStart=true` 兜底；`nextFireAt` 复用 |
| S2 | F3.3：`endReminder=false` 且无显式 startAt → `invalid_argument` | 无任何校验 | 可能创建「无任何提醒」任务 | `validateNotify`/`validateOnce` 联合校验：`once.startAtSource === 'created' && notify.endReminder === false` → `invalid_argument`（field `notify.endReminder`） |
| S3 | F3.4：advance 与 missed 标记独立，不能互相污染 | `applyTick` 对 `phase==='advance'` 设 `firedStartAdvance/firedEndAdvance` `repo.ts:330-337`；`toTaskView.fired` 混用 `:72-76` | fired 派生被污染；`nextFireAt` 对 once 只检查 `firedStart/firedEnd` 不检查 advance/missed `occurrence.ts:262-265` | `fired` 严格两布尔；`nextFireAt` 对 once 也检查 `firedStartAdvance/missedStart` 等；TaskView 单独暴露 `advanceFired/missed` 如需 |
| S4 | F3.6：取消自动 done | 见 M9 | — | 删除 `repo.ts:360-370` |
| S5 | F6.4/D-06 错过策略不变；停机零回填 | `resolveTick`/`dueOccurrences`/`missedOccurrences` 已实现 `withinGrace`、每 tick 最多 1 条 `resolveTick.ts:41-44,88-118`、`occurrence.ts:226-245` | 与本改造无直接冲突；但 once 默认 start 的 settled 标记会影响 missed 计数 | 保持逻辑；新增测试确保 created-source 不产生 `missedStart` |
| S6 | F4.13：取消每日 00:05 `priorityRefresh`；health 不含 `lastPriorityRefreshAt` | `health.ts:62,110,114,130-141,190` 有 `lastPriorityRefreshAt/priorityDate`；`index.ts:142-144` 每 tick 传 `localDateKey`；`/priority/rules` 返回 `refreshAt:'00:05'` `routes.ts:155`；词典 `rule.refresh` `dictionary-zh.ts:25`、`en.ts:25` | 旧「每日重算」契约仍在 health/route/UI 三处 | 删除 health 字段与计算；`recordTick(now, plan, taskCount)`；`/priority/rules` 改 `{thresholds:{highMaxHours:24,midMaxDays:3,lowMaxDays:7},refreshMode:'on-read'}`；词典改「按当前时间实时计算」 |
| S7 | F4.16：季度归档由 tick 定期检查，不绑定 00:05 | `index.ts:243-275` 注释写「00:05 on the first day of a quarter」，实际每 6 小时跑一次 `:273` | 注释与实现不符，虽行为可接受（幂等且 6h 内会触发） | 改注释为「每 6 小时幂等检查」；无需新增 00:05 定时器 |
| S8 | §7.6：tick 只处理提醒/错过/归档，不落 phase/priority | `index.ts:142-144` 仍记录每日 priority 刷新时间戳（不写盘但概念残留） | 与新读时派生模型冲突 | 同 S6；`health.recordTick` 删日期参数/字段 |
| S9 | F4.13：客户端按 `nextTransitionAt` 刷新 | 客户端面板只在 `view`、搜索、`visibilitychange` 时 load（`panel.ts:94-132`），无定时刷新/边界定时器 | 16:00 开始的任务不会自动从「未开始」变「进行中」 | 见 §4.6；`api.snapshot` 返回 `serverTime/nextTransitionAt`；`panel` 按服务端时间偏移设定时器 + 60s 兜底 |

### 3.5 路由 / 工具

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| R1 | §7.8 `GET /snapshot`：`view` 六值、默认 `inProgress`；返回 `counts` 六值、`byKind`、`totalDone`、`serverTime`、`nextTransitionAt` | `routes.ts:121-124` 只接受 `todo/done/overdue`，默认 `todo`；响应 `:137-148` 无 `byKind/totalDone/serverTime/nextTransitionAt` | API 契约缺失；默认值错误 | 扩展校验/默认；`const now=ctx.now()` 一次；响应补齐；`totalDone` 从 archive index 汇总 |
| R2 | §7.8 `GET /priority/rules`：`{thresholds:{highMaxHours:24,midMaxDays:3,lowMaxDays:7},refreshMode:'on-read'}` | `routes.ts:152-156` 返回 `{thresholds:{highMaxDays:0,midMaxDays:3,lowMaxDays:7},refreshAt:'00:05'}`；测试 `routes.test.ts:209-216` 固化旧值 | 规则条语义错误；00:05 残留 | 改返回；同步测试与词典 |
| R3 | F4.11：`/tasks/create`、`/tasks/update` 不接受 `dueDate` | `taskRoutes.ts:82` 显式从 body 取 `dueDate`；`:107-112` 把任意 patch 原样传给 repo（可带 dueDate）；`toolDefs.ts:117/137/153` 同样 | API/工具仍接受 | 删除显式字段；create 校验未知字段；update 对 `patch.dueDate` 返回 `invalid_argument`（或统一 `stripLegacyFields`，Q4） |
| R4 | F7.13：`todo_reminder_list` 的 `view` 六值、默认 `inProgress`；返回 `{items,counts,prioritySummary}` | `toolDefs.ts:71` 枚举三值、默认 `todo`；`:85` `?? 'todo'`；`:93-98` 返回旧 counts | 工具参数/默认/返回全旧 | 枚举六值；默认 `inProgress`；返回六 counts；可增加 `byKind/totalDone`（Q2） |
| R5 | F7.2/F7.3：工具 create/update schema 去掉 `dueDate`；create 的 once 描述 `{startAt?,endAt}` 与 endReminder | `toolDefs.ts:117` create property dueDate；`:122` once 描述「两者必填」；`:153` update 描述含 dueDate | 工具系统提示会让模型继续传旧字段 | 删除 property；更新描述（startAt 可省略、默认 createdAt 不产生开始提醒、endReminder 会议类）；patch 用显式 JSON Schema 字段而非任意 object（推荐） |
| R6 | F2.6：工具返回 TaskView 的时区按任务自身 | `toolDefs.view` 用 `task.rule?.timeZone ?? timeZone` `:42-45`，忽略 `task.once.timeZone`；`todayOf` 全局 `:48`；`repo.list` 传全局 today `:91` | one-off 跨时区时 priority/display 用错时区 | `view` 用 `taskTimeZone(task, timeZone)`；`repo.list` 改 `now`（见 D6）；`todayOf` 删除或仅保留 overduedays |
| R7 | F5.4/F8.3：提醒卡片时间按任务时区 | `delivery.buildReminderCard` 用 `task.rule?.timeZone ?? 'Asia/Shanghai'` `:92` | one-off 任务自定义时区时，卡片 localTime/offset 错误 | 用 `task.once?.timeZone ?? task.rule?.timeZone ?? 'Asia/Shanghai'`（或抽 `taskTimeZone`） |
| R8 | F4.16–F4.19：归档 API 读取也要 v2 数据 | `routes.ts:168-193` `readQuarter` 返回原始 tasks 后直接 `toTaskViews` | 旧归档任务会缺字段/带 dueDate | `readQuarter` 返回已迁移/coerce 的 Task（见 P5） |
| R9 | F1.1：`TaskView` 可 round-trip 重建（去 id/revision/只读派生） | `taskView.ts:17-40` 用 `extends Omit<Task,'state'>` 暴露 `id/revision/createdAt/updatedAt` + 派生字段；`review-fixes.test.ts:165-192` 部分 round-trip 且带 `dueDate` | D-25 新增 `phase/priority.remainingMinutes/startAtSource` 后 round-trip 边界更复杂（详见 §4.3） | 拆 `Task` / `TaskView` / `TaskInput`；提供 `taskViewToCreateInput()`；测试按白名单逐字段比 |

### 3.6 客户端

| # | 需求 | 现状（文件:行） | 差距 | 改法 |
|---|---|---|---|---|
| C1 | F8.11：四阶段页签 + 循环/暂停独立筛选；徽标用同一 counts | `panel.ts:31` 三视图；`:243-257` 三 tab + `counts[key]`；`:116` firstRun 用 `counts.todo+done+overdue` | 没有四阶段/两个筛选；counts 三值 | `ViewName` 六值/四 tab + 两个 filter chip；counts 六值；firstRun 用六值 sum 或 `totalDone` |
| C2 | F4.13：`serverTime/nextTransitionAt` 边界刷新 + 60s 兜底 | `panel.ts:94-132` 只 view/search/visibilitychange；`api.snapshot` 无 serverTime/nextTransitionAt `api.ts:39-46` | 16:00 开始任务不会自动刷新 | `api.snapshot` 返回两字段；panel 用 `Date.now()` 与 `serverTime` 偏移、`setTimeout(next)` + 60s interval；切 tab/可见时刷新 |
| C3 | F8.2：列表行显示「结束时间/下次触发」；不显示 dueDate | `task-row.ts:77-89` `dueText` 直接读 `task.dueDate`；`:82` `task.noDue` | 字段删除后编译失败；无 `endAt` 文案 | 重写 `deadlineText(task, now)`：once 用 `endAt`/`phase`/`remainingMinutes`；recurring 用 `nextAt`；保留任务时区 `formatInZone` |
| C4 | F8.5：单次开始时间可空，留空提示「默认创建时间，不发送开始提醒」；结束必填；会议可勾「只提醒开始」 | `TaskDraft` 有 `dueDate`、`startAt`、`endAt`，无 `endReminder/startAtSource` `task-editor.ts:17-38`；`OnceFields` 两个必填 datetime `editor-fields.ts:237-269`；`BasicFields` 有截止日期 `:329-344`；`draftToPayload` 带 dueDate/startAt `task-editor.ts:154,162` | 表单模型与 D-25 完全不符；保存只给 endAt 会发空 startAt 导致 `invalid_argument` | `TaskDraft`：删 dueDate，加 `endReminder:boolean`、`startAtSource:'explicit'\|'created'`；`draftFromTask` 对 created 来源将 startAt 置空并显示创建时间提示；`draftToPayload` once 省略 startAt（undefined）、加 `notify.endReminder`；编辑只改 endAt 时保留 source |
| C5 | F3.8：编辑只改 endAt 保留原 startAt/source；显式改 startAt 重置 start fired 标记；复制保留 startAt；恢复保留 startAt | `patchTask` 只要 `patch.once !== undefined` 就重置 `firedStart/firedEnd/lastOccurrenceKey` `repoBuild.ts:111-117`；`draftFromTask` 用 `rule?.timeZone ?? fallbackZone` 忽略 `once.timeZone` `task-editor.ts:106-109`；复制走 draft 转换 `panel.ts:197-202,308-317` | 编辑 endAt 会误重置 start、不再提醒；跨时区 one-off 在表单显示错时区；复制无「开始时间已复制」提示 | `patchTask` 区分 `startAt`/`endAt` 变更并按节点重置（含 `firedStartAdvance/missedStart` 等）；`draftFromTask` 用 `task.once.timeZone`；复制沿用 draft 并在 UI 提示（Q9） |
| C6 | F8.6：i18n 全量文案；F8.12 规则条文案精确 | `dictionary-zh.ts:16-18` 三 tab；`:21-25` 旧优先级/00:05；`:52` 超期按天；`:97-98` 截止日期；`en.ts` 同；`panel.ts:259-267` 规则条 | 缺六视图/四阶段/endReminder/startAt 提示文案；规则条 00:05 | 增删 key（详见 §4.11）；规则条改「高 = 24 小时内到期/已超期 · 中 = 3 天内 · 低 = 7 天内 · 无 = 7 天以上或无结束时间」「按当前时间实时计算」 |
| C7 | F8.15：首次示例卡仍可用 | `examples.ts:40-47` once 用 `emptyDraft`，`draftToPayload` 带 dueDate；`emptyDraft` 有 dueDate 字段 | 编译层面随 TaskDraft 变更需修 | 删除 dueDate 引用；示例 3 仍可保留显式 startAt（「明天 14:00–18:00」），或按 Q10 改成只给 endAt 以教育默认开始 |
| C8 | F8.2/F8.9：列表分组只在阶段视图；暂停独立 | `grouping.ts:21-43` 分组含 `paused`；`task-list.ts:152` 只在 todo 分组 | paused 混入 todo 分组；循环/暂停视图无列表分支 | `groupItems` 去掉 paused 组（paused 独立视图）；`task-list` 对 recurring/paused 渲染平铺；四阶段视图可分组 |
| C9 | F8.7 主题 token / F8.13 置顶样式 | `styles.ts:26-42` tabs/rule strip；`:64-65` pinned；无 filter chip 样式 | 新增四 tab + 两 filter 需要样式 | 加 `.dtd-filters/.dtd-filter` 等；保留 token；不引入字面色 |
| C10 | F8.3/F8.8：浮层无需改文案；phase start/end 保留 | `overlay.ts:23-27` PHASE_KEYS；`:216-255` 卡片 | D-25 后默认 once 只有 end；无需结构性改动 | 验证 `phase=null` 与 `end` 展示；如新增 `phase` 类型不影响 |

---

## 4. 重点隐藏耦合与兼容风险

### 4.1 `dueDate` 足迹：113 处 / 23 个文件

**src（46 处 / 13 文件）**

| 文件 | 处数 | 关键位置 |
|---|---:|---|
| `src/host/rules/priority.ts` | 15 | `derivePriority` 参数/实现 `:36-46`、`priorityOf` `:55-61`、`isOverdue` `:70-77`、`daysOverdue` `:80-86`、排序 `:102-103`、summary `:143`、group `:202` |
| `src/client/editor-fields.ts` | 5 | `BasicFields` 截止日期块 `:329-344` |
| `src/host/validate.ts` | 4 | `validateDueDate` `:69-85` |
| `src/client/task-editor.ts` | 4 | `TaskDraft.dueDate` `:21`、`emptyDraft` `:46`、`draftFromTask` `:80`、`draftToPayload` `:154` |
| `src/host/toolDefs.ts` | 3 | create schema `:117`、execute `:137`、update 描述 `:153` |
| `src/host/repoBuild.ts` | 3 | `buildTask` `:40,59`、`patchTask` `:102` |
| `src/client/task-row.ts` | 3 | `dueText` `:82-88` |
| `src/host/repoTypes.ts` | 2 | `CreateTaskInput` `:18`、`UpdateTaskPatch` `:31` |
| `src/client/dictionary-zh.ts` | 2 | `form.dueDate` `:97-98` |
| `src/client/dictionary-en.ts` | 2 | `form.dueDate` `:97-98` |
| `src/host/taskRoutes.ts` | 1 | create `:82` |
| `src/host/state.ts` | 1 | `coerceTask` `:239`（及 `coerceDueDate` `:274-279`） |
| `src/host/rules/types.ts` | 1 | `Task.dueDate` `:102` |

**test（67 处 / 10 文件）**

| 文件 | 处数 | 说明 |
|---|---:|---|
| `test/priority.test.ts` | 44 | `derivePriority(dueDate...)` 单测、`selectView` 计数、排序、分组全部基于 dueDate |
| `test/validate.test.ts` | 5 | `validateDueDate` 5 个断言 `:88-98` |
| `test/repo.test.ts` | 5 | 计数/搜索 fixture `:41,52,159-161` |
| `test/state.test.ts` | 3 | round-trip `:42`、非法 dueDate `:123-125` |
| `test/review-fixes.test.ts` | 3 | TaskView round-trip `:173`、search 计数 `:228-229` |
| `test/tools.test.ts` | 2 | create/list `:151,196` |
| `test/routes.test.ts` | 2 | snapshot/create `:185,225` |
| `test/store.test.ts` | 1 | reload `:182` |
| `test/fixtures.ts` | 1 | `makeTask` `:49` |
| `test/archive.test.ts` | 1 | active old task `:176` |

**编译产物**：`lib/` 下有 50 处 `dueDate`（11 个文件），是 `tsc` 输出，改造后必须用 `node scripts/build.mjs` 重新生成；不要手改 `lib/`。

**结论**：`dueDate` 不是局部字段——它已经进入持久化、校验、API、工具 schema、表单、词典、测试 fixture。删除时必须「类型先改 → 编译器报错 → 逐项消除」，不能只改 `Task` 类型。

### 4.2 多任务时区下 `today` / `todayFor` 的现有处理

现状有 **67 行**涉及 `today|todayFor|todayKey|localDateKey`（host+client）。关键路径：

1. `Repository.list()` 只计算一个 `today`：`query.today ?? todayKey(clock(), store.state.settings.timeZone)`（`repo.ts:113-114`），然后把同一个 `today` 传给 `queryTasks`；`queryTasks` 对所有任务用这一个日期做 `selectView`（`repoQuery.ts:54,63,74`）。
2. `/snapshot` 在 `routes.ts:126` 取全局 `today` 传给 `repo.list`（`:135`）；但同一响应的行视图又传 `todayFor: task => localDayKeyForTask(...)`（`:142`）。也就是说：**同一份 items 的 `priority/overdue` 用任务自己的时区算，而 `counts` 用全局时区算**。当任务跨时区且处于日期边界时，会出现「徽标 1 / 行 2」或反之。
3. `taskRoutes.optionsFor()` 用 `task?.rule?.timeZone ?? ctx.config.timeZone`（`taskRoutes.ts:29-32`），**忽略 `task.once.timeZone`**；`toolDefs.view()` 同样（`toolDefs.ts:42-45`）；`delivery.buildReminderCard()` 同样（`delivery.ts:92`）；`archive.quarterOf(task.doneAt, task.rule?.timeZone ?? timeZone)`（`archive.ts:225,233`）同样。one-off 任务 `rule === null` 时全部落到全局/默认时区。
4. `index.ts:288` 的 `today: () => localDateKey(Date.now(), repo.settings().timeZone)` 使用 **settings** 时区，而 `tools/archive` 使用 **config** 时区（`toolDefs` 的 `timeZone: config.timeZone`，`index.ts:312`；`archive` `index.ts:253`）。用户改全局设置后二者可能分叉。

**D-25 之后的正确方向**：`phase/priority` 全部按**绝对时刻**比较，不再需要「today」；仅「超期 N 天」展示与 DND 仍需要任务时区本地日期。建议：

- `Repository.list(query)` 改收 `now: Date`，删除 `ListQuery.today`（`repoTypes.ts:47-48`）。
- `selectView(tasks, view, now)`、`sortTasksForView(tasks, now)` 不再接收 `today` 字符串。
- `toTaskView` 的 `ViewOptions` 保留 `now`，删除 `today/todayFor`；`overdueDays` 内部按 `taskTimeZone(task)` 计算。
- 所有 `task.rule?.timeZone ?? ...` 改用 `taskTimeZone(task, fallback)`（`taskView.ts:93-95` 已有正确实现，复用即可）。
- 路由一次请求只取一个 `now`，并把它同时交给 `repo.list` 与 `toTaskViews`。
- `archiveCompleted` 的 `keepQuarter` 与任务季度归属按任务时区；`timeZone` 参数只作 fallback。

### 4.3 `TaskView` 类型如何被 round-trip 使用

`TaskView` 定义在 `src/host/taskView.ts:17-40`，当前是 `Omit<Task,'state'>` + 派生字段。它的 round-trip 主要在 4 条路径：

1. **F1.1 验收测试**：`test/review-fixes.test.ts:165-192` 把 `toTaskView(task)` 的 `title/kind/dueDate/rule/notify` 重新喂给 `repo.create()`，断言 cron 一致。这是明确按「TaskView 字段可回填 create」写的；D-25 后必须去掉 `dueDate`，并为 once 增加完整 round-trip 分支（当前只测 recurring）。
2. **客户端复制任务**：`panel.ts:197-202` 与 `:308-317` 先 `draftFromTask(task)` 再 `draftToPayload`，不是直接把 `TaskView` POST；但 `draftFromTask` 会读 `task.dueDate`（`task-editor.ts:80`）与 `task.once.startAt/endAt`（`:107-108`）。D-25 后若 `startAtSource='created'` 被复制成显式 startAt，会改变「是否提醒开始」。
3. **`todo_reminder_update` 的 `patch`**：`toolDefs.ts:159` 的 `patch` 是任意 object，`:168-172` 原样传给 `repo.update`。如果调用方把整个 `TaskView` 当 patch 传入，`patchTask` 会收到 `priority/phase/fired/nextAt/utcOffset/overdueDays/overdue/state/revision` 等派生/只读字段；当前 `patchTask` 忽略未知字段（`repoBuild.ts:98-126`），但 D-25 新增 `phase` 后若误把 `phase` 当业务字段处理会出错。建议工具 patch 使用显式字段 schema，且宿主 `patchTask` 对未知字段明确拒绝/忽略策略。
4. **归档恢复**：`archiveRestore.ts:105-113` `...found.task` 直接展开原始 JSON。若归档文件是 v1 含 `dueDate`，恢复后该属性会作为「类型外属性」残留在内存并写回 `tasks.json`（TypeScript 不会拦截运行时对象）。这是**必须通过 `coerceTask`/迁移堵住的隐藏通道**。

**建议类型拆分**（降低未来漂移）：

```ts
type PersistedTask = { /* 只含可写业务字段 + id/revision/createdAt/updatedAt */ }
type TaskView = PersistedTask & {
  phase: TaskPhase
  priority: { key: PriorityKey; remainingMinutes: number | null }
  fired: boolean
  timeZone: string
  utcOffset: string
  nextAt: string | null
  overdueDays: number | null
  overdue: boolean
}
type CreateTaskInput = { /* title/description/kind/rule?/once?/notify?/timeZone?/pinned? */ }
```

并在 `taskView.ts` 导出 `taskViewToCreateInput(view)` 供测试/工具/复制复用；`TaskView` 不再 `extends Omit<Task>` 把 id/revision 混入「可写」语义。

### 4.4 `selectView(tasks, view, today)` → `(tasks, view, now)` 的波及面

| 类别 | 位置 | 数量/说明 |
|---|---|---|
| 定义 | `src/host/rules/priority.ts:128` | 签名改为 `(tasks, view, now, opts?)`；`ViewResult` 六 counts |
| 宿主调用 | `src/host/repoQuery.ts:63,74` | 两处；改传 `now`；`queryTasks` 签名改 `(allTasks, query, now)` |
| 宿主类型消费 | `src/host/repoTypes.ts:52-57`、`repo.ts:23-35`、`routes.ts:137-148`、`toolDefs.ts:93-98` | counts 六值；`ListResult` 改 `ViewResult + nextCursor` |
| 其他派生函数 | `derivePriority` `priority.ts:36`、`priorityOf` `:55`、`isOverdue` `:70`、`daysOverdue` `:80`、`sortTasksForView` `:96`、`groupTodoTasks` `:181` | 全部由 `todayLocalDate: string` 改为 `now: Date`（或 `task, now`）；测试需同步 |
| 测试直接调用 | `test/priority.test.ts:152,159,171,177,183(×2),187,193,194,195,210,214,218` | 13 处 `selectView` 调用 + `derivePriority` 5 处 + `groupTodoTasks` 2 处；`TODAY` 常量改为 `NOW` Date |
| `repo.list` 调用 | `src/host/routes.ts:127`、`toolDefs.ts:84`；测试 `repo.test.ts` 8 处、`review-fixes.test.ts` 2 处 | `ListQuery.today` → `now`；测试全部改传 `now: new Date(...)` |
| 客户端 | `api.ts:128` 的 `snapshot(view, search)`、`panel.ts:69-83` 的 `load` | view 六值；counts 六值；`today` prop 删除 |

**注意**：`selectView` 不能只改参数名。它目前返回的 `prioritySummary` 依赖 `derivePriority(task.dueDate, today)`（`:143`），而 `done` 视图按 `doneAt` 排序（`:146-156`），`recurring` 视图需要 `nextAt`（依赖 holiday 表），所以必须同时引入 `holidays`/`nextAt` 的计算入口（见 Q1）。

### 4.5 `priority.daysLeft` → `remainingMinutes` 的 API/UI 兼容

- **类型**：`Priority` 在 `src/host/rules/types.ts:141-145` 定义 `daysLeft: number | null`；`TaskView.priority`（`taskView.ts:24-25`）把它暴露到 HTTP 与工具返回值。改成 `remainingMinutes` 是**破坏性 API 变更**（`GET /tasks/get`、`/snapshot`、全部 `todo_reminder_*` 返回）。
- **源码**：`src` 内除 `priority.ts` 自身外，无其他代码读取 `daysLeft`（已 grep 确认）；客户端只读 `task.priority.key`（`grouping.ts:39`、`task-row.ts:138`），因此**UI 视觉层兼容**，只需改类型和文案。
- **测试**：`test/priority.test.ts:37-55,62` 断言 `daysLeft`/deepEqual；需全量改写。`test/repo.test.ts:164` 断言 `prioritySummary` 的键（不变）但输入 fixture 变。
- **建议**：保持 `key` 取值不变（`high/mid/low/none/paused`），只把数值字段换成 `remainingMinutes`（负数=超期，null=无时间目标/暂停），这样 `prioritySummary` 与 CSS class 无需迁移；在 v0.1.0 尚未正式发布的前提下接受 breaking change，不保留 `daysLeft` 别名（若保留会违背 §7.4 字段表）。

### 4.6 `counts` 三值 → 六值对 `queryTasks` / 前端徽标 / 分页 / 过滤的影响

1. **现有 bug（会被六值放大）**：`queryTasks` 先按 `status`/`kind` 过滤 `pool`（`repoQuery.ts:58-59`），再 `selectView(pool,...)` 算 counts（`:63`）。注释说「counts 计算在 unfiltered pool 上」（`:61-62`），但 status/kind 实际会缩小 counts；目前只有 search 被特意放在 counts 之后（`:67-72`）。改造时应把 counts 固定为「全部非归档任务」（不受 view/status/kind/query 影响），否则新加的 `recurring`/`paused` 筛选一打开，六值徽标就会跟着变。
2. **六值结构**：建议 `counts: { notStarted, inProgress, overdue, done, paused, recurring }`；`byKind: { once, recurring }` 覆盖全部非归档任务（与 F4.21 例子一致：once 11 = 3+2+1+4+1）；`totalDone` = 主文件 `done` + `archive/index.json` 各季度 count 之和。
3. **`totalDone` 不在 `selectView` 能力范围**：`selectView(tasks, view, now)` 只拿到主文件 tasks，拿不到归档文件；§7.5 的 `ViewResult` 却包含 `totalDone`。需路由层注入（见 Q2）。建议 `selectView` 不负责 `totalDone`，`ListResult.totalDone` 由 `Repository.list`/route 提供。
4. **分页**：当前客户端 `panel.load` 只取第一页，`SnapshotPayload.nextCursor` 被忽略（`api.ts:42`、`panel.ts:72`、`grep nextCursor` 仅 archive-view 使用）；F4.6「默认 50 条/页」在面板上未实现。六视图后每 view 各自分页，建议在 panel 增加 cursor 状态与「加载更多」，否则 1000 条任务首屏只显示 50 且无解释。`queryTasks` 的 cursor 按 `createdAt|id` 定位（`repoQuery.ts:13-15,88-95`），切换排序（done 按 doneAt、recurring 按 nextAt）后仍能定位（因为它按 pivot 找 index），保留该设计。
5. **前端徽标**：`panel.ts:51` state 改六值；`:116` firstRun 的 sum 改六值或 `totalDone`；`:243-257` tab 渲染改四阶段 + 两个 filter；`Counts` 类型在 `api.ts:43` 同步。

### 4.7 `state` 校验：`coerceDueDate` 与新字段

| 项 | 现状 | 风险 | 改法 |
|---|---|---|---|
| `coerceDueDate` | `state.ts:274-279`，仅接受 `YYYY-MM-DD` 并校验真实日期；`coerceTask:239` 调用 | 删除 dueDate 后该函数无调用者；若保留会误导 | 删除函数与调用；`coerceTask` 不读 `dueDate` |
| `notify.endReminder` | `coerceTask:245-252` 未读取 | v2 文件缺省时 undefined，前端行为不确定 | 读取 boolean，缺省 true |
| `once.startAtSource` | `coerceOnce:311-318` 不读 | v1 迁移/ v2 手写文件缺省时 undefined；`onceOccurrences` 无法判断是否排 start | 读取；缺省 `'explicit'`（保守：保留旧行为）；仅接受 `explicit/created` |
| `state.fired` | `coerceTask:253-267` 完全忽略 raw `state.fired` | F3.4 要求「忽略并返回 warning」，现在静默 | `coerceTask` 增加 warning 收集；发现 `fired` 存在且与 `firedStart&&firedEnd` 不一致时 warning |
| `once.startAt` 缺失 | `coerceOnce:313-314` start null → 整个任务被丢弃 | v2 手写/导入缺 startAt 会把任务丢掉，而不是补 createdAt | `coerceTask` 先解析 `createdAt`；若 once.startAt 缺失，用 createdAt 填充并 `startAtSource='created'` |
| 版本字段 | `coerceState:148-158` 对 `<SCHEMA_VERSION` 返回 migration-failed | store 已先迁移，正常路径 OK；直接调用 `coerceState` 的调用方需注意 | 保持；文档注明「必须先 migrate 再 coerce」 |

### 4.8 `archive/*.json` 迁移清单（三处文件 + 四个写点）

| 文件 | 读路径 | 写路径 | 现状风险 |
|---|---|---|---|
| `archive/completed-YYYY-Qn.json` | `archive.ts:181`（rebuildIndex）、`:251`（archiveCompleted merge）、`:318`（reconcile）、`:350`（readQuarter）；`archiveRestore.ts:46,83` | `archive.ts:266`（archiveCompleted），`archiveRestore.ts:89` | 全部 `JSON.parse` 后直接当 `Task[]`；v1 任务的 `dueDate`/缺 `startAtSource` 会进入 v2 系统；写回硬编码 `schemaVersion:1` |
| `archive/index.json` | `archive.ts:146-148`（readArchiveIndex） | `archive.ts:291`、`archiveRestore.ts:101`、`index.ts:195-198`（rebuild） | `schemaVersion` 缺省 1；写入固定 1 |
| 主文件 `tasks.json` | `store.ts:202-308` | `store.ts:125-159` | 已有迁移框架；需补 v1→v2 链 |

**建议统一 helper**：

```ts
// archive.ts
export function readQuarterFile(filePath): { quarter: string; tasks: Task[] } // parse → migrate if v1 → coerceTask each → warnings
export function writeQuarterFile(...) // always schemaVersion: SCHEMA_VERSION
export function readArchiveIndex(...) // migrate index schemaVersion, keep entries
```

**迁移顺序**：对每个归档文件「解析 → 若 schemaVersion=1 执行同一 `migrateState`（tasks 层面）→ `coerceTask` → 原子写回 v2」。若写回失败，保留原文件并 warning（F9.5 不覆盖失败文件）；读取路径可以先返回迁移后的内存数据，写回可延迟到下一次归档/恢复（见 Q6）。

### 4.9 `schemaVersion 1→2` 需要同时处理的 5 条链路

1. **主文件 `tasks.json`**：`store.load` → `migrateState` → `coerceState`（`store.ts:248-302`）。补迁移链；成功后标脏并写回 v2；保留 `tasks.json.bak`。
2. **归档季度文件**：`archive/completed-*.json`（见 4.8）。`readQuarter`、`findArchivedTask`、`archiveCompleted` 的 merge、`rebuildIndex` 都要走同一 helper；写回 `SCHEMA_VERSION`。
3. **归档索引**：`archive/index.json`。`readArchiveIndex` 升级版本；`rebuildIndex` 输出 2；所有写点改常量。
4. **导入**：`transfer.parseImport`。v1 文件先 `migrateState`，warning 合并到 `ImportResult.warnings`；`buildExport` 自动输出 2。
5. **导出/备份/恢复**：`buildExport` 用 `SCHEMA_VERSION`；`archiveRestore` 恢复时 `coerceTask`；`store` 的 `tasks.json.bak` 是 v1 时回滚仍可被新代码迁移。

**验收**：构造 v1 `tasks.json`（含 `dueDate`、`once.startAt/endAt`、`notify` 无 `endReminder`）、v1 季度文件、v1 index；启动后三者都读为 v2，`dueDate` 不存在，`startAtSource='explicit'`、`endReminder=true`；`GET /tasks/get` 无 `dueDate`；旧 v2 文件被 v1 插件读取时 `health.storage.state='unsupported-version'` 且文件不变（已有 `store.ts:248-266` 逻辑）。

### 4.10 工具 schema 去掉 `dueDate` 的具体改动

| 工具 | 现状 | 改动 |
|---|---|---|
| `todo_reminder_list` | `view` enum `['todo','done','overdue']`，默认 `todo`（`toolDefs.ts:71,85`）；返回 `counts` 三值（`:96`） | enum 六值 `['notStarted','inProgress','overdue','done','recurring','paused']`，默认 `inProgress`；返回六 counts（可选 `byKind/totalDone`） |
| `todo_reminder_create` | property `dueDate` `:117`；execute `:137`；once 描述「两者必填」`:122` | 删 `dueDate`；once 描述 `{startAt?,endAt}`，说明 startAt 省略=创建时间且不产生 #start；`notify` 描述加 `endReminder` |
| `todo_reminder_update` | 描述含 `dueDate` `:153`；patch 任意 object `:159` | 描述删 `dueDate`；建议 patch schema 显式列 `title/description/rule/once/notify/pinned`，拒绝 `dueDate`/只读字段 |
| 其他 6 个工具 | 无 dueDate | 无需改 |
| 工具描述通用 | 已有「开始和结束都会各提醒一次（D-03）」`toolDefs.ts:108` | 改为「显式 startAt 时两端各一次；省略 startAt 只提醒结束；`endReminder:false` 只提醒开始（需显式 startAt）」 |

### 4.11 客户端表单删除截止日期 + 新增 `endReminder/startAt` 可空 + 示例/i18n

- **表单模型**：`TaskDraft`（`task-editor.ts:17-38`）删 `dueDate`，加 `endReminder: boolean`、`startAtSource: 'explicit' | 'created'`；`emptyDraft` 默认 `endReminder: true`、`startAtSource: 'explicit'`。
- **回填**：`draftFromTask`（`:72-111`）对 `once.startAtSource === 'created'`：`startAt=''`，另存 `createdStartAt`（只用于详情展示）或直接展示 `task.once.startAt` 但标记「默认」；保存时若用户未改则 payload 省略 `startAt`。`rule?.timeZone ?? fallbackZone` 改 `task.once?.timeZone ?? rule?.timeZone ?? fallbackZone`。
- **提交**：`draftToPayload`（`:144-188`）删 `dueDate`；once 分支：`startAt` 空 → 不发送；`notify.endReminder` 总是发送；`draft.timeZone` 继续传。
- **校验**：`TaskEditor.save` `:237-274` 改为：`endAt` 必填；`endReminder=false && startAt===''` 本地报错；日期-only 结束输入需补 `23:59:59.999`（见 M3）。
- **字段渲染**：`editor-fields.ts` 删除 `BasicFields` 的 dueDate 块 `:329-344`；`OnceFields` `:237-269` 开始时间 label 加「可留空」提示，结束时间必填，增加 `endReminder` checkbox（文案「只提醒开始（会议类）」），并加 `form.startAtHint`/`form.endReminder`/`form.endReminderHint`。
- **i18n**：`dictionary-zh.ts`/`en.ts` 增加 `tab.notStarted/inProgress/overdue/done/recurring/paused`、`filter.recurring/filter.paused`、`form.startAtHint/endReminder/endReminderHint`、`task.overdueHours` 等；删除 `form.dueDate`/`form.dueDateHint`；`task.overdue` 文案从「{n} 天」改为「{n}」单位可配置；`rule.high/mid/low/none/refresh` 改为 F8.12 文案。**中英 key 集合必须保持完全一致**（`dictionary.ts` 注释要求）。
- **示例**：`examples.ts:40-47` 的 `once` 示例仍可用 `emptyDraft`，但 `emptyDraft` 删除 dueDate 后编译通过；建议示例 3 仍显式 `startAt=14:00`（F8.15 原文），并新增（或替换）一个「只填结束时间」示例以展示新能力（若维持 3 张卡则把示例 3 改为只给 endAt 更能验证 D-25）。
- **样式**：`styles.ts` 增加 `.dtd-filters`/`.dtd-filter`（循环/暂停筛选 chip），`.dtd-tabs` 保持四 tab；`.dtd-rules .refresh` 文案不再 00:05；`@media (width<=720px)` 规则条折行保持。

---

## 5. 逐文件改造清单（含函数名与行为变化）

> 依赖批次见 §6：B1=模型/迁移，B2A=派生，B2B=调度，B2C=路由/工具，B3A=客户端数据层/面板，B3B=客户端表单/i18n，B3C=测试/回归。

### 5.1 宿主数据模型与迁移

| 文件 | 函数/位置 | 行为变化 | 批次 |
|---|---|---|---|
| `src/host/rules/types.ts` | `Phase`（:24-25）、`OnceWindow`（:47-59）、`NotifySettings`（:61-68）、`Task`（:95-113）、`Priority`（:138-145）、`TaskViewName`（:147-148）、`ViewResult`（:150-155） | `Phase` 重命名为 `OccurrencePhase`（新增 `TaskPhase` 六态）；`OnceWindow` 加 `startAtSource`；`NotifySettings` 加 `endReminder`；`Task` 删 `dueDate`；`Priority` 改 `remainingMinutes`；`TaskViewName` 六值；`ViewResult` 加 `byKind/totalDone` | B1 |
| `src/host/state.ts` | `SCHEMA_VERSION`（:17）、`coerceTask`（:206-272）、`coerceDueDate`（:274-279）、`coerceOnce`（:311-318）、`coerceRule`（:286-304）、`coerceState`（:143-198） | 版本 2；删 `dueDate` 读取与 `coerceDueDate`；`coerceTask` 读 `endReminder`/`startAtSource`；once 缺 startAt 时用 createdAt 补；warning 收集 `state.fired`/未知字段；`coerceState` 保持版本检查 | B1 |
| `src/host/repoTypes.ts` | `CreateTaskInput`（:14-25）、`UpdateTaskPatch`（:28-36）、`ListQuery`（:39-49）、`ListResult`（:51-57） | 删 `dueDate`；`ListQuery.today`→`now?: Date`；`ListResult` 六 counts + `byKind/totalDone` | B1 |
| `src/host/repoBuild.ts` | `buildTask`（:34-84）、`patchTask`（:98-127） | `buildTask` 调 `validateOnce(input.once, {timeZone, createdAt})`；created source 设 `firedStart=true`；`validateNotify` 加 endReminder；删 dueDate；`patchTask` 分 `once.startAt`/`once.endAt` 两个子 patch，按节点重置 `firedStartAdvance/missedStart` 等，保留未改端的 source | B1 |
| `src/host/validate.ts` | `validateDueDate`（:68-85）、`validateNotify`（:144-200）、导出（:13-15） | 删除 `validateDueDate`；`validateNotify` 加 `endReminder`（默认 true）校验；返回值加字段 | B1 |
| `src/host/validateTime.ts` | `validateOnce`（:17-37）、`parseInstant`（:46-60） | 新签名 `validateOnce(value, opts: { timeZone; createdAt; current? })`；startAt 缺省用 createdAt 并 source='created'；endAt 日期-only 补 23:59:59.999；返回 `{startAt,endAt,timeZone,startAtSource}`；支持 update 的 partial（用 `current` 补全） | B1 |
| `src/host/migrations.ts` | `Migration`（:12-23）、`MIGRATIONS`（:32）、`migrateState`（:49-85） | 新增 v1→v2 migration；`MigrateResult` 增 `warnings`；保持链式纯函数与失败不覆盖 | B1 |
| `src/host/store.ts` | `load`（:202-308）、`writeAtomic`（:125-159） | 迁移后 `isDirty=true` 并写回 v2；`coerceState` 前已 migrate；日志列出 warning；主文件备份保留 | B1 |
| `src/host/archive.ts` | `ArchiveIndex`（:33-37）、`QuarterFile`（:103-108）、`readArchiveIndex`（:139-153）、`rebuildIndex`（:162-197）、`archiveCompleted`（:216-294）、`readQuarter`（:339-355） | 新增 `readQuarterFile`/`writeQuarterFile` 做迁移+coerce；所有 `schemaVersion` 用 `SCHEMA_VERSION`；`archiveCompleted` 合并前迁移旧 tasks；`readQuarter` 返回 v2 Task；`quarterOf` 用 `task.once?.timeZone ?? rule?.timeZone ?? timeZone` | B1 |
| `src/host/archiveRestore.ts` | `findArchivedTask`（:35-54）、`restoreArchivedTask`（:70-115） | 读取/恢复前迁移+coerce；保留 `startAt/startAtSource`；index 写 `SCHEMA_VERSION`；恢复后 phase 由 `TaskView` 读时计算（无需改 status） | B1 |
| `src/host/transfer.ts` | `buildExport`（:42-51）、`parseImport`（:83-120）、`ImportCandidate`（:68-73） | 导入 v1 先 `migrateState`；warning 合并；导出 schemaVersion 自动 2；`settings` 用 `coerceSettings` 校验（顺带） | B1 |
| `src/host/transferRoutes.ts` | `POST /import`（:45-87） | `skipped` 用 candidate 统计；warnings 透传（已具备） | B1 |

### 5.2 宿主派生

| 文件 | 函数/位置 | 行为变化 | 批次 |
|---|---|---|---|
| `src/host/rules/priority.ts` | `derivePriority`（:36-46）、`priorityOf`（:55-61）、`isOverdue`（:70-77）、`daysOverdue`（:80-86）、`sortTasksForView`（:96-112）、`selectView`（:128-170）、`groupTodoTasks`（:181-212） | `derivePriority(task, now, opts?)` 返回 `remainingMinutes`；`priorityOf` paused→paused；`isOverdue` 改 `phaseOf==='overdue'`；`daysOverdue` 按 endAt/任务时区；排序用 endAt/nextAt；`selectView` 六视图六 counts；`groupTodoTasks` 去掉 paused | B2A |
| `src/host/taskView.ts` | `TaskView`（:17-40）、`ViewOptions`（:42-52）、`toTaskView`（:60-84）、`taskTimeZone`（:93-95）、`expandRule`（:113-137） | 加 `phase`；`priority` 改 remainingMinutes；`fired` 严格 `firedStart&&firedEnd`；`ViewOptions` 删 today/todayFor 改为 `now`（如保留 overdueDays 则内部按任务时区）；`nextAt` 对 created-source 不返回 start | B2A |
| `src/host/repoQuery.ts` | `todayKey`（:39-41）、`queryTasks`（:54-97） | `queryTasks(allTasks, query, now)`；counts 基于全部非归档（不随 status/kind/search 变化）；六视图 items；`nextCursor` 保留 | B2A |
| `src/host/repo.ts` | `list`（:112-115）、`applyTick`（:315-376）、`complete`（:163-211） | `list` 用 `query.now` 一次；`applyTick` 删除自动 done（:360-370）；`complete` 保持显式 done；`snapshotTasks` 不变 | B2B |

### 5.3 宿主调度

| 文件 | 函数/位置 | 行为变化 | 批次 |
|---|---|---|---|
| `src/host/rules/occurrence.ts` | `onceOccurrences`（:144-151）、`dueOccurrences`（:169-211）、`nextFireAt`（:255-274）、`nextWakeAt`（:283-296） | `onceOccurrences` 按 `startAtSource`/`endReminder` 生成节点；`dueOccurrences` once 分支检查 advance/missed 标记；`nextFireAt` 同样；新增 `nextTransitionAt`（或放 priority） | B2B |
| `src/host/rules/resolveTick.ts` | `resolveTick`（:57-122）、`collectOnceDue`（:130-148）、`nextWakeAtFor`（:168-181） | created-source 不产生 start due/missed；endReminder=false 不产生 end；`nextWakeAtFor` 只算实际提醒；`TickPlan` 不变 | B2B |
| `src/host/tickChanges.ts` | `planToChanges`（:24-39） | 类型仅 `OccurrencePhase` 重命名；行为不变（node 仍关键） | B2B |
| `src/host/index.ts` | `createTick`（:85-152）、`apply`（:174-322）、routeContext（:281-293） | `health.recordTick` 删日期参数；`routeContext.today` 删除/改 `now`；归档注释改 6h；`config.timeZone` 与 `repo.settings().timeZone` 统一 | B2B |
| `src/host/health.ts` | `HealthState.recordTick`（:24-51）、`HealthSnapshot.scheduler`（:58-66）、`recordTick`（:130-142）、`snapshot`（:181-218） | 删除 `lastPriorityRefreshAt`/`priorityDate`；`recordTick(now, plan, taskCount)`；`snapshot` 不返回该字段 | B2B |

### 5.4 宿主路由/工具

| 文件 | 函数/位置 | 行为变化 | 批次 |
|---|---|---|---|
| `src/host/routes.ts` | `GET /snapshot`（:117-149）、`GET /priority/rules`（:151-156）、archive 路由（:158-193）、`localDayKeyForTask`（:384-392） | snapshot 六 view、默认 inProgress、一次 now、补 `byKind/totalDone/serverTime/nextTransitionAt`；priority/rules 新返回；archive 读取走迁移；`localDayKeyForTask` 删除或改 now | B2C |
| `src/host/taskRoutes.ts` | `optionsFor`（:29-32）、create（:73-90）、update（:92-114）、restore（:187-216） | `optionsFor` 用 `taskTimeZone`；create 删 dueDate/拒绝；update 校验 patch、禁止 dueDate；restore 读迁移后的 archive task | B2C |
| `src/host/routeKit.ts` | `STATUS_BY_CODE`（:12-28）、helpers | 无行为变化；错误码表保持兼容 | B2C |
| `src/host/toolDefs.ts` | `view`（:42-45）、list（:61-103）、create（:104-148）、update（:150-178） | list view 六值默认 inProgress；create schema 删 dueDate、once 描述；update 描述/patch schema；`view()` 用 taskTimeZone；`todayOf` 删除 | B2C |
| `src/host/tools.ts` | `createToolDefinitions`/`registerTools` | 无行为变化；仍 9 工具 | B2C |
| `src/host/delivery.ts` | `buildReminderCard`（:91-117） | 时区用 `task.once?.timeZone`；其余不变 | B2C |

### 5.5 客户端

| 文件 | 函数/位置 | 行为变化 | 批次 |
|---|---|---|---|
| `src/client/api.ts` | `SnapshotPayload`（:39-46）、`snapshot`（:126-131）、`health`（:240-247） | counts 六值 + byKind/totalDone + serverTime/nextTransitionAt；view 六值 | B3A |
| `src/client/panel.ts` | `ViewName`（:31）、state（:45-63）、`load`（:68-83）、effects（:94-132）、firstRun（:112-118）、tabs（:240-258）、rule strip（:259-267）、duplicate（:197-202/308-317） | 六视图；四 tab + recurring/paused filter；counts 六值；`browserToday` 删除；边界刷新 + 60s；复制保留 startAt/source 并提示 | B3A |
| `src/client/task-list.ts` | props（:21-46）、empty（:114-150）、todo 分组（:152-171） | `view` 六值；recurring/paused 平铺视图；阶段视图分组；空态六套文案 | B3A |
| `src/client/grouping.ts` | `GROUP_ORDER`（:12）、`groupItems`（:21-43） | 去掉 `paused` 组（paused 独立视图）；阶段视图按优先级/置顶分组 | B3A |
| `src/client/task-row.ts` | `ruleSummary`（:40-68）、`dueText`（:77-89）、`nextText`（:96-99）、badge（:138-139） | `dueText`→`deadlineText`：once `endAt`/phase/remainingMinutes，recurring `nextAt`；ruleSummary created-source 显示「创建即开始」、endReminder=false 显示「仅开始」；phase badge | B3A |
| `src/client/archive-view.ts` | `ArchiveView`（:30-186） | TaskRow props 变化；归档任务 `phase='archived'` 展示；其余保留 | B3A |
| `src/client/overlay.ts` | `PHASE_KEYS`（:23-27）、cards（:216-255） | 无功能变化；验证默认 once 只有 `#end` | B3A |
| `src/client/ui.ts` | `browserToday`（:142-148）、`dayDiff`（:156-161）、`formatInZone`（:169-187） | 若 task-row 不再用 `dayDiff`/`browserToday` 则删除；`formatInZone` 保留 | B3A |
| `src/client/task-editor.ts` | `TaskDraft`（:17-38）、`emptyDraft`（:40-64）、`draftFromTask`（:72-111）、`draftToPayload`（:144-188）、`save`（:237-274） | 删 dueDate；加 endReminder/startAtSource；created 来源 startAt 留空；date-only 结束处理；保存校验；`once.timeZone` 回填 | B3B |
| `src/client/editor-fields.ts` | `OnceFields`（:237-269）、`BasicFields`（:277-357） | 删 dueDate 块；OnceFields 可空 startAt + endReminder checkbox + hint | B3B |
| `src/client/dictionary-zh.ts` | 全文 | 增删 key（见 §4.11） | B3B |
| `src/client/dictionary-en.ts` | 全文 | 与 zh 完全同步 | B3B |
| `src/client/examples.ts` | `buildExamples`（:24-53） | 删除 dueDate 依赖；示例 3 可按 Q10 调整 | B3B |
| `src/client/styles.ts` | tabs/rules（:26-42）、pinned（:64-65）、media（:161-168） | 新增 filter chip 样式；规则条文案不再 00:05（文案在词典）；无字面色 | B3B |
| `src/client/index.ts` | slot 注册（:69-94） | 无变化 | — |

### 5.6 测试与夹具

| 文件 | 改动 |
|---|---|
| `test/fixtures.ts` | `makeTask` 删 `dueDate`（:49）；`makeNotify` 加 `endReminder:true`；`makeOnceTask` 默认 `startAtSource:'explicit'`；建议新增 `makeCreatedOnceTask` |
| `test/priority.test.ts` | 重写 `derivePriority` 用例（当前 44 处 dueDate）；`TODAY`→`NOW`；13 处 `selectView` 六视图；新增 phaseOf/remainingMinutes/nextAt 排序用例 |
| `test/state.test.ts` | 删除 dueDate 用例（:42,123-125）；新增 v1→v2 样本迁移；`coerceOnce` 新字段断言；`SCHEMA_VERSION` 断言 2 |
| `test/validate.test.ts` | 删除 `validateDueDate` describe（:86-100）；`validateOnce` 改为可选 startAt/date-only endAt/source；新增 endReminder 校验 |
| `test/store.test.ts` | 删 dueDate（:182）；新增 v1 文件加载→v2 落盘；`migrate` 失败不覆盖已有 |
| `test/archive.test.ts` | 删 dueDate（:176）；新增 v1 季度文件迁移/读取；`schemaVersion` 2 断言 |
| `test/transfer.test.ts` | `bundle.schemaVersion` 1→2（:33）；新增 v1 payload import→迁移 warning；`parseImport` 不破坏 v2 |
| `test/repo.test.ts` | 删 dueDate 输入（:41,52,159-161）；counts 六值/`byKind/totalDone`；auto-done 若有用例需改 |
| `test/routes.test.ts` | snapshot 六 counts/新字段；priority/rules 新返回（:209-216）；create 不再传 dueDate（:185,225） |
| `test/tools.test.ts` | list 默认 inProgress/六 counts；create 不传 dueDate（:151,196）；新增工具 schema 不含 dueDate 断言 |
| `test/review-fixes.test.ts` | 4 个自动 done 块改 `active+overdue`（:143-163/273-307/369-395/412-444）；TaskView round-trip 删 dueDate（:173）；`fired` 断言改严格两布尔（:447-467） |
| 新增 | `test/phase.test.ts`（六态/边界 now==endAt）；`test/migration-v2.test.ts`（主文件+归档+index）；`test/start-at-optional.test.ts`（默认 startAt 无 #start）；`test/counts-v2.test.ts`（F4.21 例子） |

---

## 6. 实施顺序与工作量

### 6.1 三批次实施顺序（写域分组）

#### 批次 1：模型与迁移（串行，所有后续工作的地基）

**写域**：`src/host/rules/types.ts`、`state.ts`、`repoTypes.ts`、`repoBuild.ts`、`validate.ts`、`validateTime.ts`、`migrations.ts`、`store.ts`、`archive.ts`、`archiveRestore.ts`、`transfer.ts`、`test/fixtures.ts`、`test/state.test.ts`、`test/validate.test.ts`、`test/store.test.ts`、`test/archive.test.ts`、`test/transfer.test.ts`

**内容**：M1–M7 的类型/校验/迁移；P1–P8 的主文件+归档+index+import 迁移；coerce 新字段；`firedStart` 默认。

**验收门槛**：

1. `./node_modules/.bin/tsc --noEmit -p tsconfig.json` 与 `-p tsconfig.client.json` 均 0 错误；
2. `./node_modules/.bin/tsc -p tsconfig.test.json` 0 错误；
3. `node --test .test-build/test/{state,validate,store,archive,transfer}.test.js` 全绿；
4. 手工样本：v1 `tasks.json`（含 `dueDate`）、v1 `completed-2026-Q3.json`、v1 `index.json` → 启动后均变为 v2；`dueDate` 不存在、`startAtSource='explicit'`、`endReminder=true`；
5. `rg -n "dueDate" src/host` 仅剩迁移函数/注释（0 处业务引用）。

#### 批次 2：派生、调度、路由/工具（2A 先锁类型，2B/2C 并行）

| 子批 | 写域 | 内容 | 验收门槛 |
|---|---|---|---|
| 2A（先） | `src/host/rules/priority.ts`、`taskView.ts`、`repoQuery.ts` | phaseOf/priority remainingMinutes/six selectView/sort/nextTransitionAt/queryTasks now | `tsc` 0；`test/priority.test.ts` 新用例绿；`selectView` 六 counts 与 F4.21 例子一致 |
| 2B（2A 后） | `src/host/rules/occurrence.ts`、`rules/resolveTick.ts`、`tickChanges.ts`、`repo.ts`、`index.ts`、`health.ts` | startAt optional 节点、endReminder、取消自动 done、health 00:05 清理、archive 6h 注释 | `resolve-tick/occurrence/review-fixes` 相关测试：默认 start 无 #start；过 endAt 仍 active；endReminder=false 只 #start；`health` 无 lastPriorityRefreshAt |
| 2C（2A 后） | `src/host/routes.ts`、`taskRoutes.ts`、`toolDefs.ts`、`delivery.ts` | snapshot 六 counts/byKind/totalDone/serverTime/nextTransitionAt；priority/rules；API/tool 去 dueDate；时区修复 | `routes.test/tools.test` 新契约；`/snapshot` 默认 inProgress；`/tasks/get` 无 dueDate；9 工具 schema 无 dueDate |

**批次 2 总体门槛**：host `tsc` 0；`test/priority`、`repo`、`routes`、`tools`、`review-fixes` 全绿；`rg dueDate src/host` 排除 migration 后 0；`health` 响应无 `lastPriorityRefreshAt`；`/priority/rules` 返回 `refreshMode:'on-read'`。

#### 批次 3：客户端与全量回归（3A/3B 并行，3C 随后）

| 子批 | 写域 | 内容 | 验收门槛 |
|---|---|---|---|
| 3A | `src/client/api.ts`、`panel.ts`、`task-list.ts`、`grouping.ts`、`task-row.ts`、`archive-view.ts`、`overlay.ts`、`ui.ts` | 六视图/四阶段 tab+两筛选；counts 六值；边界刷新；deadlineText；archive TaskRow | client `tsc` 0；手动打开面板四 tab 徽标=3/2/1/4，循环 3、暂停 1 |
| 3B | `src/client/task-editor.ts`、`editor-fields.ts`、`dictionary-zh.ts`、`dictionary-en.ts`、`examples.ts`、`styles.ts` | 删 dueDate；startAt 可空+endReminder；i18n；示例；样式 | 创建只填 endAt 成功、列表显示「创建即开始/无开始提醒」；会议 endReminder=false 只提醒开始；中英切换无残留 key |
| 3C | `test/priority.test.ts`、`repo.test.ts`、`routes.test.ts`、`tools.test.ts`、`review-fixes.test.ts` + 新增测试 | 全量测试重写/新增 | `node --test .test-build/test/*.test.js` 全绿；`tsc` 全 0 |

**批次 3 总体门槛（发布前）**：

1. `node scripts/build.mjs` 成功，`lib/` 无 `dueDate`（`rg dueDate lib` 为 0，迁移除外）；
2. `node scripts/verify-pack.mjs` 通过（不运行 pnpm）；
3. 手动 E2E：① 创建 once 只填 endAt → 未开始/进行中/超期按 `endAt` 走，且无 `#start`；② 创建 14:00–18:00 endReminder=false → 只 14:00 提醒；③ 18:00 后不自动 done，显示「已超期」，手动完成后 done；④ 四阶段页签计数 3/2/1/4 + 循环/暂停 3/1；⑤ 16:00 任务 15:59→16:00:01 自动刷新；⑥ 旧 v1 文件导入/启动迁移。

### 6.2 总工作量估算（乐观 / 保守，单位：人日）

| 模块 | 主要文件 | 乐观 | 保守 |
|---|---|---:|---:|
| M1 模型与校验 | `rules/types.ts`、`state.ts`、`repoTypes.ts`、`repoBuild.ts`、`validate.ts`、`validateTime.ts` | 1.2 | 1.8 |
| M2 迁移与归档 | `migrations.ts`、`store.ts`、`archive.ts`、`archiveRestore.ts`、`transfer.ts`、`transferRoutes.ts` | 1.0 | 1.5 |
| M3 派生与查询 | `rules/priority.ts`、`taskView.ts`、`repoQuery.ts`、`repo.ts`（list 部分） | 1.0 | 1.5 |
| M4 调度 | `rules/occurrence.ts`、`rules/resolveTick.ts`、`tickChanges.ts`、`index.ts`、`health.ts`、`repo.ts`（applyTick 部分） | 0.7 | 1.0 |
| M5 路由与工具 | `routes.ts`、`taskRoutes.ts`、`toolDefs.ts`、`delivery.ts`、`routeKit.ts`、`tools.ts`（不改） | 0.7 | 1.0 |
| M6 客户端数据层与面板 | `api.ts`、`panel.ts`、`task-list.ts`、`grouping.ts`、`task-row.ts`、`archive-view.ts`、`overlay.ts`、`ui.ts` | 1.2 | 1.8 |
| M7 客户端表单与文案 | `task-editor.ts`、`editor-fields.ts`、`dictionary-*.ts`、`examples.ts`、`styles.ts` | 0.9 | 1.4 |
| M8 测试与夹具 | `test/fixtures.ts` + 10 个受影响测试文件 + 4 个新增测试 | 1.5 | 2.3 |
| M9 构建/文档/验收 | `lib/` 重生成、README/需求自检、手动 E2E | 0.4 | 0.7 |
| **合计** | | **8.6** | **13.0** |

> 对照：需求 §11 追加估算 **+3–5 人日**（M0–M7 基线 20 人日，D-25 后 31–37 人日）。本表 8.6–13.0 是**单插件**从 v0.1.0 工作树到 v1.2 的增量估算，包含全部测试重写与归档迁移；若只算 host+核心 UI 的最小闭环（不含测试/归档），可压到约 5–6 人日，但不建议作为发布门槛。3 人并行（B1 串行 2d，B2 2–3d，B3 2–3d）约 **6–8 个工作日**。

---

## 7. 需要需求侧确认的问题

> 标记「阻塞」= 影响类型签名/验收口径，建议批次 1 前拍板；「不阻塞」= 可按推荐默认实现，后续评审可改。

| # | 问题 | 现状/证据 | 推荐默认 | 阻塞性 |
|---|---|---|---|---|
| Q1 | 循环任务 `derivePriority(task, now)` 需要 `nextAt`，而 `nextAt` 对 `workdays` 规则要应用中国节假日表；§7.5 的 `derivePriority` 没有 `holidays` 参数。是否允许扩为 `derivePriority(task, now, opts?: { holidays?: HolidayTable; nextAt?: Date \| null })`，或统一先在 `toTaskView` 算好 `nextAt` 再传入？ | `priority.ts:36-46` 现按日期；`occurrence.nextFireAt` 需要 `HolidayTable`（`occurrence.ts:255-274`）；`taskView.ts:64` 已把 holidays 传入 | **允许可选 `opts.holidays`**，且 `selectView`/`sortTasksForView` 也要带同一 holidays，保证徽标/排序一致 | **阻塞（签名）** |
| Q2 | §7.5 `ViewResult` 含 `totalDone`，但 `selectView(tasks, view, now)` 只看到主文件 tasks，拿不到归档文件。`totalDone` 到底由谁提供？ | `selectView` 定义 `priority.ts:128-170`；归档在主文件之外 `archive.ts:216-294`；`counts.done` 当前只主文件 `priority.ts:136` | **`selectView` 不返回 `totalDone`**；由 `Repository.list`/route 叠加 `archive/index.json` 的 count 之和，`ListResult` 提供 | **阻塞（类型/API）** |
| Q3 | F1.1 要求 TaskView 去掉 id/revision/只读派生后可 round-trip create；但 `once.startAtSource` 是业务字段还是只读字段？created 来源的任务 startAt=createdAt，若作为显式 startAt 回车 create 会变成 explicit（行为改变）。 | `TaskView` 继承 Task `taskView.ts:17`；`validateOnce` startAt 必填 `validateTime.ts:20-22`；round-trip 测试 `review-fixes.test.ts:165-192` | **create 时忽略传入的 `startAtSource`**：由「是否提供 startAt」决定来源；TaskView round-trip 测试把 `startAtSource` 排除在「业务字段」外，或以 `createdAt` 相等判定为 created | **阻塞（验收口径）** |
| Q4 | API/工具收到显式 `dueDate` 时：`invalid_argument` 拒绝，还是静默忽略？F4.11 说「不再接受」，但导入旧文件要求「丢弃 + warning」。 | `taskRoutes.ts:82` 取 dueDate；`toolDefs.ts:117/137`；`transfer.ts:104-112` coerce 静默 | **API/工具显式传 dueDate → `invalid_argument`（field='dueDate'）**；**导入/迁移 → 丢弃 + warning**。两处语义分开 | 不阻塞（可先按推荐） |
| Q5 | `notify.endReminder=false` 时，`fired` 如何派生？若 `fired = firedStart && firedEnd`，endReminder=false 的任务永远 `fired=false`（只有 start 节点）。是否应将 `firedEnd` 在创建时视为已 settled（与默认 startAt 对称）？ | `TaskView.fired` `taskView.ts:72-76`；F3.4 定义 `firedStart && firedEnd`；F3.3 endReminder=false 只 `#start` | **endReminder=false 创建时设 `firedEnd=true`**（无结束提醒视为结束节点已结算），`fired` 才可读；或新增 `fired` 口径说明（推荐前者） | 不阻塞（影响展示） |
| Q6 | 归档文件迁移：启动时**就地写回 v2**，还是只在读取时兼容、下次归档/恢复再写回？F6.8「都必须执行 1→2 迁移」是否要求磁盘文件立即变 v2？ | `archive.ts` 多处读写；`index.ts:192-207` startup rebuild；主文件 `store.ts` 迁移后也不一定立即写回 | **启动时惰性迁移并写回**（保留 `.bak`）更符合 F6.8；但若用户只读，允许读取兼容不写回（与主文件一致） | 不阻塞（可先惰性） |
| Q7 | `nextTransitionAt` 与 `health.nextWakeAt` 是否同一概念？前者包含 `startAt`/`endAt`（即使 `endReminder=false` 仍有 phase 边界），后者是实际提醒时刻（含 advance 偏移）。 | `occurrence.nextWakeAt` `:283-296`；`resolveTick.ts:168-181`；§7.5 新函数 | **两个独立字段**：`nextWakeAt` 用于调度；`nextTransitionAt` 用于 UI 刷新；两者都返回，不合并 | 不阻塞（可按推荐） |
| Q8 | 四阶段页签的默认页签？§7.8 `/snapshot` 默认 `inProgress`，F7.13 工具默认 `inProgress`，F8.11 未写面板默认。旧 localStorage 的 `todo` 值如何迁移？ | `panel.ts:45-48` 旧 `todo` 默认；`routes.ts:121` 旧默认 todo；`toolDefs.ts:85` 旧默认 todo | **面板首次默认 `inProgress`**；读取旧 localStorage `'todo'` 映射为 `'inProgress'`；之后按用户选择 | 不阻塞（建议拍板） |
| Q9 | `overdueDays` 展示粒度：D-25 用 `endAt` 精确时刻，超期 1 小时显示「超期 0 天」还是「超期 1 小时」？F4.14 只示例「超期 2 天」。 | `taskView.ts:34-35` 当前整日；`taskRow.ts:139` 显示 `overdueDays` | **<24h 显示小时/分钟，≥24h 显示天**；`overdueDays` 保留整日字段但 UI 用 `remainingMinutes` 换算 | 不阻塞（UI 文案） |
| Q10 | 复制任务时 `startAt` 语义：F3.8 说复制保留原 startAt（UI 提示「开始时间已复制」）；但若源任务 `startAtSource='created'`，复制后新任务应保持 created（复制创建时间语义）还是转 explicit？ | `panel.ts:197-202/308-317` 走 draft；`task-editor.ts:106-109`；F3.8 | **保留 source='created'**：复制后新任务 startAt=新任务 createdAt，不产生 #start；UI 提示「开始时间按创建时间复制」 | 不阻塞（建议拍板） |

---

## 8. 附：本次审计不修改的文件与后续动作

- 本文件只写到 `reviews/round2/02-implementation-gap.md`；未改 `src/`、`test/`、`README.md`、`需求-v1.md` 或 `lib/`。
- 后续实现批次完成后，建议用 `./node_modules/.bin/tsc --noEmit -p tsconfig.json && ./node_modules/.bin/tsc --noEmit -p tsconfig.client.json` 与 `node --test .test-build/test/*.test.js` 作为最小门槛；避免使用 `pnpm`（本环境会触发 `pnpm install` 失败）。
- 当前基线命令已由本审计执行：host/client/test 三个 tsc 均 0 错误；`lib/` 与 `.test-build/` 的现有产物不代表 v1.2 实现，仅用于类型基线。
