# DSH 工作待办提醒插件（`dsh-todos-diy`）

一个 DeepSeek Harness 插件：按工作日/每周/每月/自定义 cron 循环提醒工作待办，单次任务在**开始与结束**都提醒；主面板提供「待办 / 已完成 / 超期」三视图、按剩余天数自动派生的优先级、置顶与季度归档；提醒以 `shell.overlay` 页面浮层呈现，可选浏览器系统通知。

- 宿主半零 `@deepseek-ai/*` 运行时依赖，只用 Node 内建；客户端只 `require('react')`
- 数据落在 `$DSH_HOME/dsh-todos-diy/tasks.json`（单 JSON 原子写），已完成任务按季度归档
- 已拍板的产品决策见下方「已拍板的 P0 决策」；需求规范见 [需求-v1.md](需求-v1.md)

## 文档索引

| 文档 | 内容 | 建议阅读顺序 |
|---|---|---|
| [需求-v1.md](需求-v1.md) | 第一版需求与技术框架：目标、角色场景、术语、DSH 实测约束、F1–F9 功能需求、非功能需求、技术框架（选型/数据模型/调度/API/UI）、边界条件、验收标准、测试策略、里程碑、附录 A/B/C | 第 2 遍：作为实现依据通读 |
| [待讨论-缺口清单.md](待讨论-缺口清单.md) | 33 项决策：P0 8 项（**已全部拍板**）、P1 14 项（D-09–D-22）、P2 11 项；每项含问题、选项、推荐、影响 | **第 1 遍：讨论用，先看这个** |
| [评审-独立意见.md](评审-独立意见.md) | 独立评审意见：P0 16 项、P1 11 项、P2 8 项、两份文档之间的冲突清单、「我认为还差的功能点」 | 第 3 遍：核对与修订（**已并入 v1**） |
| [UX-决策记录.md](UX-决策记录.md) | 18 条体验类决策（实现方按「默认可用/减少误操作/减少打扰/可解释」原则代为决策）+ 6 项仍需用户拍板的非 UX 问题 | 开发前速览 |
| [开发会话提示词.md](开发会话提示词.md) | **可直接粘贴到新开发会话的完整提示词**：读文档顺序、技术事实、已拍板决策、M0–M7 开发顺序、交付格式 | 开新会话时用 |

## 当前状态

- 版本：`0.1.0`（M0–M7 全部完成，552 个单测通过）
- 状态：**可安装使用**；需求侧 P0 已全部拍板，P2 增强项留 v1.1
- 决策编号：统一 `D-01`…`D-23`；决策记录见 [待讨论-缺口清单.md](待讨论-缺口清单.md) 顶部表格
- 基线：本机 DSH `0.2.1-rc.3`（macOS 桌面版）、Node `22.23.2`、pnpm `11.28.5`
- 插件命名：包名 `dsh-todos-diy`，避免与本机已安装的 `dsh-todo-reminder@0.3.0`、`dsh-todos@0.1.3` 冲突

## 已拍板的 P0 决策（2026-10-30）

| 编号 | 决策 | 结论 |
|---|---|---|
| D-01 | 调度底座 | 自研轻量调度，不依赖内置 `ctx.schedule` |
| D-02 | Agent 会话 | **不接入**：只走浮层 + 系统通知 |
| D-03 | 单次任务提醒节点 | **起止都提醒**：开始一次、结束一次 |
| D-04 | 工作日定义 | **跟随中国法定节假日与调休**（内置 2024–2027 表） |
| D-05 | 月末不存在日期 | **顺延到当月最后一天** |
| D-06 | 错过策略 | **5 分钟内补一次**，超过标 `missed` 不补发 |
| D-07 | 会话绑定 | **不做** |
| D-08 | 循环终止条件 | **不设**结束日期/次数上限 |
| D-20 | 优先级 | **纯派生**：`dueDate` 自动算、只读、不落盘 |
| D-21 | 置顶边界 | **超期仍置顶**，永远在最上方并标「超期」 |
| D-22 | 三视图口径 | **暂停 = 主动搁置**，不算超期、不参与优先级 |
| D-23 | 持久化介质 | 单 JSON 原子写（SQLite 留 v2） |
| D-24 | 已完成保留 | **永久保存**；主文件只留本季度，跨季度移入 `archive/completed-YYYY-Qn.json` |

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
| 新建任务 | 面板右上「新建任务」；选循环（工作日/每周/每月/自定义 cron）或单次（起止两个时间都提醒） |
| 完成 | 点行首圆圈；置顶会自动取消，5 秒内可撤销 |
| 置顶 | hover 行尾 📎；置顶组永远在最上方（超期也不下沉） |
| 暂停 | hover 行尾 ⏸；暂停 = 主动搁置，不算超期、不参与优先级 |
| 优先级 | 自动：今天/超期=高、3 天内=中、7 天内=低、更远或无截止=无；每天 00:05 重算 |
| 已完成 | 本季度在「已完成」页签；更早季度在「历史归档」里查 |
| 快捷键 | `N` 新建、`/` 搜索、`Esc` 关闭、`↑/↓` 移动、`Enter` 打开、`Space` 完成 |

## 不在本包范围（v1.1 再做）

- 多用户/多设备同步、节假日表在线自动更新（v1 内置静态表 2024–2027）、秒级调度
- 任务模板、批量操作、日历视图、ICS 导出、提醒升级（未确认重复提醒）
- 接入 Agent 会话（v1 已拍板不做，见 [UX-决策记录.md](UX-决策记录.md)）

## UI 原型

| 文件 | 内容 |
|---|---|
| [ui-prototype/index.html](ui-prototype/index.html) | 可交互 HTML 原型（第一版）：任务列表、新建循环/单次任务、提醒浮层、设置页、深浅色 |
| [ui-prototype/board.html](ui-prototype/board.html) | 可交互 HTML 原型（第二版）：待办 / 已完成 / 超期三视图 + 派生优先级 + 置顶 |
| [ui-prototype/README.md](ui-prototype/README.md) | 打开方式、URL 参数、截图索引、已体现的需求点、与需求的差异 |

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
  repoQuery.ts        #   三视图筛选 + 游标分页
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
  taskView.ts         #   TaskView 投影（派生 priority/nextAt/offset）
  tools.ts            #   工具注册 + F7.10 调用方门禁
  toolDefs.ts         #   9 个 todo_reminder_* 定义
  health.ts           #   /health 载荷
  http.ts             #   准入闸门 / 统一信封 / 1MB body
  delivery.ts         #   提醒卡片、模板渲染、投递记录、ack
  transfer.ts         #   导入导出（replace / merge）
  rules/              #   纯函数调度内核
src/client/           # 客户端半 TypeScript → esbuild 打包
  index.ts            #   ModuleLoader 入口 + 三个 slot 注册
  panel.ts            #   主面板（三视图/分组/搜索/快捷键）
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
test/                 # node:test 单测（552 用例 / 144 套件）
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
