# D-25 测试基线审计（Round 2 / task-4）

> 审计对象：`dsh-todos-diy` v0.1.0 + 未提交的评审修复；需求基线：《需求-v1.md》v1.2（D-25 尚未实现）
> 审计日期：2026-10-30
> 审计范围：`test/` 全部 28 个文件（25 个 `*.test.ts` + 3 个 helper）、`src/host` 现行实现、`需求-v1.md` §9 AC-01～AC-43 与 §10
> 只读声明：本审计未修改任何源码/测试/文档；运行测试仅重建了被 gitignore 的 `.test-build/` 构建产物。

---

## 1. 基线数据（实际运行结果）

### 1.1 环境与命令

| 项 | 值 / 结果 |
|---|---|
| 工作目录 | `/Users/huningsong/Desktop/work/tmp/dsh-todos-diy` |
| Node | `v22.23.2`（满足 engines `>=22.19.0`） |
| TypeScript | `5.9.3`（`./node_modules/.bin/tsc`） |
| 类型检查（server） | `./node_modules/.bin/tsc --noEmit -p tsconfig.json` → **exit 0，零错误** |
| 类型检查（client） | `./node_modules/.bin/tsc --noEmit -p tsconfig.client.json` → **exit 0，零错误** |
| 测试命令 | `./node_modules/.bin/tsc -p tsconfig.test.json && node --test ".test-build/test/*.test.js"` → **exit 0** |
| 测试编译 | `tsc -p tsconfig.test.json` 成功，`.test-build/test/*.test.js` 共 28 个产物（25 test + 3 helper） |

### 1.2 测试基线数字

| 指标 | 数值 |
|---|---|
| 测试总数（node:test `# tests`） | **572** |
| 套件数（`# suites`） | **161** |
| 通过（`# pass`） | **572** |
| 失败 / 取消 / 跳过 / todo | **0 / 0 / 0 / 0** |
| 测试执行耗时（`# duration_ms`） | **754.048 ms** |
| 含 tsc 编译的整条命令墙钟 | **2.00 s**（`/usr/bin/time -p real 2.00`，user 5.59 s，sys 0.60 s） |

> 口径说明：`grep -cE "^\s*(it|test)\("` 只能数到 **535 个静态声明**；实际 572 个用例的差额来自参数化循环（priority 边界表 11 例、archive quarterOf 7 例、cron 拒绝方言等）。下文除特别注明「静态声明」外，用例数均为实际执行口径（按文件单独运行 `node --test` 汇总，合计 572）。

### 1.3 覆盖率基线（`node --experimental-test-coverage --test`，附加观测）

| 口径 | 行 % | 分支 % | 函数 % |
|---|---|---|---|
| 全仓报告（含测试文件自身） | 96.31 | 90.37 | 95.36 |
| `src/host` 按文件行数加权（近似值，剔除 test） | **≈91.6** | **≈80.6** | **≈86.1** |

重点模块（行 % / 分支 %）：

- `rules/cron.js` 100 / 95.04；`rules/occurrence.js` 100 / 85.56；`rules/timezone.js` 100 / 98.15；`rules/priority.js` 100 / 93.02；`rules/resolveTick.js` 96.28 / 89.61；`rules/holidays.js` 100 / 85.29。
- 低覆盖模块：`transferRoutes.js` 42.42 / —（导出、导入、设置导出 3 条路由无测试）、`routes.js` 76.04 / 82.00、`config.js` 78.89 / 60.00、`index.js` 79.45 / 50.00、`routeKit.js` 81.02 / 61.90、`health.js` 88.00 / 71.43、`store.js` 88.53 / 77.05、`state.js` 89.20 / 75.35。
- 对 §10.1「纯函数 100% 分支」：cron 95.04%、occurrence 85.56%、resolveTick 89.61%、timezone 98.15% —— **当前基线下该门槛不成立**。

### 1.4 `pnpm verify` 不可用的环境原因（未执行 pnpm）

按任务约束未运行任何 pnpm 命令；失败原因由现场元数据确认：

1. `pnpm-workspace.yaml` 中 `allowBuilds: { esbuild: "set this to true or false" }` 是**未填写的占位字符串**（不是 boolean），pnpm 读取配置时会判定构建脚本未获批准。
2. `node_modules/.modules.yaml` 明确记录 `"ignoredBuilds": ["esbuild@0.28.2"]`、`"pendingBuilds": []`、`"allowBuilds": {"esbuild": "set this to true or false"}`，即当前依赖树是**跳过 esbuild 构建脚本**安装的。
3. 因此 `pnpm verify` 会先触发 pnpm 的依赖/构建脚本校验并要求交互式 `pnpm approve-builds`；本会话审批不可用、非交互执行会直接失败，`typecheck/test/verify-pack` 根本不会开始。

**结论**：本轮及后续 D-25 验证统一使用 §1.1 的 `tsc` + `node --test` 直调命令；打包门可单独运行 `node scripts/verify-pack.mjs`（本次实测 **verify-pack: OK**，未依赖 pnpm）。

---

## 2. `test/` 全部 28 个文件映射

### 2.1 文件 → 模块 / F 需求映射表

