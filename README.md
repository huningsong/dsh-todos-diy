# DSH 工作待办提醒插件（`dsh-todos-diy`）

一个 DeepSeek Harness 插件：按工作日/每周/每月/自定义 cron 循环提醒工作待办。**0.2.0 起采用 v1.3 / D-25 任务时间与状态模型**：删除 `dueDate`，单次任务 `startAt` 可选（默认创建时间、不发开始提醒）、`endAt` 必填且是唯一截止；主面板提供「未开始 / 进行中 / 已超期 / 已完成」四阶段页签 + 循环/暂停独立筛选，`stage` 与优先级按当前时间实时派生（不再有每日 00:05 重算），统计给出六类互斥计数、`byKind` 与 `totalDone`；提醒以 `shell.overlay` 页面浮层呈现，可选浏览器系统通知。

- 宿主半零 `@deepseek-ai/*` 运行时依赖，只用 Node 内建；客户端只 `require('react')`
- 数据落在 `$DSH_HOME/dsh-todos-diy/tasks.json`（单 JSON 原子写），已完成任务按季度归档
- 已拍板的产品决策见下方「已拍板的 P0 决策」；需求规范见 [需求-v1.md](docs/requirements/需求-v1.md)

## 文档索引

| 文档 | 内容 | 建议阅读顺序 |
|---|---|---|
| [docs/README.md](docs/README.md) | 文档总索引与轮次记录（R1/R2/R3） | **第 1 遍：先看总索引** |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录（0.1.0 → 0.2.0） | 发版前查 |
| [docs/planning/版本计划.md](docs/planning/版本计划.md) | 版本路线、0.2.0 D-25 批次、排期与发布门 | 开发/发版前 |
| [docs/planning/研发交接-0.2.0.md](docs/planning/研发交接-0.2.0.md) | 研发可直接执行的本轮需求设计、B0–B3C 任务与验收门 | **研发开工前先读** |
| [docs/planning/0.2.0升级后回归清单与需求变更.md](docs/planning/0.2.0升级后回归清单与需求变更.md) | 0.2.0 回归清单、P1 的 0.2.1 需求变更方案 | 升级/发版前 |
| [docs/reviews/round3/试用意见评估.md](docs/reviews/round3/试用意见评估.md) | 试用意见逐条真实性核对与环境基线 | 收到试用反馈时看 |
| [docs/testing/测试记录.md](docs/testing/测试记录.md) | 当前测试基线、轮次记录与 D-25 测试计划 | 每轮测试后更新 |
| [docs/development/工程配置与脚本.md](docs/development/工程配置与脚本.md) | 根目录配置文件（package/tsconfig/cordis patch）职责与归类规则 | 工程维护 |
| [需求-v1.md](docs/requirements/需求-v1.md) | 第一版需求与技术框架：目标、角色场景、术语、DSH 实测约束、F1–F9 功能需求、非功能需求、技术框架（选型/数据模型/调度/API/UI）、边界条件、验收标准、测试策略、里程碑、附录 A/B/C | 第 2 遍：作为实现依据通读 |
| [待讨论-缺口清单.md](docs/decisions/待讨论-缺口清单.md) | 35 项决策：P0 8 项（**已全部拍板**）、P1 15 项（D-09–D-22、D-24）、P2 11 项 + D-25；每项含问题、选项、推荐、影响 | **第 1 遍：讨论用，先看这个** |
| [评审-独立意见.md](docs/reviews/round1/评审-独立意见.md) | 独立评审意见：P0 16 项、P1 11 项、P2 8 项、两份文档之间的冲突清单、「我认为还差的功能点」 | 第 3 遍：核对与修订（**已并入 v1**） |
| [UX-决策记录.md](docs/decisions/UX-决策记录.md) | 18 条体验类决策（实现方按「默认可用/减少误操作/减少打扰/可解释」原则代为决策）+ 6 项仍需用户拍板的非 UX 问题 | 开发前速览 |
| [开发会话提示词.md](docs/guides/开发会话提示词.md) | **可直接粘贴到新开发会话的完整提示词**：读文档顺序、技术事实、已拍板决策、M0–M7 开发顺序、交付格式 | 开新会话时用 |

## 当前状态

- 版本：`0.2.1`（D-25 任务时间与状态模型 + Agent 体验补齐；701 个单测通过；schemaVersion 2）
- 状态：`0.2.1` 可安装使用；v1.1 的 NLP 与任务级 DND 等 P2 增强项仍留后续版本
- 决策编号：统一 `D-01`…`D-25`；决策记录见 [待讨论-缺口清单.md](docs/decisions/待讨论-缺口清单.md) 顶部表格
- 基线：本机 DSH `0.2.1-rc.3`（macOS 桌面版）、Node `22.23.2`、pnpm `11.28.5`
- 插件命名：包名 `dsh-todos-diy`，避免与本机已安装的 `dsh-todo-reminder@0.3.0`、`dsh-todos@0.1.3` 冲突

