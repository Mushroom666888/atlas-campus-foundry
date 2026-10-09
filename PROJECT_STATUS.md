# Campus AI App Foundry status

Date: 2026-10-10 (Asia/Shanghai).

**总体状态：可运行、可测试的本地模块化平台已交付；核心平台最终验收未全部完成。** 不宣称已完成真实模型自主生成、Docker 隔离执行或公网发布。

| Area | Evidence | Actual result |
|---|---|---|
| GitHub research | TESTED | 72 个保留样本，35 个排除样本；58 个取得 README，其余仅元数据/访问失败 |
| Contracts/control plane | TESTED | Zod 清单和工具输入输出契约、账号、项目、所有权、任务、审计、文件版本及加密变量 |
| Databases | TESTED | PGlite 持久化和 Windows 原生 PostgreSQL 18.4；迁移、服务重启和会话保留 |
| Offline local backup | TESTED | 完整文件/目录快照、校验、异地目录恢复、账号/图片/密钥/版本保留及真实 HTTP 重启；运行中与远程/容器存储拒绝备份 |
| Shared modules | TESTED | identity, profiles, campus, content, search, chat, notifications, events, groups, media |
| Studio | TESTED | 中文项目总览、创建、Builder、模块仓库、工作区、预览/部署、配置和发布 |
| Agent tools | TESTED with contract provider | 真工具、真文件、持久日志、修复预算和旧验证失效；不是实际模型测试 |
| Live LLM | BLOCKED | 未配置模型凭据；自主生成/修复和个性化代码闭环尚未实测 |
| Local hosting | DEPLOYED locally / TESTED | 三个可信独立进程，各自数据库；HTTP、健康、日志、重启和构件回滚 |
| Generated code isolation | IMPLEMENTED / BLOCKED | Docker 构建测试、自定义后端/前端加载已编写，容器与域名隔离未验收，门禁保持关闭 |
| Three products | DEPLOYED locally / TESTED | Events、Marketplace、Study Buddy；确定性组装，不是 LLM 自主产物 |
| Policy ecosystem | TESTED | 候补策略提取、审核、发布、独立应用安装、真实 FIFO 行为、版本更新/回滚 |
| General code-module ecosystem | PLANNED | 任意源码抽取、签名、发布与多版本代码执行尚未完成 |
| Public production | PLANNED / BLOCKED | 独立 runner、动态 TLS 路由、生产异地备份调度及 hostile-tenant 验收未完成 |

实际地址见 `.data/local-running.json` 和 `.data/showcase.json`，随机本地凭据见 `.data/local-access.json`。数据与密钥不提交 Git。

恢复入口：NEXT_ACTIONS.md、BLOCKERS.md、docs/USER_ACTION_REQUIRED.md 和 artifacts/acceptance/results.json。不要重建或删除 `.data`。