| # | 测试文件 | 行数 | 执行用例 | 主要被测模块 | 覆盖的 F 需求 / AC | 旧模型耦合 |
|---|---|---:|---:|---|---|---|
| 1 | `test/apply.test.ts` | 131 | 5 | `src/host/index.ts`（apply/inject）、routes/tools 注册 | F6.1、F6.6、F7.9、§7.8 路由表 | 无 |
| 2 | `test/archive.test.ts` | 271 | 26 | `src/host/archive.ts` | F4.16–F4.19、AC-38、AC-39 | `makeTask({dueDate})` 1 处（L176） |
| 3 | `test/cron.test.ts` | 206 | 44 | `src/host/rules/cron.ts` | F2.1–F2.4、F2.8 | 无 |
| 4 | `test/delivery.test.ts` | 257 | 25 | `src/host/delivery.ts` | F5.1–F5.5、F3.7、D-02、UX-10 | 无（依赖 Task 工厂） |
| 5 | `test/dnd.test.ts` | 125 | 18 | `src/host/dnd.ts` | F5.6、F9.2、UX-05 | 无 |
| 6 | `test/fixes4.test.ts` | 298 | 18 | repo/store/archiveRestore/resolveTick 的 4 个历史缺陷回归 | F4.5/AC-12、F1.2、F4.18/AC-39、F9.1、D-22 | 无 |
| 7 | `test/holidays.test.ts` | 117 | 13 | `src/host/rules/holidays.ts` + `assets/holidays-cn-2024-2027.json` | F2.1、F2.5 | 无 |
| 8 | `test/http.test.ts` | 218 | 26 | `src/host/http.ts`（准入、信封、body reader） | §4.4、NF7、AC-26 | 无 |
| 9 | `test/occurrence.test.ts` | 293 | 36 | `src/host/rules/occurrence.ts` | F1.4、F2.1–F2.7、F3.3–F3.4、F5.7 | 无（once 用显式 startAt） |
| 10 | `test/priority.test.ts` | 237 | 37 | `src/host/rules/priority.ts` | F4.10–F4.14、D-20/D-21/D-22、AC-29、AC-36 | **高：全文件基于 `dueDate`＋三视图＋`daysLeft`** |
| 11 | `test/regression.test.ts` | 139 | 11 | resolveTick + occurrence + holidays | F2.1、F5.7、F6.4（DEFECT-1/2/3） | 无 |
| 12 | `test/repo.test.ts` | 496 | 40 | `src/host/repo.ts` | F1.1–F1.6、F3.1–F3.6、F4.1–F4.5、F4.15、F6.9 | **中：`recurringInput`/`onceInput` 均带 `dueDate`（L41/L52），32 个用例受影响** |
| 13 | `test/resolve-tick.test.ts` | 200 | 23 | `src/host/rules/resolveTick.ts` | F3.5、F5.7、F6.4、AC-08/AC-09/AC-19 | 无 |
| 14 | `test/retention.test.ts` | 98 | 10 | `src/host/retention.ts` | F1.5、F4.16（30 天清理） | 无 |
| 15 | `test/review-fixes.test.ts` | 468 | 20 | 跨模块：store/repo/archive/taskView/tickChanges | 评审 BLOCKER A/B + MAJOR/MINOR 修复回归；F6.8/F4.19/F3.6/F1.1/F2.6/F1.2/F4.10/F9.1–F9.3/F6.7/F6.4/F5.7/F5.6 | **中：4 个「自动 done」用例锁旧模型 + `dueDate` 2 处 + `counts.todo`** |
| 16 | `test/routes.test.ts` | 485 | 35 | `src/host/routes.ts` | AC-22、AC-26、§7.8、F4.1、F6.1、F9 | **中：`dueDate` 2 处、三视图 counts、`refreshAt:"00:05"`** |
| 17 | `test/routesArchive.test.ts` | 139 | 3 | `src/host/archive.ts` 路由 | F4.17、F4.19 | 无 |
| 18 | `test/search.test.ts` | 88 | 12 | `src/host/rules/search.ts` | 月跳搜索原语（服务于 F2.3/F2.9） | 无 |
| 19 | `test/state.test.ts` | 242 | 26 | `src/host/state.ts` + `src/host/migrations.ts` | F6.2、F6.7、F6.8、F9.5、F1.1 | **高：`dueDate` 2 处 + 迁移链「v1 且无迁移」4 条断言** |
| 20 | `test/store.test.ts` | 233 | 15 | `src/host/store.ts` | F6.5、F6.7、F6.8、F6.9、AC-18 | `dueDate` 1 处（reload fidelity） |
| 21 | `test/tick-integration.test.ts` | 185 | 7 | repo + resolveTick 集成（模拟 index tick） | F6.4、F6.5、F3.3–F3.4、AC-09 | 无显式 dueDate；缺「不自动 done」断言 |
| 22 | `test/timezone.test.ts` | 135 | 14 | `src/host/rules/timezone.ts` | F2.6、F2.7 | 无 |
| 23 | `test/tools.test.ts` | 342 | 31 | `src/host/tools.ts` | F7.1–F7.13、AC-22 | `dueDate` 2 处 + `counts.todo` 1 处 |
| 24 | `test/transfer.test.ts` | 144 | 13 | `src/host/transfer.ts` | F9.4、F9.6、AC-25 | `schemaVersion:1` 断言 1 处（L33） |
| 25 | `test/validate.test.ts` | 378 | 64 | `src/host/validate.ts` + `validateTime.ts` | F1.1、F2.1–F2.5、F3.1–F3.3、F5.4、F9.3、F7.11 | **高：`validateDueDate` 整个 describe 5 例** |
| 26 | `test/fakeHttp.ts` | 86 | — | helper：fake `IncomingMessage`/`ServerResponse` | 路由测试基础设施 | 无 |
| 27 | `test/fixtures.ts` | 93 | — | helper：`makeTask`/`makeOnceTask`/`makeRule`/`makeNotify` | 全测试共用 Task 工厂 | **高：工厂强制写 `dueDate: null`（L31），D-25 后必须改，否则 test 编译失败** |
| 28 | `test/memoryFs.ts` | 93 | — | helper：内存文件系统双（rename/失败注入） | 存储/归档/仓库测试基础设施 | 无 |

### 2.2 旧模型耦合 grep 统计（静态 `it/test` 块内命中）

| 关键词 | 原始命中（出现次数 / 文件数） | 命中测试用例（执行口径） | 文件清单 |
|---|---:|---|---|
| `dueDate` | 70 次 / 10 个文件（含 fixtures） | **38 个**（静态声明 28；priority 参数化展开为 24 个执行用例） | `priority.test.ts`(24)、`validate.test.ts`(3)、`routes.test.ts`(2)、`state.test.ts`(2)、`tools.test.ts`(2)、`review-fixes.test.ts`(2)、`archive.test.ts`(1)、`repo.test.ts`(1)、`store.test.ts`(1)；helper `fixtures.ts` |
| `todo`/`done`/`overdue` 三视图（宽口径字符串） | `todo` 9 次、`done` 26 次、`overdue` 3 次 | **25 个** / 7 个文件 | `priority.test.ts`(11)、`review-fixes.test.ts`(6)、`fixes4.test.ts`(3)、`repo.test.ts`(2)、`resolve-tick.test.ts`(1)、`routes.test.ts`(1)、`tools.test.ts`(1) |
| 严格旧三视图 API（`selectView(...,'todo'\|'done'\|'overdue')` 等） | — | **12 个**（priority 10 + routes `?view=done` 1 + tools `view:'done'` 1），另有 3 处 `counts.todo` 断言 | `priority.test.ts`、`routes.test.ts`、`tools.test.ts`；`repo.test.ts`、`review-fixes.test.ts` |
| `00:05` | 16 次 / 6 个文件 | 11 个块命中；**只有 1 个是「每日 00:05 刷新」语义**（`routes.test.ts:210-217` 的 `refreshAt:"00:05"`）；其余为 `...T01:00:05.000Z` 时间戳与 advance 跨零点用例（`occurrence.test.ts:266`） | `routes.test.ts`(1，语义命中)、`delivery.test.ts`、`fixes4.test.ts`、`repo.test.ts`、`review-fixes.test.ts`、`occurrence.test.ts` |
| `priority.daysLeft` | 8 次 / 1 个文件 | **15 个**（5 个静态声明，priority 边界表 11 例展开） | `priority.test.ts` |
| `selectView(..., today)` | — | **10 个**，全部集中在 `priority.test.ts` 的 `selectView — counts` 与 paused 语义两个 describe | `priority.test.ts` |

> 备注：三视图宽口径的 25 个命中里，`fixes4`/`resolve-tick`/`review-fixes` 的部分命中是「done 状态/已完成」字样而非视图 API；真正的旧三视图断言集中在 `priority.test.ts`、`routes.test.ts`、`tools.test.ts`、`repo.test.ts`、`review-fixes.test.ts`。D-25 重写时优先处理这些文件，其余按字符串清理。

---

## 3. 验收覆盖矩阵（AC-01～AC-43）与 §10 测试策略审计

> 状态定义：**覆盖** = 现有自动化测试覆盖该 AC 的主路径（多为 host/单测层）；**部分** = 有相近测试但缺关键分支/只覆盖旧模型/无 UI 或 e2e；**缺失** = 无对应测试或现有断言方向相反。

### 3.1 AC 覆盖矩阵