## 已拍板的 P0 决策（2026-10-30）

| 编号 | 决策 | 结论 |
|---|---|---|
| D-01 | 调度底座 | 自研轻量调度，不依赖内置 `ctx.schedule` |
| D-02 | Agent 会话 | **不接入**：只走浮层 + 系统通知 |
| D-03 | 单次任务提醒节点 | **默认起止都提醒**；`startAt` 省略时只提醒结束；会议类可关结束提醒 |
| D-04 | 工作日定义 | **跟随中国法定节假日与调休**（内置 2024–2027 表） |
| D-05 | 月末不存在日期 | **顺延到当月最后一天** |
| D-06 | 错过策略 | **5 分钟内补一次**，超过标 `missed` 不补发 |
| D-07 | 会话绑定 | **不做** |
| D-08 | 循环终止条件 | **不设**结束日期/次数上限 |
| D-20 | 优先级 | **纯派生**：单次按 `endAt`、循环按 `nextAt` 自动算、只读、不落盘 |
| D-21 | 置顶边界 | **超期仍置顶**，永远在最上方并标「超期」 |
| D-22 | 视图与暂停口径 | **暂停 = 主动搁置**，不算超期、不参与优先级，独立筛选不混入阶段页签 |
| D-23 | 持久化介质 | 单 JSON 原子写（SQLite 留 v2） |
| D-24 | 已完成保留 | **永久保存**；主文件只留本季度，跨季度移入 `archive/completed-YYYY-Qn.json` |
| D-25 | 任务时间与状态 | **删除 `dueDate`**；`startAt` 可省略（默认创建时间、不产生开始提醒）+ `endAt` 必填；`stage` 读时派生，循环单列；`endAt` 不自动完成 |

## 安装

### 从本地目录（开发）

```text
plugin_manager install_bundle target=<本仓库的绝对路径>
```

### 从 GitHub

```text
plugin_manager install_bundle target=git@github.com:huningsong/dsh-todos-diy.git
```

> 用 `git@github.com:...`（SSH）而不是 `github:...` 简写：后者会转 HTTPS 做预检，网络不稳时容易超时失败。

安装后**重启 DSH**。侧边栏出现「工作待办」入口，`GET /api/dsh-todos-diy/health` 应返回 `scheduler.running=true`。

### 从 npm（发布后）

```bash
npm publish            # 内网源或 npmjs.org，需先 npm adduser
```

## 使用

| 操作 | 说明 |
|---|---|
| 新建任务 | 面板右上「新建任务」；选循环（工作日/每周/每月/自定义 cron）或单次（开始时间可留空，默认创建时间；结束时间必填） |
| 完成 | 点行首圆圈；置顶会自动取消，5 秒内可撤销 |
| 置顶 | hover 行尾 📎；置顶组永远在最上方（超期也不下沉） |
| 暂停 | hover 行尾 ⏸；暂停 = 主动搁置，不算超期、不参与优先级 |
| 优先级 | 自动：24 小时内到期/已超期=高、3 天内=中、7 天内=低、更远或无结束时间=无；按当前时间实时计算 |
| 已完成 | 本季度在「已完成」页签；更早季度在「历史归档」里查 |
| 快捷键 | `N` 新建、`/` 搜索、`Esc` 关闭、`↑/↓` 移动、`Enter` 打开、`Space` 完成 |

## 不在本包范围（v1.1 再做）

- 多用户/多设备同步、节假日表在线自动更新（v1 内置静态表 2024–2027）、秒级调度
- 任务模板、批量操作、日历视图、ICS 导出、提醒升级（未确认重复提醒）
- 接入 Agent 会话（v1 已拍板不做，见 [UX-决策记录.md](docs/decisions/UX-决策记录.md)）

## UI 原型

| 文件 | 内容 |
|---|---|
| [ui-prototype/index.html](docs/ui-prototype/index.html) | 可交互 HTML 原型（第一版）：任务列表、新建循环/单次任务、提醒浮层、设置页、深浅色 |
| [ui-prototype/board.html](docs/ui-prototype/board.html) | 可交互 HTML 原型（第二版，D-25 前）：待办 / 已完成 / 超期三视图 + 派生优先级 + 置顶 |
| [ui-prototype/README.md](docs/ui-prototype/README.md) | 打开方式、URL 参数、截图索引、已体现的需求点、与需求的差异 |

