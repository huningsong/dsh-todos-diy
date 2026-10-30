# 文档索引与轮次记录

> 本目录集中存放需求、决策、评审、计划、测试与发布物料。代码在仓库根目录的 `src/`、`test/`、`lib/`、`scripts/`。

## 目录结构

| 目录 | 内容 |
|---|---|
| `requirements/` | 需求主文档、时间/状态模型方案、自然语言录入评估、逻辑问题评估 |
| `decisions/` | 缺口清单（D-01…D-25）与 UX 决策记录 |
| `reviews/round1/` | 第一轮独立评审 |
| `reviews/round2/` | 第二轮评审（v1.2/D-25）、负责人意见与 4 份详细报告 |
| `reviews/round3/` | 试用意见真实性评估（0.2.0） |
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

## 关键入口

- 需求基线：[requirements/需求-v1.md](requirements/需求-v1.md)（v1.3）
- 决策记录：[decisions/待讨论-缺口清单.md](decisions/待讨论-缺口清单.md)
- 本轮评审：[reviews/round2/评审-本轮需求.md](reviews/round2/评审-本轮需求.md)
- 版本计划：[planning/版本计划.md](planning/版本计划.md)
- 研发交接：[planning/研发交接-0.2.0.md](planning/研发交接-0.2.0.md)
- 0.2.0 回归与 0.2.1 变更：[planning/0.2.0升级后回归清单与需求变更.md](planning/0.2.0升级后回归清单与需求变更.md)
- 试用反馈评估：[reviews/round3/试用意见评估.md](reviews/round3/试用意见评估.md)
- 测试记录：[testing/测试记录.md](testing/测试记录.md)
- 开发提示词：[guides/开发会话提示词.md](guides/开发会话提示词.md)
- 工程配置：[development/工程配置与脚本.md](development/工程配置与脚本.md)
- 变更记录：[../CHANGELOG.md](../CHANGELOG.md)

## 文档维护约定

1. **需求变更**先改 `requirements/需求-v1.md` 并更新文首变更记录；同步 `decisions/` 对应 D-xx。
2. **评审轮次**归档到 `reviews/roundN/`，每轮至少保留：评审正文、负责人意见、详细证据（如有）。
3. **测试**每轮把命令、通过数、失败/跳过、环境写入 `testing/测试记录.md`。
4. **版本**所有对外发布计划写入 `planning/版本计划.md`，代码版本与 `package.json` 同步。