| AC | 需求 | 现有测试映射（文件::用例） | 状态 | D-25 后处理 / 建议用例（文件::用例名） |
|---|---|---|---|---|
| AC-01 | F2.1 工作日+节假日 | `holidays.test.ts::treats 2026-10-01 (Thursday, holiday) as a non-workday`、`::treats 2026-10-10 (Saturday, make-up workday) as a workday`；`occurrence.test.ts::skips National Day 2026-10-01...`、`::fires on the 2026-10-10 make-up Saturday`；`regression.test.ts::does not fire a workdays task on 2026-10-01` | 覆盖 | 保持；E2E 补 AC-01 浮层验证 |
| AC-02 | F2.2 每周规则 | `occurrence.test.ts::fires only on Monday for the documented example`、`::fires on both Monday and Wednesday...` | 覆盖 | 保持 |
| AC-03 | F2.3 每月顺延 | `occurrence.test.ts::moves 30 February to 28 February under lastDay`、`::moves 31 February...`、`::moves 31 April...`、`::skips February entirely under skip`、`::handles the 29th in a leap year` | 覆盖 | 保持 |
| AC-04 | F2.5 例外日 | `occurrence.test.ts::honours skipDates`、`::lets extraWorkdays override...`、`::lets skipDates beat extraWorkdays...`、`::fires extraWorkdays on a weekend...` | 覆盖 | 保持 |
| AC-05 | F2.6 时区 | `timezone.test.ts` 偏移/DST 算术；`occurrence.test.ts` America/New_York DST 用例 | 部分：无「同一 cron 两个时区任务各自本地 09:00」用例 | `timezone.test.ts::same cron in Asia/Shanghai and Europe/London fires at different UTC instants` |
| AC-06 | F3.1/F3.2 单次创建（D-25） | `repo.test.ts::creates a one-off task with both nodes stored in UTC`；`validate.test.ts::accepts a window with explicit offsets` 等；`tools.test.ts::creates a one-off task with both nodes` | 部分：缺 `startAt` 省略/默认 createdAt | `once-window.test.ts::省略 startAt → createdAt、startAtSource="created"`、`::只填 endAt 保存成功`、`::缺 endAt → invalid_argument` |
| AC-07 | F3.3/F3.4/F3.6 双节点+不自动完成 | `resolve-tick.test.ts::fires the start node only...`、`::fires both nodes...`；`tick-integration.test.ts::fires the start node, then the end node...` | 部分：18:00 后 status/phase 未断言；`review-fixes.test.ts` 反向断言 done | `tick-integration.test.ts::both nodes fired 后 status=active、phase=overdue、doneAt=null`；`once-window.test.ts::手动 complete 才 done` |
| AC-08 | F3.5 宽限 | `resolve-tick.test.ts::withinGrace`（5 例）、`::fires once inside the grace window (09:03)`、`::marks missed ... (09:06)` | 覆盖 | 保持 |
| AC-09 | F1.4 去重 | `resolve-tick.test.ts::re-fires nothing on a second tick`、`::suppresses a re-fire after the clock is rolled back`；`tick-integration.test.ts::does not fire twice...` | 覆盖 | 保持 |
| AC-10 | F4.2 暂停恢复 | `repo.test.ts::pauses and resumes, and both are idempotent`；`resolve-tick.test.ts::skips paused tasks entirely` | 部分：无「暂停 3 个周期再恢复、无补发」 | `repo.test.ts::pause 3 个周期后 resume 只在下一个未来时刻触发` |
| AC-11 | F4.4 完成本次（循环） | `repo.test.ts::keeps a recurring task active and advances past the current occurrence`、`::rejects complete ... no occurrence` | 部分：无「今天不再提醒、次日正常」tick 断言 | `tick-integration.test.ts::complete 后当日不再触发、次日 09:00 正常` |
| AC-12 | F4.5 snooze | `fixes4.test.ts` 的 5 个 snooze 用例（`re-fires...`、`does not fire before...`、`fires only once...`、`does not fire stale...`、`leaves the normal rule untouched`） | 覆盖 | 保持 |
| AC-13 | F5.1 浮层 | `delivery.test.ts::buildReminderCard`、`pendingDeliveries` 系列 | 部分：无 shell.overlay 客户端渲染、无「不产生 Agent 会话」断言 | `delivery.test.ts::channels=["overlay"] 时只生成 overlay 卡片`；E2E-浮层 |
| AC-14 | F5.2 通道降级 | `delivery.test.ts::reportSystemDelivery` 系列（marks shown/recovers permission/…） | 部分：无前台/后台可见性切换 e2e | `delivery.test.ts::visibility=hidden + granted 才尝试 system`；E2E |
| AC-15 | F5.3 权限拒绝 | `delivery.test.ts::recovers a permission-denied failure`、`::defaults the failure reason` | 部分：未断言 `health.capabilities.systemNotification=false` | `routes.test.ts::health capabilities.systemNotification=false after denied` |
| AC-16 | F5.5 投递幂等/回执 | `delivery.test.ts::deliveryRecordsFor`、`acknowledge` 全组；resolve-tick 去重 | 覆盖 | 保持 |
| AC-17 | F6.1 启动调度 | `apply.test.ts::starts the scheduler at the configured interval`、`::registers the route table...`；`routes.test.ts::GET /health returns documented envelope` | 部分：无冷启动 60 秒 / lastTickAt 更新 e2e | `apply.test.ts::apply() 立即执行一次 tick`；E2E-冷启动 |
| AC-18 | F6.3 重启恢复 | `store.test.ts::keeps every persisted field across a reload`；`state.test.ts::round-trips a full task...` | 覆盖（单测） | 重写字段集：去 dueDate、加 startAtSource/endReminder/phase 派生不落盘 |
| AC-19 | F6.4 停机不回填 | `resolve-tick.test.ts::never backfills after three days of downtime`、`::caps the missed backlog`；`regression.test.ts::records exactly three missed days...` | 覆盖 | 保持 |
| AC-20 | F6.5 原子写 | `store.test.ts::writes via a tmp file and renames`、`::leaves the old file intact when the write fails (ENOSPC)`、`::survives a rename failure` | 部分：无 kill -9 注入 | `store.test.ts::模拟写入中断 10 次后 JSON 全部可解析` |
| AC-21 | F6.6 资源清理 | `apply.test.ts::disposes every registration without throwing` | 部分：无 health 不可达 / activeHandles 断言 | `apply.test.ts::dispose 后无残留 interval（process._getActiveHandles）` |
| AC-22 | F7.1–F7.8 工具 | `tools.test.ts` 31 例（registry surface + 9 工具成功/失败路径 + caller gate） | 覆盖（host 层） | 增加 view 六值、默认 inProgress、拒绝 dueDate |
| AC-23 | F8.1–F8.4 UI 三态 | 无 | **缺失**（无 client 测试） | 需 jsdom/react 依赖后新增 `client-panel.test.tsx`；本轮先 E2E-手工 |
| AC-24 | F8.6 i18n | 无 | **缺失** | `client-i18n.test.tsx::切换 en 后全部文案英文`；或 E2E |
| AC-25 | F9.4 导入导出 | `transfer.test.ts::buildExport`、`parseImport`、`mergeTasks`、`backupBeforeImport`；**`transferRoutes` 3 条路由无测试** | 部分：import/export 路由未测、无 replace 全流程 | `routes.test.ts::POST /export → POST /import（replace）任务数与字段一致`、`::导入前生成备份` |
| AC-26 | NF7 跨站 403 | `http.test.ts` gate 组 + `routes.test.ts::admission` 组 | 覆盖 | 保持 |
| AC-27 | NF3 准点 | `resolve-tick.test.ts::fires an on-time occurrence...`、`withinGrace` | 覆盖 | 保持 |
| AC-28 | D-02 无 Agent 会话 | `delivery.test.ts` 通道用例；类型中无 `sessionId` | 部分：无显式「无 session 通道 / 无 sessionId 字段」断言 | `delivery.test.ts::never emits a session channel`；`state.test.ts::coerceTask 丢弃 sessionId` |
| AC-29 | F4.10 四页签 | `priority.test.ts::selectView — counts`（旧三视图）；无 UI | 部分：旧模型三视图，非 D-25 四页签 | 重写 `view-counts.test.ts::四页签 3/2/1/4 互斥`、`::循环 3/暂停 1 独立筛选` |
| AC-30 | F4.10 完成迁移 | `repo.test.ts::completes a one-off task and clears its pin` | 部分：无阶段计数变化断言 | `view-counts.test.ts::完成 overdue 任务后 counts: overdue-1/done+1` |
| AC-31 | F4.12 优先级时间轴 | `priority.test.ts::derivePriority — boundary table`（旧 `dueDate` 天级） | 部分：旧模型，需按 endAt 精确时长重写 | `priority.test.ts::24h/72h/168h 边界`、`::overdue→high(remainingMinutes<0)` |
| AC-32 | F4.13 读时刷新 | `health.ts` 有 `lastPriorityRefreshAt` 旧逻辑；无测试 | **缺失**；且旧 `refreshAt:"00:05"` 断言需删除 | `health.test.ts::health 无 lastPriorityRefreshAt`；`snapshot.test.ts::serverTime/nextTransitionAt`；E2E-15:59:59→16:00:01 |
| AC-33 | F4.14 置顶排序 | `priority.test.ts::sortTasksForView` 部分用例；无 UI | 部分：旧 dueDate 排序，无置顶组 UI | 重写 `priority.test.ts::pinned → priority → endAt/nextAt → title`；E2E-置顶组 |
| AC-34 | F4.15 完成清置顶 | `repo.test.ts::completes a one-off task and clears its pin` | 覆盖（host） | 保持，补 `pinned=false` 原子性断言 |
| AC-35 | F4.11/F3.1 默认开始 | 无 | **缺失**（D-25 新增） | `once-window.test.ts::不填 startAt → startAt=createdAt、startAtSource="created"、无 dueDate` |
| AC-36 | F4.12/D-22 paused | `priority.test.ts::paused semantics in the views (AC-36)`（3 例，旧模型） | 部分：旧 dueDate，无「已暂停独立筛选」 | 重写 `view-counts.test.ts::paused 只出现在已暂停筛选、priority.key="paused"` |
| AC-37 | F4.14/D-21 超期置顶 | `priority.test.ts::keeps an overdue pinned task at the top with high priority`（旧 dueDate） | 部分：无「超期 2 天」红标/UI | 重写 `priority.test.ts::pinned overdue 仍最前 + overdueDays=2`；E2E |
| AC-38 | F4.16 季度归档 | `archive.test.ts::moves a previous quarter... (AC-38)`、`::groups three quarters...` | 覆盖 | 保持；补 `totalDone` 含归档 |
| AC-39 | F4.18/F4.19 恢复/崩溃 | `archive.test.ts::keeps the total count stable... (AC-39)`、`reconcileArchive`；`fixes4.test.ts::finds an archived task by id` 等 | 覆盖 | 保持；补恢复后 `phase="overdue"` |
| AC-40 | F4.21 统计 | 无（仅旧 `counts.todo/done/overdue`） | **缺失** | `snapshot.test.ts::counts={notStarted:3,inProgress:2,overdue:1,done:4,paused:1,recurring:3}`、`::byKind={once:11,recurring:3}`、`::totalDone=4` |
| AC-41 | F4.11/F6.8 迁移 | `state.test.ts::ships with a v1 schema and no migrations yet`（反向） | **缺失**（D-25 需 1→2） | `migrations.test.ts::v1 主文件 dueDate 丢弃 + warning`、`::归档 quarter 文件 v1→v2` |
| AC-42 | F3.6/F1.2 不自动 done | `review-fixes.test.ts` 4 个用例断言「自动 done」——方向相反 | **缺失/反向** | 重写 `review-fixes.test.ts::endAt 后仍 active/overdue，手动 complete 才 done`、`tick-integration.test.ts` 同款 |
| AC-43 | F3.3/endReminder | 无 | **缺失**（D-25 新增） | `once-window.test.ts::endReminder=false 只产生 #start`、`::false 且无 startAt → invalid_argument`、E2E-会议任务 |