---

## 工程说明

### 包结构与关键字段

| 项 | 值 |
|---|---|
| 包名 | `dsh-todos-diy` |
| loader 行 id | `todos-diy` |
| 客户端 bundle id | `dsh-todos-diy`（必须严格等于包名） |
| HTTP 前缀 | `/api/dsh-todos-diy` |
| locale namespace | `todos-diy` |
| 数据文件 | `$DSH_HOME/dsh-todos-diy/tasks.json` |
| 归档目录 | `$DSH_HOME/dsh-todos-diy/archive/` |
| `engines.dsh` | `^0.2.1-rc.3`（`dsh-app-boot` 强制校验，求值带 `includePrerelease: true`） |
| 运行时依赖 | 无（宿主半只用 Node 内建，客户端只 `require('react')`） |

### 目录

```
package.json          # main/exports/dsh/engines/files
config/               # tsconfig.client.json / tsconfig.test.json
cordis.patch.yml      # - insert: [{id: todos-diy, name, config}]
lib/index.js          # 宿主半入口 apply(ctx, config)（tsc 产物）
lib/client.js         # 客户端 bundle（window.__ModuleLoader__.load，esbuild 产物）
locale/{zh,en}.json   # 插件页显示名/描述
assets/               # 内置节假日表
src/host/             # 宿主半 TypeScript
  index.ts            #   apply()：load → ready → tick → routes
  config.ts           #   配置归一化（非法值回落默认）
  paths.ts            #   $DSH_HOME 解析
  state.ts            #   持久化文档形状 + 逐字段校验
  migrations.ts       #   schemaVersion 迁移链
  store.ts            #   单 JSON 原子写、损坏备份重建
  repo.ts             #   CRUD / 状态机 / 乐观锁 / 写队列
  repoBuild.ts        #   创建与编辑时的对象装配
  repoQuery.ts        #   四阶段视图筛选 + 游标分页
  writeQueue.ts       #   串行队列 + debounce 合并写
  validate.ts         #   字段校验（API 与工具共用）
  validateTime.ts     #   ISO 时间与单次窗口校验
  archive.ts          #   季度归档 + 崩溃对账
  archiveRestore.ts   #   归档任务恢复回主文件
  dnd.ts              #   免打扰判定与摘要队列
  search.ts           #   跨主文件与归档的搜索
  routes.ts           #   全部 HTTP 路由 + 非任务端点
  taskRoutes.ts       #   任务 CRUD 路由
  routeKit.ts         #   信封 / 错误码映射 / query 解析
  taskView.ts         #   TaskView 投影（派生 stage/priority/nextAt/offset）
  tools.ts            #   工具注册 + F7.10 调用方门禁
  toolDefs.ts         #   12 个 todo_reminder_* 定义（toolDefsExtra.ts 为 get/remind/deliveries）
  health.ts           #   /health 载荷
  http.ts             #   准入闸门 / 统一信封 / 1MB body
  delivery.ts         #   提醒卡片、模板渲染、投递记录、ack
  transfer.ts         #   导入导出（replace / merge）
  rules/              #   纯函数调度内核
src/client/           # 客户端半 TypeScript → esbuild 打包
  index.ts            #   ModuleLoader 入口 + 三个 slot 注册
  panel.ts            #   主面板（四视图/分组/搜索/快捷键）
  task-list.ts        #   列表三态 + 分组渲染
  archive-view.ts     #   历史季度归档视图
  examples.ts         #   首次使用示例卡
  grouping.ts         #   置顶/优先级分组与排序
  task-row.ts         #   单行 + hover 三按钮
  task-editor.ts      #   新建/编辑弹窗
  editor-fields.ts    #   表单字段组
  settings-modal.ts   #   设置（时区/DND/通道/导入导出）
  overlay.ts          #   提醒浮层
  dictionary*.ts      #   zh / en 字典
  api.ts              #   fetch 封装
test/                 # node:test 单测（572 用例）
docs/                 # 文档：需求/决策/评审/版本计划/测试/指南/市场
  README.md           #   文档总索引与轮次记录
  requirements/       #   需求 v1.3、D-25 方案与评估
  decisions/          #   D-01…D-25、UX 决策
  reviews/            #   round1/round2 评审
  planning/           #   版本计划与开发批次
  testing/            #   测试基线、轮次记录与 D-25 测试计划
  guides/             #   开发会话提示词
  market/             #   市场条目与上架指引
```

### 开发命令

