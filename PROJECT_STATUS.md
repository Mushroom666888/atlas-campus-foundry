# Atlas / Campus AI App Foundry status

Date: 2026-10-10 (Asia/Shanghai).

**总体状态：可运行、可测试的本地模块化平台已交付；核心平台最终验收未全部完成。** 不宣称已完成真实模型自主生成、Docker 隔离执行或公网发布。

| Area | Evidence | Actual result |
|---|---|---|
| GitHub research | TESTED | 72 个保留样本，35 个排除样本；58 个取得 README，其余仅元数据/访问失败 |
| Contracts/control plane | TESTED | Zod 清单和工具输入输出契约、账号、项目、所有权、任务、审计、文件版本及加密变量 |
| Databases | TESTED | PGlite 持久化和 Windows 原生 PostgreSQL 18.4；迁移、服务重启和会话保留 |
| Offline local backup | TESTED | 完整文件/目录快照、校验、异地目录恢复、账号/图片/密钥/版本保留及真实 HTTP 重启；运行中与远程/容器存储拒绝备份 |
| Shared modules | TESTED | 80 个内置契约：10 基础、50 校园功能、12 连接器、8 展示组件；50 个功能模块共用真实 SQL/授权/界面引擎，各自声明字段、状态和隐私 |
| Studio | TESTED | Atlas 首页、中文项目总览、Builder、可搜索筛选的模块库、详情/本地交互预览/接口图、工作区、预览/部署、配置和发布 |
| Visual builder | DEPLOYED locally / TESTED | React Flow 拖拽、连线、配置、保存/刷新、生成真实应用；通知、嵌入记录、搜索筛选及统计；不依赖 LLM |
| Module references | TESTED | +中文模块名 / +moduleId 补全、持久化和 Agent 模块选择约束；不是模型推理测试 |
| Atlas design | IMPLEMENTED / TESTED | 功能验收后 Git 克隆 taste-skill 并应用；本地字体、NASA 位图、动效/减少动态、9 个视口；Lighthouse 85/100/100，不等于用户视觉认可 |
| Agent tools | TESTED with contract provider | 真工具、真文件、持久日志、修复预算和旧验证失效；不是实际模型测试 |
| Live LLM | BLOCKED | 未配置模型凭据；自主生成/修复和个性化代码闭环尚未实测 |
| Local hosting | DEPLOYED locally / TESTED | 三个可信独立进程，各自数据库；HTTP、健康、日志、重启和构件回滚 |
| Generated code isolation | IMPLEMENTED / BLOCKED | Docker 构建测试、自定义后端/前端加载已编写，容器与域名隔离未验收，门禁保持关闭 |
| Three products | DEPLOYED locally / TESTED | Events、Marketplace、Study Buddy；确定性组装，不是 LLM 自主产物 |
| Policy ecosystem | TESTED | 候补策略提取、审核、发布、独立应用安装、真实 FIFO 行为、版本更新/回滚 |
| General code-module ecosystem | PLANNED | 任意源码抽取、签名、发布与多版本代码执行尚未完成 |
| Public production | PLANNED / BLOCKED | 独立 runner、动态 TLS 路由、生产异地备份调度及 hostile-tenant 验收未完成 |

实际地址见 `.data/local-running.json`、`.data/showcase.json` 和 `.data/visual-showcase.json`，随机本地凭据见 `.data/local-access.json`。数据与密钥不提交 Git。首页 `/`，项目工作台 `/studio`，模块 `/modules`，画布 `/compose`。

本轮最新验收：15 项 Node 测试、4 条 Playwright 流程全部通过；构建、类型检查、lint、共享源码验证通过。证据见 `docs/evidence/2026-10-10-atlas/`。旧 `artifacts/acceptance/results.json` 是此前整体验收快照，不代表本轮命令运行时间。

恢复入口：NEXT_ACTIONS.md、BLOCKERS.md、docs/USER_ACTION_REQUIRED.md 和 artifacts/acceptance/results.json。不要重建或删除 `.data`。