**统计：覆盖 16 / 部分 19 / 缺失 8（共 43）。**

### 3.2 §10 测试策略符合度

| §10 要求 | 现状 | 结论 |
|---|---|---|
| 10.1 单元测试 rules/* ≥90% 行、纯函数 100% 分支 | rules 行覆盖 96–100%；分支：cron 95.04、occurrence 85.56、resolveTick 89.61、timezone 98.15 | **未达标**（纯函数分支未 100%） |
| 10.1 属性测试（10 万组随机 cron×时区×after vs Temporal/Luxon oracle） | 无任何属性测试；package 无 Temporal/Luxon 依赖 | **缺失** |
| 10.1 存储测试（损坏/只读/ENOSPC/迁移） | store 15 + state 26 + repo 40；ENOSPC/只读/损坏已覆盖；迁移只测「空链」 | **部分**（v1→v2 迁移缺） |
| 10.1 路由测试（200/400/401/403/404/405/409/413/500） | 400/401/403/404/405/409/413 有；500 无；export/import 路由无 | **部分** |
| 10.1 工具测试（9 工具成功/失败） | tools.test.ts 31 例，覆盖 9 工具 | **覆盖** |
| 10.1 客户端测试（jsdom、三 slot、三态、i18n） | 无 client 测试；`node_modules` 无 react/jsdom 运行时，`tsconfig.test.json` 也不包含 `src/client` | **缺失** |
| 10.1 端到端测试（真实 DSH 安装/重启/触发/暂停/卸载） | 无 e2e 脚本，本轮未执行真实 DSH 手工 E2E | **缺失** |
| 10.2 关键用例矩阵 | 28 行中：覆盖 18、部分 4、缺失 6（缺失项：客户端空态/列表、5 条折叠、i18n、阶段边界刷新、默认 startAt、取消自动 done） | **部分达标** |
| 10.3 环境（Node 22.19/22.23/24.21、TZ=UTC、注入 clock、属性 oracle、jsdom） | 实测 Node 22.23.2；测试均注入 `now`，未 mock 全局 Date；未设 `TZ=UTC`；无属性 oracle；无 jsdom | **部分** |
| 10.4 准入门槛（单测全过、覆盖率≥90%、tsc 0、路由错误码、客户端三 slot、手动 E2E、打包） | 单测 572 全过；tsc 0；verify-pack OK；覆盖率纯函数分支未达标；客户端/手动 E2E 未执行 | **部分**（详见 §6） |

---

## 4. D-25 破坏性断言清单（会 fail / 必须重写的既有测试）

> 统计口径：**63 个执行用例会因语义变更确定失败或必须重写**（= priority 37 + validate 5 + state 6 + review-fixes 6 + routes 3 + tools 2 + repo 1 + store 1 + transfer 1 + archive 1）。另 `repo.test.ts` 有 **32 个用例**通过带 `dueDate` 的 `recurringInput`/`onceInput` 创建任务；若 D-25 的 create 严格拒绝未知 `dueDate` 字段，则这 32 个也会 setup 失败 → **最坏 95 个**。

### 4.1 编译级阻断（不先改则 `tsc -p tsconfig.test.json` 失败）

| ID | 位置 | 现有代码/断言 | D-25 要求 | 处理 |
|---|---|---|---|---|
| B-00 | `test/fixtures.ts:31` | `dueDate: overrides.dueDate ?? null` 写入 `Task` | `Task` 删除 `dueDate` | 删除字段；新增 `startAtSource`、`notify.endReminder` 默认值；`makeOnceTask` 支持省略 startAt |
| B-01 | `test/priority.test.ts:9-16` | 从 `rules/priority.ts` 导入 `derivePriority/priorityOf/isOverdue/daysOverdue/selectView/groupTodoTasks` | 新签名 `derivePriority(task, now)`、`phaseOf(task, now)`、`selectView(tasks, view, now)`，`daysLeft`→`remainingMinutes`，`groupTodoTasks` 移除/改造 | 整个文件重写（见 §5 Batch 1） |
| B-02 | `test/validate.test.ts:12-21, 76-100` | 导入并测试 `validateDueDate`（5 例） | `dueDate` 从校验层删除；新增 `startAt` 可选、`endAt` 必填/日期-only 校验 | 删除 `validateDueDate` describe；改测 `validateOnce` |
| B-03 | `test/repo.test.ts:41-58` | `recurringInput`/`onceInput` 都带 `dueDate` | API 不接受 `dueDate` | 从 helper 删除；32 个用例连带受益 |

### 4.2 语义断言（即使编译通过也会 fail）

| ID | 文件:行 | 现有断言（旧模型） | D-25 新语义 | 处理建议 |
|---|---|---|---|---|
| D-01 | `test/priority.test.ts:22-57` | `derivePriority(dueDate, today)` 天级；`daysLeft` 为 0/1/3/4/7/8 | `derivePriority(task, now)`：`remainingMinutes`，≤24h 高、24h–72h 中、72h–168h 低、>168h 无 | 重写边界为 24h/72h/168h ± 1ms |
| D-02 | `test/priority.test.ts:59-88` | `priorityOf`/`isOverdue`/`daysOverdue` 基于 `dueDate` 本地日期 | 基于 `endAt` 精确时刻；`phase="overdue"`；`remainingMinutes` 负数 | 重写为 phase/priority 用例 |
| D-03 | `test/priority.test.ts:91-134` | 排序键 `pinned → priority → dueDate` | `pinned → priority → endAt（循环 nextAt）→ title` | 重写排序用例 |
| D-04 | `test/priority.test.ts:136-204` | `counts:{todo,done,overdue}`、三视图 partition | `counts:{notStarted,inProgress,overdue,done,paused,recurring}` + `byKind` + `totalDone`，四页签互斥 | 移入 `view-counts.test.ts` |
| D-05 | `test/priority.test.ts:206-240` | paused 在 todo 列表、不计 todo 徽标 | paused 独立筛选、不进任何阶段页签、`priority.key="paused"` | 重写 |
| D-06 | `test/validate.test.ts:76-100` | `validateDueDate('2026-11-03')` 等 5 例 | 无 `dueDate`；日期-only `endAt=23:59:59.999` | 删除；新增 `once-window.test.ts` 用例 |
| D-07 | `test/state.test.ts:40-48` | `makeTask({dueDate:'2026-11-03'})` 全字段 round-trip | Task 无 dueDate | 移除字段 |
| D-08 | `test/state.test.ts:123-125` | `coerceTask({dueDate:'2026-02-30'})?.dueDate===null` | 无 dueDate；未知字段丢弃/ warning | 删除，改测 schema 迁移 warning |
| D-09 | `test/state.test.ts:167-170` | `SCHEMA_VERSION===1`、`MIGRATIONS.length===0` | `SCHEMA_VERSION===2`、至少 1 条 `from:1` 迁移 | 改为 v2 + 迁移存在 |
| D-10 | `test/state.test.ts:172-177` | `migrateState({schemaVersion:1})` 返回 `applied:[]` | v1 必须执行 `v1→v2` | 改为断言 `applied:['v1→v2']` |
| D-11 | `test/state.test.ts:178-183` | `migrateState({schemaVersion:2})` 报「newer」 | v2 是当前版本，2 不再 newer | 用 `schemaVersion:3` 测 newer |
| D-12 | `test/state.test.ts:236-240` | `isKnownVersion(2)===false` | v2 合法 | 改为 `true` |
| D-13 | `test/review-fixes.test.ts:143-163` | **`after?.status === 'done'`**（双节点 fired 后自动完成） | `status` 保持 `active`、`phase="overdue"`、`doneAt=null`；显式 complete 才 done | 重写 describe 名称与断言 |
| D-14 | `test/review-fixes.test.ts:273-308` | 两条 advance 投递后 `status==='done'` | 仍 active（phase 按 endAt 判定） | 改写为 active/overdue；仅断言投递 2 次 |
| D-15 | `test/review-fixes.test.ts:369-397` | 双节点 missed 后 `status==='done'` | 仍 active + overdue；missedCount=2 | 改写 |
| D-16 | `test/review-fixes.test.ts:412-445` | missed 后 `status==='done'` | 同上 | 改写 |
| D-17 | `test/review-fixes.test.ts:165-191` | `dueDate: view.dueDate` round-trip | TaskView 无 dueDate | 删除字段；补 `phase`/`startAtSource` |
| D-18 | `test/review-fixes.test.ts:225-236` | `counts.todo===2` | `counts.inProgress`/固定六键 | 改写 |
| D-19 | `test/routes.test.ts:183-193` | `payload.value.counts.todo===1` | 六键 counts + byKind/totalDone | 改写 |
| D-20 | `test/routes.test.ts:210-217` | `/priority/rules` = `{thresholds:{highMaxDays:0,midMaxDays:3,lowMaxDays:7},refreshAt:'00:05'}` | `{thresholds:{highMaxHours:24,midMaxDays:3,lowMaxDays:7},refreshMode:"on-read"}`（无 refreshAt） | 重写 |
| D-21 | `test/routes.test.ts:220-234` | create body 带 `dueDate:'2026-10-30'` | create 拒绝/忽略 dueDate；不返回该字段 | 删除 dueDate，断言 TaskView 无该键 |
| D-22 | `test/tools.test.ts:146-159` | `todo_reminder_create` 带 dueDate，断言 `priority.key='high'` | 不接受 dueDate；priority 按 endAt/nextAt | 删除 dueDate；改按新 priority 口径 |
| D-23 | `test/tools.test.ts:194-207` | `counts.todo===1` | 六键 counts | 改写 |
| D-24 | `test/repo.test.ts:157-165` | `counts.todo===3` + `prioritySummary` | counts 六键；循环优先级按 nextAt | 改写；若 create 严格拒绝 dueDate 则连 helper 一起改（32 例） |
| D-25 | `test/store.test.ts:175-211` | reload 断言含 `dueDate:'2026-11-03'` | 无 dueDate；新增字段 `startAtSource`/`endReminder` 持久化 | 改写 fixture |
| D-26 | `test/transfer.test.ts:28-34` | `bundle.schemaVersion===1` | 导出 schemaVersion 2 | 改为 2；补 v1 导入迁移用例 |
| D-27 | `test/archive.test.ts:173-179` | `makeTask({status:'active',dueDate:'2020-01-01'})` | Task 无 dueDate | 删除；补归档文件 v1→v2 迁移 |
| D-28 | `test/state.test.ts:184-189` | 「missing chain」测试传空链 | 仍可保留（显式空链），但需确认默认链已非空 | 保留并补「默认链成功」用例 |

> 附：`test/tick-integration.test.ts:134-150` 现在只断言 `firedStart/firedEnd`，不检查 `status`，D-25 后**不会 fail 但会漏测**「不自动 done」——必须补断言（见 §5）。

### 4.3 反向/过时断言（最高风险）

`test/review-fixes.test.ts` 的 4 个「自动 done」用例是 D-25 最危险的旧模型锁：它们把「单次任务两节点 settled 后自动 `done`」当成正确行为（还写在 `MAJOR: a finished one-off task becomes done (F3.6)` 标题里）。D-25 明确把 F3.6 翻转为「endAt 不自动完成」，若实现者先跑旧测试，会误以为需要保留自动 done；若实现 D-25 后再跑，这 4 个用例必 fail。**必须在实现前标记 skip/重写，不能作为回归基线。**

### 4.4 `test/review-fixes.test.ts` 与现有回归测试质量评估

**整体**：`review-fixes.test.ts` 共 468 行 / 20 用例 / 17 套件（未提交新增文件），以「每个 describe 标注缺陷级别」的方式组织，使用 `memoryFs` + 注入 `now`，并用生产映射 `planToChanges` 而非手写 change list（这是它能抓住 `node` 字段丢失缺陷的关键优点）。BLOCKER A/B 均有专门用例。

| 评审发现 | 现有覆盖 | 质量判断 | 缺口 |
|---|---|---|---|
| BLOCKER A：新版本 schema 文件绝不能被覆盖 | `review-fixes.test.ts:45-63` `refuses every write after loading an unsupported version`；`store.test.ts:154-172` `refuses to load a newer schema and never rewrites the file` | **基本覆盖**：断言 `stateName='unsupported-version'`、`readOnly=true`、`repo.create` 抛 `storage_read_only`、flush 后文件字节不变 | 只测 `repo.create` 一条写路径；未测 `settings/update`、`tasks/update`、`transfer import replace`、`archive/run` 在 readOnly 下的拒绝；未测路由层错误码/返回信封；`MAJOR: a read-only store must not start the scheduler` 与其重复而非扩展 |
| BLOCKER B：损坏的季度归档文件不得删除其中任务 | `review-fixes.test.ts:65-87` `keeps the task in the main file and reports the quarter as skipped`；`archive.test.ts::skips a corrupt quarter file instead of aborting` | **覆盖主场景**：断言 `skipped=['2026-Q4']`、主文件任务保留、损坏文件不被重写 | 只测「既有 quarter 文件损坏」；未测「归档 rename 失败/写入中途崩溃」「index 与 quarter 文件不一致」「reconcileArchive 在同一任务同时存在于损坏归档与主文件时的收敛」 |
| MAJOR：missedCount 不重复增长 | `review-fixes.test.ts:89-115` | 覆盖（手工模拟 applyTick 状态推进） | 未在真实 `applyTick` 循环中验证（resolves plan + apply 的完整链路由其他用例补） |
| MAJOR：单次 advance 只投递一次 | `review-fixes.test.ts:117-141` | 覆盖 | — |
| MAJOR：单次双节点完成后 done | `review-fixes.test.ts:143-163` | **旧模型锁定（D-25 反向）** | 必须重写（D-13） |
| MAJOR：TaskView round-trip | `review-fixes.test.ts:165-191` | 覆盖 Round-trip 思路，但字段仍含 `dueDate` | 必须去 `dueDate`，补 `phase`/`startAtSource`（D-17） |
| MAJOR：单次任务独立时区 | `review-fixes.test.ts:194-207` | 覆盖 | 保持 |
| MAJOR：resume 不得复活 done | `review-fixes.test.ts:209-223` | 覆盖 | 保持 |
| MINOR：搜索不收缩徽标 | `review-fixes.test.ts:225-236` | 思路正确，但 `counts.todo` 是旧三键模型 | 必须改六键 counts（D-18） |
| MINOR：设置校验 | `review-fixes.test.ts:238-259` | 覆盖基本错误值；用例把「合法形状」混在非法值列表中用 `continue` 跳过，可读性一般 | 可保留，建议拆成 valid/invalid 两个用例 |
| 存储 JSON `null` 根 | `review-fixes.test.ts:261-271` | 覆盖 | 保持 |
| MAJOR：once + advance 全生命周期 | `review-fixes.test.ts:273-308` | 投递次数/生产映射覆盖好，但最终断言 `status='done'` 是旧模型 | 改 active/overdue（D-14） |
| MAJOR：readOnly 不启动调度 | `review-fixes.test.ts:310-327` | 覆盖 health.readOnly + 写拒绝，但与 BLOCKER A 重复 | 可合并；补 health.scheduler.running===false |
| MAJOR：DND 合并摘要 | `review-fixes.test.ts:329-367` | **名不副实**：只断言 `pendingDeliveries` 中两条 `dnd-held` 行存在，没有验证「合并为一条摘要」 | 补 dndSummary 组装/渲染断言（或降级为手工 E2E） |
| MAJOR：双节点 missed 收敛 | `review-fixes.test.ts:369-396` | missedCount=2 覆盖好；`status='done'` 是旧模型 | 改 active/overdue（D-15） |
| DEFECT：tick 映射携带 `node` | `review-fixes.test.ts:398-445` | 质量高：直接测 `planToChanges` 且复跑真实 tick 映射；但最终 `status='done'` 是旧模型 | 保留 `node` 断言，改 status（D-16） |
| MINOR：TaskView.fired | `review-fixes.test.ts:447-467` | 覆盖 advance-only fired 派生 | 保持；补 `phase` 字段断言 |

**其他回归套件质量**：

- `fixes4.test.ts`（18 例）覆盖 DEFECT-4～8（snooze、状态机、归档恢复、设置生效、paused/done 不复活），均为 host 层、断言明确，质量良好；无 D-25 冲突。
- `regression.test.ts`（11 例）覆盖 DEFECT-1～3（节假日、advance 触发、停机 missed 不重复），质量良好。
- **缺口**：评审修复涉及的 5 个新 client 文件（`confirm-delete.ts`、`notify-permission.ts`、`panel-actions.ts`、`panel-shortcuts.ts`、`task-history.ts`）**零测试**；若评审修复包含 UI 缺陷，当前回归网完全漏掉。
- **总体结论**：BLOCKER A/B 有基本覆盖但不够广（单写路径/单损坏形态）；review-fixes 对 D-25 的最大价值是 `planToChanges`/`memoryFs`/注入时钟的测试手法，而不是它当前的 20 条断言本身——其中 6 条必须重写、1 条（DND）名不副实。

---

## 5. 本轮 D-25 测试计划（按批次）

> 目标：D-25 实现（删 `dueDate`、`startAt` 可选、`phase` 读时派生、四页签 + 循环/暂停独立筛选、counts/byKind/totalDone、取消自动 done、schemaVersion 1→2、`notify.endReminder`、`serverTime`/`nextTransitionAt`、日期-only `endAt`、priority 24h/3d/7d 精确档）。

### Batch 0 — 基线适配（0.5 人日，先做，否则测试编译不过）

| 文件 | 动作 | 内容 |
|---|---|---|
| `test/fixtures.ts` | 重写 Task 工厂 | 删 `dueDate`；`makeOnceTask` 支持 `startAt?: string`（默认取 `createdAt` 并设 `startAtSource:'created'`）；`makeNotify` 默认 `endReminder:true` |
| `test/priority.test.ts` | Batch 0 临时 `skip`/编译占位 | 正式重写见 Batch 1（37 例，避免两遍重写） |
| `test/validate.test.ts` | 删除 `validateDueDate` describe（5 例） | 新增 `validateOnce` 的 startAt 可选/endAt 必填用例 |
| `test/state.test.ts` | 改 6 例 | 去 dueDate、迁移升到 v2 |
| `test/repo.test.ts` | 改 helper + 1 断言 | 去 `dueDate`（L41/L52）；counts 用例改六键 |
| `test/routes.test.ts` / `test/tools.test.ts` / `test/store.test.ts` / `test/transfer.test.ts` / `test/archive.test.ts` / `test/review-fixes.test.ts` | 机械清理 | 去 `dueDate`、`schemaVersion:1`→2、`counts.todo`→六键 |

退出标准：`tsc -p tsconfig.test.json` 零错误；重写前 572 例中除 63 个标记重写外全部仍可运行。

### Batch 1 — 纯函数核心：phase / priority / 四视图（1 人日）

| 新增/重写文件 | 用例数（建议） | 用例名 |
|---|---:|---|
| **新增** `test/phase.test.ts` | 18–20 | `now < startAt → notStarted`；`now === startAt → inProgress`；`startAt < now < endAt → inProgress`；`now === endAt → inProgress（当秒）`；`now === endAt+1ms → overdue`；`status=done → done（优先于时间）`；`status=paused → paused`；`status=archived → archived`；`kind=recurring → recurring`；`phase 使用任务时区`；`phase 不写盘` |
| **重写** `test/priority.test.ts` | 22–24 | `remaining ≤ 24h → high`；`24h+1ms → mid`；`72h → mid`；`72h+1ms → low`；`168h → low`；`168h+1ms → none`；`overdue → high 且 remainingMinutes<0`；`paused → paused/null`；`recurring 按 nextAt 分档`；`无 nextAt → none`；`priority 不落盘（读前后文件字节不变）`；`sort: pinned→priority→endAt/nextAt→title` |
| **新增** `test/view-counts.test.ts` | 12–14 | `四页签互斥：1/2/1/4`；`循环 2 / 暂停 1 独立筛选`；`paused 不出现在任何阶段页签`；`暂停恢复且过期 → overdue+1/inProgress-1`；`进行中改未来 startAt → notStarted+1/inProgress-1`；`counts 六键恒等于各 view items 数`；`byKind={once:11,recurring:3}`；`totalDone 含历史归档`；`搜索不收缩徽标`；`done 只统计本季度` |
| **新增** `test/task-view.test.ts` | 6–8 | `TaskView 含 phase、无 dueDate`；`startAtSource 透出`；`TaskView 经 create 可 round-trip`；`fired 派生`；`priority 为只读派生` |

### Batch 2 — 单次任务语义（1 人日）

| 新增/重写文件 | 用例数（建议） | 用例名 |
|---|---:|---|
| **新增** `test/once-window.test.ts` | 16–20 | `省略 startAt → createdAt + startAtSource="created"`；`省略 startAt 只产生 #end occurrence`；`显式 startAt → explicit + #start/#end`；`endReminder=false → 只产生 #start`；`endReminder=false 且无显式 startAt → invalid_argument`；`日期-only endAt 2026-11-05 → 23:59:59.999+08:00`；`endAt 缺失 → invalid_argument`；`endAt <= startAt → invalid_argument`；`编辑只改 endAt 保留 startAt`；`显式改 startAt 重置 firedStart/firedStartAdvance/missedStart/lastOccurrenceKey`；`复制保留 startAt`；`恢复已过 endAt 的归档任务 → phase="overdue"` |
| **改** `test/resolve-tick.test.ts` | +5 | `省略 startAt 的任务只排 #end`；`endReminder=false 只排 #start`；`endAt 当秒仍 inProgress（无 overdue occurrence）`；`endAt 过后不产生新 occurrence` |
| **改** `test/tick-integration.test.ts` | +3 | `双节点 fired 后 status=active、phase=overdue、doneAt=null`；`显式 complete 后 status=done、doneAt 非空`；`双节点 missed 后 status=active` |
| **改** `test/review-fixes.test.ts` | 重写 4 | `MAJOR: endAt 不自动完成（D-25/F3.6）`；`MAJOR: once + advance 生命周期（active/overdue）`；`MAJOR: both nodes missed（active/overdue）`；`DEFECT: missed node settles（active/overdue）` |

### Batch 3 — 统计 / API / 刷新（0.5–0.75 人日）

| 新增/重写文件 | 用例数（建议） | 用例名 |
|---|---:|---|
| **新增** `test/snapshot.test.ts` | 12–14 | `AC-40 counts 全量`；`byKind once/recurring`；`totalDone 含归档`；`serverTime === now`；`nextTransitionAt 取最近未来 startAt/endAt/nextAt`；`nextTransitionAt 忽略已过边界`；`默认 view=inProgress`；`六种 view 参数均合法`；`未知 view → invalid_argument`；`counts 与 items 用同一个 now` |
| **改** `test/routes.test.ts` | 4 | `/priority/rules → {highMaxHours:24,midMaxDays:3,lowMaxDays:7,refreshMode:"on-read"}`；`create/update 拒绝 dueDate`；`snapshot 返回六键 counts+byKind+totalDone`；`export/import 路由（AC-25）` |
| **改** `test/tools.test.ts` | 3 | `list 默认 view=inProgress`；`list 六种 view`；`create/update 拒绝 dueDate` |
| **新增** `test/health.test.ts` | 3 | `health 无 lastPriorityRefreshAt`；`scheduler.nextWakeAt 与 nextTransitionAt 一致`；`refreshMode:"on-read"` |
| **改** `test/delivery.test.ts` | +2 | `endReminder=false 只生成 #start 卡片`；`phaseLabel start/end 区分` |

### Batch 4 — schemaVersion 1→2 迁移 / 归档（0.75 人日）

| 新增/重写文件 | 用例数（建议） | 用例名 |
|---|---:|---|
| **新增** `test/migrations.test.ts` | 14–16 | `v1 主文件 → v2：schemaVersion=2`；`dueDate 丢弃 + warning`；`v1 once 保留 startAt 并补 startAtSource="explicit"`；`v1 once 缺 startAt → createdAt + created`；`v1 recurring dueDate 直接丢弃`；`迁移幂等（再跑 applied=[]）`；`v2 被 v1 读取 → unsupported-version、文件字节不变`；`归档 quarter 文件 v1→v2`；`归档 index v1→v2`；`迁移失败原文件不变` |
| **改** `test/archive.test.ts` | +4 | `归档 quarter schemaVersion=1 仍可读且迁移`；`恢复归档任务 phase 按 now 重算`；`totalDone = 主文件 done + 归档 count`；`崩溃对账后计数不变` |
| **改** `test/store.test.ts` | 1 | `reload 字段含 startAtSource/endReminder、不含 dueDate` |
| **改** `test/transfer.test.ts` | +3 | `buildExport schemaVersion=2`；`导入 v1+dueDate → 迁移 + warning`；`replace 导入任务数不变` |

### Batch 5 — 客户端 / E2E / 回归收口（0.5 人日，依赖环境）

| 文件/手段 | 内容 |
|---|---|
| `test/client-panel.test.tsx`（条件新增） | 四个页签徽标 3/2/1/4、循环/暂停独立筛选、三态、i18n；**阻塞：`package.json` 无 react/jsdom 运行时依赖，`node_modules` 只有 `@types/react`；不能运行 pnpm 安装 → 本轮无法落地** |
| 手工 E2E 清单 | AC-06、AC-07、AC-29、AC-31、AC-32、AC-35、AC-36、AC-37、AC-40、AC-41、AC-42、AC-43 逐条在真实 DSH 桌面版执行：15:59:59→16:00:01 自动刷新、默认 startAt、日期-only endAt、endReminder=false、迁移旧文件、四页签计数、endAt 不自动 done |
| `test/review-fixes.test.ts` | 保留 BLOCKER A/B；4 个自动 done 用例改写后作为 D-25 回归守护 |

### 5.1 每条 AC 的新增用例名（汇总）

已在 §3.1 矩阵「D-25 后处理 / 建议用例」列逐条给出 AC-01～AC-43 的文件与用例名。核心映射再压缩如下：

- AC-01～AC-05、AC-08～AC-09、AC-12、AC-16、AC-18～AC-19、AC-22、AC-26、AC-27、AC-34、AC-38～AC-39：保留现有用例（AC-05 补 `timezone.test.ts::same cron in two zones`）。
- AC-06、AC-07、AC-10、AC-11、AC-13～AC-15、AC-17、AC-20～AC-21、AC-25、AC-28：补对应边界用例（见矩阵）。
- AC-29～AC-33、AC-35～AC-37、AC-40～AC-43：D-25 新增/重写核心，落在 `phase.test.ts`、`priority.test.ts`、`view-counts.test.ts`、`once-window.test.ts`、`snapshot.test.ts`、`migrations.test.ts`、`review-fixes.test.ts`。

---

## 6. 准入门槛（D-25 交付门槛建议）

| 门槛 | 标准 | 当前基线 |
|---|---|---|
| Typecheck | `tsc --noEmit -p tsconfig.json` **且** `tsc --noEmit -p tsconfig.client.json` 零错误 | ✅ 当前通过 |
| 测试编译 | `tsc -p tsconfig.test.json` 零错误（含 test 类型） | ✅ 当前通过 |
| 单测 | `node --test ".test-build/test/*.test.js"` **0 fail / 0 skip**；预计执行用例 ≥ 690（572 − 63 重写/替换 + 新增/重写净增 ≥ 120） | ✅ 572 全过（旧模型） |
| 覆盖率 | `node --experimental-test-coverage --test`：`src/host` 行覆盖 ≥ 90%；`rules/{cron,occurrence,resolveTick,timezone,priority,phase}` 分支覆盖 **100%** | ⚠️ 当前纯函数分支 85.56–98.15%，未达 §10.1 |
| D-25 新增类别覆盖 | §5 的 10 类必须各有 ≥ 1 个正向 + ≥ 1 个边界/反向用例（相位边界、四视图互斥、counts/byKind/totalDone、startAt 默认、endReminder=false、endAt 不自动 done、迁移主文件+归档、serverTime/nextTransitionAt、日期-only endAt、priority 24h/3d/7d） | ❌ 当前 0/10 |
| 路由 | §7.8 每条路由至少 1 个 200 用例；400/401/403/404/405/409/413 各 ≥1；500 至少 1 个注入错误用例；`/export`、`/import`、`/settings/export` 必须有测试 | ⚠️ export/import 三路由零覆盖 |
| 客户端 | 三个 slot 渲染、四页签计数、循环/暂停独立筛选、i18n 切换、无 console error | ❌ 无 client 测试环境（jsdom/react 缺失） |
| 手工 E2E | AC-01～AC-43 全量通过；D-25 的 AC-06/07/29/31/32/35/36/37/40/41/42/43 必须现场走查并留截图/录屏 | ❌ 本轮未执行 |
| 打包 | `node scripts/verify-pack.mjs` OK（替代不可用的 `pnpm verify` 打包段） | ✅ 当前 OK |
| pnpm 禁令 | CI/本地验证不得以 `pnpm verify` 作为入口；必须使用 §1.1 直调命令或修复 `allowBuilds` 后的专用脚本 | ⚠️ 环境阻塞 |

---

## 7. 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R-01 | **D-25 尚未实现**，本基线全部是旧 `dueDate`/三视图模型上的 572 例；63 个用例会 fail/必须重写，最坏 95 个（repo 32 个 dueDate 创建夹具） | 实现后测试红灯大面积爆发，难以区分「D-25 预期失败」与「回归」 | 先做 Batch 0，把 63 个标记为 `TODO(D-25)`/重写，再开实现；用 git 分支隔离 |
| R-02 | `test/review-fixes.test.ts` 4 个「自动 done」用例与 D-25 的 F3.6 方向相反 | 若沿用旧回归套件，会阻止正确实现或诱导错误实现 | 实现前先重写/删除该 4 例（D-13～D-16） |
| R-03 | 无客户端测试环境（无 react/jsdom 运行时；`tsconfig.test.json` 只含 `src/host`） | AC-23/24、F8 全部 UI 行为不可自动化，四页签/徽标只能靠手工 E2E | 允许安装测试依赖后再补 `client-*.test.tsx`；否则把 UI 验收降级为手工门 |
| R-04 | 无覆盖率工具/属性测试（package 无 c8/istanbul、无 Temporal/Luxon） | §10.1 的 ≥90%/100% 分支与 10 万组属性测试无法执行/证明 | 使用 Node 内置 `--experimental-test-coverage` 作为临时门槛；属性测试需另立任务或引入 devDependency |
| R-05 | `repo.test.ts` 大量 `as never` 绕过类型检查 | D-25 改 schema 后 compile 仍可能通过、运行时才暴露；测试会「假绿」 | 清理 `as never`，改用真实 `CreateTaskInput` 类型 |
| R-06 | 归档迁移（主文件 + `archive/*.json` + `index.json`）在现行实现中无 v1→v2 路径，`transferRoutes` 覆盖率仅 42% | AC-41/AC-38/39 可能带病上线，历史归档被丢弃或无法读取 | Batch 4 独立新增 `migrations.test.ts` + `archive` 迁移用例，先测后改 |
| R-07 | 时区/宿主机依赖：测试未强制 `TZ=UTC`；部分日期用例依赖 Asia/Shanghai 默认 | CI 在不同 TZ 下可能出现边界漂移 | 所有断言显式传 `timeZone`；CI 设 `TZ=UTC` 并跑 Node 22.19/22.23/24.21 三档 |
| R-08 | `pnpm verify` 被 `allowBuilds` 占位值 + `ignoredBuilds:["esbuild@0.28.2"]` 阻断 | 若 CI 以 pnpm 为入口，D-25 的测试结果无法产出 | 固定使用 §1.1 直调命令；或由环境维护者显式修复 `allowBuilds`（本任务不修） |
| R-09 | 工作区有大量未提交评审修复（69 个改动文件、5 个新 client 文件）且多 agent 共享文件系统 | 本审计的 572 基线可能随后续并行修改漂移；测试文件可能被他人改写 | 审计基线以本文件时间为准；实现前重跑 §1.1 并对比本表数字 |
| R-10 | 现有 `priority.test.ts` 是整文件旧模型，重写成本最高（37 例、含 11 例参数化） | 若只做机械替换 `dueDate→endAt`，会漏掉「精确时刻/remainingMinutes」语义 | 按 Batch 1 重写并保留旧用例名映射，逐条对照本文件 D-01～D-05 |

---

## 8. 审计结论

1. **基线健康**：server/client typecheck 均零错误；572 用例 / 161 套件全部通过，754 ms；打包门 `verify-pack` OK。
2. **测试映射完整**：25 个测试文件覆盖 host 全部主要模块（cron/occurrence/resolveTick/timezone/priority/store/repo/archive/tools/routes/transfer/delivery/dnd/retention），3 个 helper 稳定复用；但 **client/UI 与 e2e 完全空白**，§10 的客户端/属性测试门槛未建立。
3. **D-25 冲突集中且可量化**：63 个执行用例会确定失败/必须重写（最坏 95），核心冲突在 `priority.test.ts`（37）、`validate.test.ts`（5）、`state.test.ts`（6）、`review-fixes.test.ts`（6，其中 4 个反向断言最危险）。
4. **D-25 必测 10 类全部缺失**：phase 派生边界、四视图互斥、counts/byKind/totalDone、startAt 默认、endReminder=false、endAt 不自动 done、迁移 v1→v2（主文件+归档）、serverTime/nextTransitionAt、日期-only endAt、priority 24h/3d/7d 边界。
5. **下一步**：先做 Batch 0（测试夹具去 `dueDate`、迁移断言升 v2），再按 Batch 1–4 补测；客户端 Batch 5 受依赖阻塞，以手工 E2E 兜底并单独立项。
