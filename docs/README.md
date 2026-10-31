# 文档索引与轮次记录

> 本目录集中存放需求、决策、评审、计划、测试与发布物料。代码在仓库根目录的 `src/`、`test/`、`lib/`、`scripts/`。

## 目录结构

| 目录 | 内容 |
|---|---|
| `requirements/` | 需求主文档、时间/状态模型方案、自然语言录入评估、逻辑问题评估 |
| `decisions/` | 缺口清单（D-01…D-25）与 UX 决策记录 |
| `reviews/round1/` | 第一轮独立评审 |
| `reviews/round2/` | 第二轮评审（v1.2/D-25）、负责人意见与 4 份详细报告 |
| `reviews/round3/` | 试用意见真实性评估、第二轮/第三轮页面体验问题评估 |
| `planning/` | 版本计划、开发批次与发布门 |
| `testing/` | 测试基线、轮次测试记录与 D-25 测试计划 |
| `guides/` | 开发会话提示词 |
| `development/` | 工程配置与脚本说明（根目录配置为什么不移动） |
| `config/` | 客户端/测试 tsconfig（工具链配置） |
| `market/` | 插件市场条目与上架指引 |
| `screenshots/` | 市场截图 |
| `ui-prototype/` | UI 原型（第一版/第二版，第二版为 D-25 前视觉参考） |

## 轮次记录

| 轮次 | 日期 | 需求设计 | 评审 | 代码/测试 | 状态 |
|---|---|---|---|---|---|
| **R1** | 2026-10-30 | `requirements/需求-v1.md` v1；D-01…D-24；`decisions/UX-决策记录.md` | `reviews/round1/评审-独立意见.md` | v0.1.0 旧模型（`dueDate`、三视图）；历史基线 552 tests / 144 suites | 已发布基线 |
| **R2** | 2026-10-30 | D-25 时间/状态模型：`requirements/优化-任务时间与状态模型.md`、`requirements/评估-任务时间与状态逻辑.md` | `reviews/round2/评审-本轮需求.md` + `评审-本轮需求-负责人意见.md`；8 个 P0、20 个 P1 | 当前工作树 572 tests / 161 suites 通过；D-25 尚未进入 `src/` | 需求已评审，待开发 |
| **R3** | 2026-10-30 | 按 `requirements/需求-v1.md` v1.3 实现 D-25；NLP 留 v1.1 | 不新增评审轮次，按 v1.3 开工门 | v0.2.0：**676 tests / 197 suites / 0 fail**；三份 tsc 0 错误；verify-pack OK | **已实现（0.2.0）** |
| **R4** | 2026-10-30 | v1.4：F7.14–F7.18（get / 幂等 / list all / remind-deliveries / skipNext） | `reviews/round3/试用意见评估.md` 的 P1 项 | v0.2.1：**705 tests / 205 suites / 0 fail**；AC-46–AC-50 全过；verify-pack OK | **已实现（0.2.1）** |
| **R5** | 2026-10-30 | v1.6：F10 自然语言录入（`/parse` + 预填 + 三态 + 降级 + 默认关闭） | `requirements/评估-自然语言录入.md`（按 D-25 重写） | v0.4.0：**759 tests / 219 suites / 0 fail**；AC-51–AC-58 全过；真实模型 E2E 通过 | **已实现（0.4.0）** |
| **R6** | 2026-10-31 | v1.7：F11 周报/月报（CompletionEvent + schema v3 + `/reports` + ReportModal） | `requirements/评估-周报月报.md`、`planning/0.5.0版本规划.md` | v0.5.0：**786 tests / 228 suites / 0 fail**；AC-REP-01–08 全过；verify-pack OK | **已实现（0.5.0）** |
| **R7** | 2026-10-31 | v1.8：F8.17 搜索范围 + F10.11 NLP 降级提示 | `planning/0.5.1需求设计.md`（设计评审 3 轮通过） | v0.5.1：**817 tests / 242 suites / 0 fail**；AC-59/AC-60 全过 | **已实现（0.5.1）** |
| **R8** | 2026-10-31 | v1.10：F8.20 列表分页与全量分组计数 + F10.1 输入弹窗 | 用户反馈（1000 条列表分页） | v0.5.2：**824 tests / 244 suites / 0 fail**；AC-61 全过 | **已实现（0.5.2）** |

## 关键入口

- 需求基线：[requirements/需求-v1.md](requirements/需求-v1.md)（v1.9）
- 决策记录：[decisions/待讨论-缺口清单.md](decisions/待讨论-缺口清单.md)
- 本轮评审：[reviews/round2/评审-本轮需求.md](reviews/round2/评审-本轮需求.md)
- 版本计划：[planning/版本计划.md](planning/版本计划.md)
- 研发交接：[planning/研发交接-0.2.0.md](planning/研发交接-0.2.0.md)
- 0.2.0 回归与 0.2.1 变更：[planning/0.2.0升级后回归清单与需求变更.md](planning/0.2.0升级后回归清单与需求变更.md)
- 试用反馈评估：[reviews/round3/试用意见评估.md](reviews/round3/试用意见评估.md)
- 第二轮体验评估：[reviews/round3/第二轮体验问题评估.md](reviews/round3/第二轮体验问题评估.md)
- 第三轮体验评估：[reviews/round3/第三轮体验问题评估.md](reviews/round3/第三轮体验问题评估.md)
- 周报/月报评估：[requirements/评估-周报月报.md](requirements/评估-周报月报.md)
- 0.3.0 版本规划：[planning/0.3.0版本规划.md](planning/0.3.0版本规划.md)
- 开发进度盘点：[planning/开发进度盘点-2026-10-31.md](planning/开发进度盘点-2026-10-31.md)
- 0.2.1 体验修复方案：[planning/0.2.1体验修复方案.md](planning/0.2.1体验修复方案.md)
- 测试记录：[testing/测试记录.md](testing/测试记录.md)
- 开发提示词：[guides/开发会话提示词.md](guides/开发会话提示词.md)
- 工程配置：[development/工程配置与脚本.md](development/工程配置与脚本.md)
- 变更记录：[../CHANGELOG.md](../CHANGELOG.md)

## 文档维护约定

1. **需求变更**先改 `requirements/需求-v1.md` 并更新文首变更记录；同步 `decisions/` 对应 D-xx。
2. **评审轮次**归档到 `reviews/roundN/`，每轮至少保留：评审正文、负责人意见、详细证据（如有）。
3. **测试**每轮把命令、通过数、失败/跳过、环境写入 `testing/测试记录.md`。
4. **版本**所有对外发布计划写入 `planning/版本计划.md`，代码版本与 `package.json` 同步。
