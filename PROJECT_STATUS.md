# Atlas / Campus AI App Foundry status

Date: 2026-10-12 (Asia/Taipei).

Latest requirements audit: `docs/REQUIREMENTS_AUDIT.md` and `docs/REQUIREMENTS_DELIVERY.md`. Structured editable roles/models/acceptance scenarios, conditional source saves and revision recovery, and a relational campus directory with private student affiliations and event venue links are IMPLEMENTED / TESTED. Canvas preserves requirements/type/theme and initializes dependency edges for older projects. The 94-module count is unchanged; the existing campus module gained real relational behavior.

Current verification: full lint/build/28 Node tests passed; after security refinements, five affected Node tests passed again. All 12 browser journeys passed on the final frontend, including 1440/390/320px checks. Native PostgreSQL 18.4 passed migration/restart and concurrent campus quota checks. Five declared showcase applications were redeployed locally and have the same current shared source fingerprint. Studio is running at http://127.0.0.1:3000. Live LLM, Docker isolation and public hosting remain BLOCKED; production/team/general executable-module engineering is still incomplete. October 10 counts below are historical.

Latest frontend/full-stack pass: wide structured-spec sections and checkboxes, 16px form inputs, commerce/community icons, compact mobile filters/navigation, explicit API-load errors and readable technical Canvas with a reserved minimap footer. Full 28-test check and 12 browser journeys passed again; final shared layer changes additionally passed four relevant Node tests and six browser journeys. Live-account audit: 69 checks; 685 translation keys complete; production npm audit: zero known vulnerabilities. Startup and five showcase redeploys were repeated on the final sources. Failures and limitations are retained in TEST_REPORT.md; this is not a claim that core-platform final acceptance is complete.

Latest follow-up: project deletion with confirmation, retained-data trash/restore, independent ZIP export, persistent Chinese/English switching, complete system Chinese fonts and idea-first visual design are implemented. The homepage module block was removed entirely following the latest feedback; the brand scene, subtle motion and real navigation remain. Details: `docs/FOLLOWUP_DELIVERY.md`.

Current evidence: `npm run check` passed lint/build and 25 Node tests. Full browser suite passed 10 journeys; after translation/loading refinements, 7 relevant journeys passed again, including preserved unsaved Canvas input. Native PostgreSQL verifies concurrent project create/restore quota limits. Existing-account audit passed 69 route/viewport checks. Export acceptance actually extracted the ZIP, installed dependencies, started an independent HTTP server, and verified business data after restart. Cloud Compose and real model design remain BLOCKED, not tested success. Current live Studio: http://127.0.0.1:3000. Do not reintroduce homepage recommendations without a new user request.

The commercial release and earlier repair counts below are historical; the current acceptance is above and in `docs/evidence/2026-10-10-followup/`.

The live existing-account audit passed all 69 route/viewport checks (23 routes at 1440/390/320px), with no browser page errors or document overflow. Its request pacing respects unchanged API limits.

Latest release: 94 built-in modules, including 10 transactional commerce modules and 4 community modules reusable in developers' own apps. Shared forum/profiles/product showcases, guided Canvas v2, typed red error links, explicit dependency wiring and subtle homepage motion are implemented. `npm run check`: 21/21 tests; `npm run e2e`: 7/7 journeys; strengthened community screenshot/viewport rerun: 2/2. Native PostgreSQL 18.4 additionally passed concurrent orders and full server restart persistence for commerce/community. Details: `docs/COMMERCIAL_COMMUNITY.md`, `docs/evidence/2026-10-10-commerce/`.

Latest repair: existing-account module library, canvas, Builder and creation pages crashed on old published manifests missing `aliases` and newer metadata. Registry reads now validate/default historical manifests without deleting data. Current frontend redesign keeps ATLAS unobscured, uses 16px base type / 14px secondary type, stable module ordering and readable initial canvas zoom. Verified 16 Node tests, four browser journeys and 42 existing-account route/viewport checks. Details: `docs/ATLAS_REDESIGN.md`. Earlier Lighthouse scores below describe the previous design, not a new measurement.

**总体状态：可运行、可测试的本地模块化平台已交付；核心平台最终验收未全部完成。** 不宣称已完成真实模型自主生成、Docker 隔离执行或公网发布。

| Area | Evidence | Actual result |
|---|---|---|
| GitHub research | TESTED | 72 个保留样本，35 个排除样本；58 个取得 README，其余仅元数据/访问失败 |
| Contracts/control plane | TESTED | Zod 清单和工具输入输出契约、账号、项目、所有权、任务、审计、文件版本及加密变量 |
| Databases | TESTED | PGlite 持久化和 Windows 原生 PostgreSQL 18.4；迁移、服务重启和会话保留 |
| Offline local backup | TESTED | 完整文件/目录快照、校验、异地目录恢复、账号/图片/密钥/版本保留及真实 HTTP 重启；运行中与远程/容器存储拒绝备份 |
| Shared modules | TESTED | 94 个内置契约：10 商业、4 社区、10 基础、50 校园记录功能、12 连接器、8 展示组件；商业模块有专用事务引擎，50 个早期模块仍是类型化记录集合 |
| Commerce / community | DEPLOYED locally / TESTED | 店铺、货架、库存、订单、交付、预约、评价、优惠券、收藏、经营统计；论坛、用户主页、产品展示、用户目录。平台与应用共用源码、分离数据库，当前仅线下结算 |
| Studio | TESTED | Atlas 首页、中文项目总览、Builder、可搜索筛选的模块库、详情/本地交互预览/接口图、工作区、预览/部署、配置和发布 |
| Visual builder | DEPLOYED locally / TESTED | v2 产品描述、四层画布、自动依赖连线、端口校验、错误红线、无效结构禁止保存/生成；真实拖拽、刷新和部署测试。不是自然语言语义正确性的证明 |
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

实际地址见 `.data/local-running.json`、`.data/showcase.json`、`.data/visual-showcase.json` 和 `.data/commercial-showcase.json`，随机本地凭据见 `.data/local-access.json`。数据与密钥不提交 Git。首页 `/`，项目工作台 `/studio`，模块 `/modules`，画布 `/compose`，社区 `/community`。

此前修复的 16 项 Node / 4 条浏览器 / 42 次页面检查为历史结果，见 `docs/evidence/2026-10-10-redesign/`。本轮为 21 项 Node / 7 条浏览器流程，通过构建、类型检查和 lint。五个声明的验收应用已刷新并通过 `npm run reuse-report -- --showcase`。全历史 `reuse-report` 仍报告另一账号的旧应用源码版本不一致；未绕过所有权更新它，旧数据保留。旧 `artifacts/acceptance/results.json` 是历史快照。

恢复入口：NEXT_ACTIONS.md、BLOCKERS.md、docs/USER_ACTION_REQUIRED.md 和 artifacts/acceptance/results.json。不要重建或删除 `.data`。
