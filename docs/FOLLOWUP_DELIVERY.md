# Atlas 本轮交付

2026-10-10，Windows / Node.js 24.17.0。仓库：`C:\Users\14237\Desktop\Campus AI App Foundry`。

## A. 已完成与实际验证

访问 [Atlas 首页](http://127.0.0.1:3000)、[项目总览](http://127.0.0.1:3000/studio)、[模块仓库](http://127.0.0.1:3000/modules) 和 [可视化创作](http://127.0.0.1:3000/compose)。本地服务已启动；端口变化时以 `.data/local-running.json` 为准。

| 功能 | 状态 | 本轮结果 |
|---|---|---|
| 简洁首页 | IMPLEMENTED / TESTED / DEPLOYED locally | 删除整个模块推荐区及其标题、计数；保留 ATLAS 主视觉、轻微背景动效、语言选择和真实导航。模块发现进入模块仓库 |
| 项目删除 | IMPLEMENTED / TESTED / DEPLOYED locally | 总览行和项目详情都有删除按钮；二次确认后取消任务、停止实例并移入回收站；恢复保留文件、配置、账号和业务数据，不自动启动应用 |
| 回收站与配额 | IMPLEMENTED / TESTED | 20 个活动项目、100 个总保留项目；创建与恢复在事务内锁定账号，防止并发越过配额。当前没有永久清空或自动过期删除 |
| 中英文与字体 | IMPLEMENTED / TESTED | 持久语言选择；首页、Studio、模块目录/详情、Canvas、社区及运行应用的常用界面。规范化 400/700 字重，浏览器验证使用完整 Microsoft YaHei UI |
| AI 优先 Canvas | IMPLEMENTED / TESTED with contract provider | 先描述想法，再查看产品方案，按需打开技术连线。保存需求与设计任务，支持审核方案后创建和继续调整。结构不合法时不能生成 |
| 实际模型设计 | BLOCKED | 尚未配置 Provider；界面明确显示等待接入，不把手动组装说成模型生成 |
| 独立 ZIP 导出 | IMPLEMENTED / TESTED | 项目详情下载运行包；实际解压、安装依赖、启动独立 HTTP 服务、创建数据、重启后读取。保留项目源码与共享模块，不导出平台账号、应用数据或密钥 |
| 云部署包 | IMPLEMENTED / BLOCKED for execution | 包内提供 Dockerfile、Compose、环境模板和健康检查；没有 Docker 实测或远程上线 |

删除不是擦除数据。回收站中的项目在当前项目/部署列表中隐藏；恢复后可以重新部署，历史部署记录重新可见。日志和审计保留。删除若遇到正在部署会拒绝，避免返回虚假的成功。

语言切换只改变显示，不改变存储中的枚举、模块 ID、项目名、用户学校/简介/帖子或未保存表单。用户内容、Agent 输出和原始诊断日志保留原文。模块库支持中英文名称、描述和原始 ID 搜索。

### 本地启动与导出

平台使用 `npm run dev`，或双击 `Start-Local.cmd`。会构建并启动服务，默认 `http://127.0.0.1:3000`。已有随机本地账号在 `.data/local-access.json`，不要把它提交或发到聊天中。

在项目详情选择「导出应用」后，解压目录运行：

```text
npm ci --ignore-scripts
npm start
```

独立应用默认 `http://127.0.0.1:4100`，使用新账号，数据持久化在 `app-data/`。`npm run verify` 检查该服务，`npm run deploy` 使用包内 Compose。配置采用 `RUNTIME_PORT`、`RUNTIME_HOST`、`RUNTIME_PUBLIC_ORIGIN`、`APP_DATABASE_URL` 等，详见包内 `.env.example`。源码 `workspace/` 可用于继续开发，但不会被自动当成可信后端执行。此包不是数据备份。

### 模块与三个应用

94 个现有模块保持可用：10 商业经营、4 用户社区、10 基础能力、50 类型化校园记录集合、12 连接自动化、8 展示组件。50 个记录集合并不等同于 50 个完整商业产品。模块能力与局限见 `docs/COMMERCIAL_COMMUNITY.md` 和 `docs/VISUAL_MODULES.md`。

Campus Events、Campus Marketplace、Study Buddy 均通过真实浏览器业务操作和本地进程部署，语言切换也已验证。五个声明的验收应用已刷新，复用报告确认同一共享实现。它们由确定性模块组装产生，不是实际模型自主生成；旧账号的其他历史应用不为使报告通过而强制改写。

### 测试证据

- `npm run check`：lint、生产构建、25 项 Node 测试全部通过，0 跳过。
- `npm run e2e`：10 条流程通过；最后的翻译与 Canvas 加载修复后，相关 7 条流程再次通过。
- `npm run verify-postgres`：真实 PostgreSQL 18.4 迁移、并发创建/恢复配额、交易和服务重启持久化通过。
- `npx tsx scripts/audit-studio.ts`：原有账号 23 条路由 × 3 个宽度，共 69 次检查通过。
- 最后生命周期/导出补充测试单独保存日志。测试证据在 `docs/evidence/2026-10-10-followup/`；完整本机截图在 `artifacts/screenshots/`。

最初的缺少 runtime modules、DELETE 空 JSON 请求、字体检查时机、弹窗标题空格和 Canvas 草稿加载竞争等失败均已修复，失败报告保留。原始浏览器 trace 留在忽略的 `.data/followup-*`，避免提交认证请求。

## B. 一次性接入资源

现在无需为这些本地功能提供资源。Agent 接口按用户安排稍后接入。

| 优先级 | 用户最少操作 | 用途 | 配置位置 | 未提供的影响 |
|---|---|---|---|---|
| P0，稍后 | 在本机填写专用模型 Key、模型 ID 和必要的服务地址 | 真实 AI 设计、编程和修复 | `.env`: `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | 需求可保存，真实模型任务 BLOCKED |
| P0，隔离执行 | 安装并启动 Docker Linux Engine，完成系统要求的授权/重启 | 自定义代码隔离构建和运行 | `.env`: `DEPLOYMENT_PROVIDER`, `FOUNDRY_IMAGE` | 本地可信共享模块可运行；生成代码不在控制进程执行 |
| P1，公网发布 | 提供授权测试主机与独立应用域名 | 远程、HTTPS 与域名隔离验收 | 本地 SSH/密钥管理及 `.env`: `APP_DOMAIN`, `PUBLIC_ORIGIN` | 只完成本地运行；没有公网发布 |
| P2，可选 | 填写专用 SMTP 连接串与发件地址 | 外部邮件 | `.env`: `EMAIL_PROVIDER`, `SMTP_URL`, `EMAIL_FROM` | 继续使用本地 outbox，不声称外部投递成功 |

详细获取、验证与最少操作见 `docs/USER_ACTION_REQUIRED.md`。不要在聊天中提交密钥。

## C. 仍存在的工程与安全边界

真实 LLM、自定义新业务代码闭环和 Docker/云部署尚未实测。独立 privileged runner、动态 HTTPS 路由、不可信多租户隔离、任意代码模块抽取/签名/多版本运行仍需工程实现，不能通过填写凭据自动完成。

本地可信进程共享宿主账号，不能开放为不可信用户托管。商业模块没有真实收付款、托管资金或退款；社区还需要完整的举报、封禁与运营审核。当前项目删除保留数据，并没有永久擦除接口。完整风险与后续事项见 `SECURITY_REPORT.md`、`BLOCKERS.md`。

## D. 接入后的验证入口

安全填写本地配置并重启后运行 `npm run verify-integrations`；完整已有验收入口是 `npm run complete-connected`。它会保存每一步结果，返回 2 表示外部资源受阻，1 表示失败，0 表示其覆盖的检查通过。后续会话从 `NEXT_ACTIONS.md` 恢复，继续完成真实生成产物和生产隔离验收。

本轮完成的是已验证的本地功能增量，不宣称整个核心平台达到最初的全部最终验收条件。