```bash
pnpm build     # tsc 编译 src/host → lib/，并用 esbuild 打包 src/client → lib/client.js
pnpm typecheck # 宿主与客户端两份 tsconfig 都跑 tsc --noEmit
pnpm test      # 编译并运行全部单测（node:test）
pnpm verify    # typecheck + test + scripts/verify-pack.mjs（发布门槛）
```

### 里程碑进度

| 里程碑 | 状态 |
|---|---|
| M0 骨架与安装 | ✅ 完成 |
| M1 调度内核 | ✅ 完成 |
| M2 存储 | ✅ 完成 |
| M3 API + 工具 | ✅ 完成 |
| M4 UI | ✅ 完成 |
| M5 提醒通道 | ✅ 完成 |
| M6 设置 | ✅ 完成 |
| M7 测试发布 | ✅ 完成 |

---

## 许可证

MIT，见 [LICENSE](LICENSE)。

内置节假日数据（`assets/holidays-cn-2024-2027.json`）派生自 [chinese-days](https://github.com/vsme/chinese-days)（MIT），仅包含与「周一至周五」规则不一致的日期（法定假期中的工作日、调休上班的周末），2024–2026 为国务院已公布安排，2027 待公布。

## 已知偏差

以下是实现过程中与需求正文有出入、但经评估后**有意保留**的项。除特别说明外均不影响 v1 验收。

| 编号 | 需求 | 现状 | 原因 |
|---|---|---|---|
| DEV-01 | F5.6 / UX-05 | 全局免打扰（DND）：时段内到点的提醒被暂存，窗口结束后合并为一条摘要浮层；v1 不做任务级 DND 覆盖。 | 需求 F5.6 已明确 v1 只做全局 DND；任务级覆盖留 v1.1。 |
| DEV-02 | §7.5 `dueOccurrences` | 只返回最近一条到期 occurrence；更早的积压通过 `missedOccurrences()` 记录为 missed（零回填）。 | 需求要求「停机零补发」，因此不能把积压逐条重放。 |
| DEV-03 | F6.5 | 未实现 `tasks.lock` 两进程只读降级。 | v1 验收只测单进程；`readOnly` 已覆盖「文件版本过高」场景。 |
| DEV-04 | F4.16 | 归档扫描在启动时 + 每 6 小时执行一次，而非严格在季度首日 00:05。 | 崩溃恢复更重要；统一为「季度首个 tick（1/4/7/10-01 00:00 之后）」，不设独立 00:05 定时器。 |
| DEV-05 | F7.10 | 0.2.0 起工具**不再按调用者拒绝**（v1.3 要求主会话、子 Agent、无 Agent 上下文均可调用）；校验失败仍以 `ToolFailure` 抛出，message 为 JSON `{code,message,...}`。 | DSH 工具管线没有结构化错误返回通道；任务不绑定会话（D-02）。 |
| DEV-06 | §7.8 | 额外提供 `POST /capabilities` 与 `POST /deliveries/report`。 | 浏览器权限与真实系统通知结果只能由客户端上报，宿主无法自省。 |
| DEV-07 | F1.4 / F6.4 | 投递记录上限 1000 行，90 天保留期未实现（未 ack 的浮层记录永久保留）。 | UX-01 要求浮层不自动消失，与保留期冲突时优先 UX-01。 |
| DEV-08 | NF6 | 1000 条任务单次 tick 实测约 57ms，未达到 ≤20ms 目标（已加 cron 解析缓存，从 68ms 优化到 57ms）。 | 瓶颈是 `Intl` 时区换算与每 tick 的 `nextWakeAt` 诊断字段；60s 一次 tick 的实际 CPU 占用约 0.1%，功能不受影响。 |
| DEV-09 | F4.15 边界 | `coerceTask` 对**已处于 done 的 once 任务**只归一 `recurring+done`，手改/导入的 `done + pinned=true` 仍会被保留。正常路径 `complete` 会原子清 pinned。 | 仅在 `done` 手工写入场景触发；F4.15 的验收路径（用户点完成）不经过 coerce。 |
| DEV-10 | F6.8 边缘 | `schemaVersion > 2` 的归档 quarter 文件在 `rebuildIndex` 计数与 `restore` 时仍按 v2 结构处理（不覆盖文件，但可能按旧结构读取）。index 本身已拒绝降级。 | 归档索引已完整保护；quarter 的高版本兼容留到 v2 真正出现时处理。 |
| DEV-11 | F5.6 边缘 | DND 摘要的**系统通知**未按 occurrence 去重，理论上每次轮询会重发同一 tag 的通知（浏览器通常按 tag 替换）。 | 影响仅限页面隐藏时的重复通知；浮层摘要本身只显示一次。 |
