# AC 覆盖矩阵（v1.3 / 0.2.0）

> 对应 `docs/requirements/需求-v1.md` 第 9 章 AC-01～AC-58。
> 状态：`自动` = 有自动化用例；`脚本` = 独立验收脚本；`手工` = 仅手工 E2E。

| AC | 主题 | 覆盖位置 | 状态 |
|---|---|---|---|
| AC-01 | 工作日 + 节假日 + 调休 | `test/holidays.test.ts`、`test/regression.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-02 | 每周规则 | `test/occurrence.test.ts`、`test/priority.test.ts` | 自动 |
| AC-03 | 每月月末顺延 | `test/search.test.ts`、`test/routes.test.ts`（/rules/preview） | 自动 |
| AC-04 | skipDates / extraWorkdays | `test/occurrence.test.ts`、`test/holidays.test.ts` | 自动 |
| AC-05 | 多时区同时刻 | `test/timezone.test.ts`、`test/occurrence.test.ts` | 自动 |
| AC-06 | 单次任务显式/省略 startAt | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-07 | 起止提醒 + endAt 不自动 done | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-08 | 宽限 5 分钟 | `test/resolve-tick.test.ts` | 自动 |
| AC-09 | 去重（连续 tick + 回拨） | `test/resolve-tick.test.ts`、`test/repo.test.ts` | 自动 |
| AC-10 | 暂停/恢复不补发 | `test/repo.test.ts`、`test/d25.model.test.ts` | 自动 |
| AC-11 | 完成本次 | `test/repo.test.ts` | 自动 |
| AC-12 | 稍后提醒 | `test/fixes4.test.ts`、`test/review-fixes.test.ts` | 自动 |
| AC-13 | 浮层默认通道 | `test/delivery.test.ts` | 自动 |
| AC-14 | 前台/后台通道降级 | 手工（真实 OS 通知） | 手工 |
| AC-15 | 权限拒绝降级 | `test/d25.integration.test.ts`（/health + /capabilities）；真实 OS 通知需手工 | 自动+手工 |
| AC-16 | 投递幂等 + 回执 | `test/delivery.test.ts` | 自动 |
| AC-17 | 冷启动 60 秒内调度 | `test/apply.test.ts` + E2E | 自动 |
| AC-18 | 重启逐字段一致 | `test/store.test.ts`、`test/state.test.ts` | 自动 |
| AC-19 | 停机零回填 | `test/resolve-tick.test.ts`、`test/regression.test.ts` | 自动 |
| AC-20 | kill -9 原子写 | `test/store.test.ts`（模拟） | 手工 |
| AC-21 | 禁用后无残留 timer | `test/apply.test.ts`（disposer） | 手工 |
| AC-22 | 9 个工具 | `test/tools.test.ts` | 自动 |
| AC-23 | 入口/三态/重试 | 手工（真实浏览器渲染） | 手工 |
| AC-24 | 中英切换 | `test/dictionary.test.ts`（键集合/占位符一致）；真实切换需手工 | 自动+手工 |
| AC-25 | 导出/导入 | `test/transfer.test.ts` | 自动 |
| AC-26 | 跨站 403 | `test/routes.test.ts`、`test/http.test.ts` | 自动 |
| AC-27 | 60 秒内投递 | `test/resolve-tick.test.ts` | 自动 |
| AC-28 | 无会话消息/无 sessionId | `test/d25.integration.test.ts`（TaskView / deliveries 无 sessionId） | 自动 |
| AC-29 | 四页签 + 两筛选 | `test/d25.model.test.ts`、`test/priority.test.ts` | 自动 |
| AC-30 | 进行中完成计数 | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-31 | 优先级随时间变化 | `test/priority.test.ts`、`test/d25.model.test.ts` | 自动 |
| AC-32 | 边界刷新 + health 无 00:05 | `test/d25.integration.test.ts` | 自动 |
| AC-33 | 置顶排序 | `test/priority.test.ts` | 自动 |
| AC-34 | 完成清置顶 | `test/repo.test.ts` | 自动 |
| AC-35 | 省略 startAt 全链路 | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-36 | 暂停不算超期 | `test/priority.test.ts`、`test/d25.model.test.ts` | 自动 |
| AC-37 | 置顶超期不下沉 | `test/priority.test.ts`、`test/d25.model.test.ts` | 自动 |
| AC-38 | 季度归档 | `test/archive.test.ts`、`test/fixes4.test.ts` | 自动 |
| AC-39 | 归档 restore + 崩溃对账 | `test/archive.test.ts`、`test/archiveRestore.test.ts` | 自动 |
| AC-40 | counts / byKind / totalDone | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-41 | 四链路迁移 | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-42 | endAt 后仍 active/overdue | `test/d25.model.test.ts` | 自动 |
| AC-43 | 会议只提醒开始 | `test/d25.model.test.ts` | 自动 |
| AC-44 | 超期完成计数 | `test/d25.model.test.ts`、`test/d25.integration.test.ts` | 自动 |
| AC-45 | purge confirm | `test/d25.integration.test.ts`、`test/tools.test.ts` | 自动 |
| AC-46 | get 单条任务（F7.14） | `test/d021.test.ts` | 自动 |
| AC-47 | create 幂等（F7.15） | `test/d021.test.ts` | 自动 |
| AC-48 | list 默认 all（F7.16） | `test/d021.test.ts` | 自动 |
| AC-49 | remind/deliveries 工具（F7.17） | `test/d021.test.ts` | 自动 |
| AC-50 | complete skipNext（F7.18） | `test/d021.test.ts` | 自动 |
| AC-51 | 自然语言预填（F10.1/F10.2） | `test/f10.test.ts` + 手工 UI | 自动+手工 |
| AC-52 | 单时间默认 endAt（F10.3/F10.4） | `test/f10.test.ts` + 手工 UI | 自动+手工 |
| AC-53 | 循环语句解析（F10.3） | `test/f10.test.ts` + 真实模型 E2E | 自动+手工 |
| AC-54 | 模型不可用降级（F10.5） | `test/f10.test.ts` | 自动 |
| AC-55 | 默认关闭与 nlp_disabled（F10.7） | `test/f10.test.ts` | 自动 |
| AC-56 | 原文不落盘（F10.6） | `test/f10.test.ts` + 手工检查 | 自动+手工 |
| AC-57 | 能力边界 unsupported（F10.8） | `test/f10.test.ts` | 自动 |
| AC-58 | 模型路由回退（F10.10） | `test/f10.test.ts` | 自动 |

## 说明

- `手工` 项需要真实操作系统通知、真实进程强杀或宿主插件管理器，自动化环境无法等价复现；发布前按 `docs/testing/测试记录.md` 执行。
- `自动+手工` 表示自动化覆盖了协议/数据层，视觉与真实操作系统行为仍需手工确认。
- 覆盖位置只列“主用例”，同一 AC 可能还有多处断言。
