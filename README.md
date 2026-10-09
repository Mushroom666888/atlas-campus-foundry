# Atlas / Campus AI App Foundry

可运行的校园应用开发工作台：真实账号、项目、模块注册、应用数据库、业务模块、开发任务、预览、部署记录和受控模块发布。

内置 **80 个模块**：10 个基础能力、50 个校园功能、12 个连接器、8 个展示组件。支持分类搜索筛选、模块详情/界面示例/接口图、`+模块名` 引用以及无需提示词的拖拽、连接、嵌入和真实应用部署。参见 [可视化模块体系](docs/VISUAL_MODULES.md) 和 [Atlas 设计与来源](docs/ATLAS_DESIGN.md)。

**当前不是完整核心平台验收通过状态。** 三个校园产品和独立画布应用已通过确定性模块组装运行和测试；真实 LLM 自主生成、Docker 隔离执行与公开多租户托管尚未验证。详见 [PROJECT_STATUS.md](PROJECT_STATUS.md)、[最新交付报告](docs/ATLAS_DELIVERY.md) 和 [人工接入清单](docs/USER_ACTION_REQUIRED.md)。

## 本机使用

已在 Windows + Node.js 24.17.0 验证：

```powershell
npm ci
npm run dev
```

也可双击 `Start-Local.cmd`。首次会安装依赖并构建；默认访问 `http://127.0.0.1:3000`，端口占用时自动换到后续空闲端口。实际地址保存在 `.data/local-running.json`。

当前会话已启动工作台及三个应用。打开工作台后，使用 `.data/local-access.json` 中的本地账户登录。这个文件包含随机生成的本地密码，不会提交到 Git，也不要发送到聊天。三个验收应用使用同一组本地登录信息，但分别拥有自己的账号数据库。

```powershell
# 工作台运行后，创建/恢复三个确定性组装的本地产品
npm run deploy-local
npm run deploy-visual
```

应用地址保存在 `.data/showcase.json`，也可在「应用部署」中打开。示例内容明确标注为样例，通过真实 API 写入持久化数据库，不是 Mock 响应。

## 验证命令

| 命令 | 实际作用 |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | 类型检查 + Vite 生产构建 |
| `npm test` | 真实数据库、权限、模块、Agent 工具与进程部署集成测试 |
| `npm run e2e` | Chromium 操作工作台和三个应用，桌面/移动端截图 |
| `npm run verify-postgres` | Windows 原生 PostgreSQL 18.4 临时集群、迁移及服务重启验证 |
| `npm run verify-recovery` | 控制进程异常终止、子进程回收和持久状态恢复 |
| `npm run verify-backup` | 离线备份、异地目录恢复、真实应用重启、数据/图片/密钥保留和进程锁验证 |
| `npm run backup -- create` | 服务停止后生成本地快照；详见运维文档的校验与恢复命令 |
| `npm run reuse-report` | 检查三个本地应用的模块锁及共享源文件哈希 |
| `npm run acceptance` | 连续执行上述适用验收并保存每条命令的日志 |
| `npm run verify-integrations` | 真实模型工具调用、Docker、数据库与邮件连接；缺配置返回 2 |
| `npm run verify-docker` | 真实 Docker 内编译和执行自定义 TypeScript；无 Docker 返回 2 |
| `npm run verify-live-agent` | 真实模型生成任务；缺少必要接入返回 2，绝不模拟成功 |
| `npm run complete-connected` | 全部现有验收及外部连接依次执行；受阻步骤不阻止其他步骤记录结果 |

首次浏览器安装：`npx playwright install chromium`。本机已经执行成功。测试详情和截图位于 `artifacts/`，故障证据位于 `artifacts/failures/`。

## 工程结构

```text
web/                   中文 Studio + 共享应用前端
server/                控制面、Agent、权限、部署、Provider
packages/contracts/    模块清单、产品规格、数据契约
packages/modules/      80 个基础/校园/连接/展示模块的共享实现
packages/sdk/          隔离应用扩展类型契约
migrations/            control 与 runtime 的独立 SQL 迁移
tests/                 模块、API、数据库、Agent、部署及浏览器测试
scripts/               调研、启动、验收、复用检查、延迟接入验证
docs/research/         72 个研究样本、原始证据及许可证筛查
.data/                 本机数据库、应用数据、文件版本、密钥与构件（忽略）
```

技术版本锁定在 `package-lock.json`。不依赖 Redis；任务与事件保存在 SQL 中。默认使用真实持久化 PGlite/PostgreSQL，也支持 `DATABASE_URL` 指向服务器 PostgreSQL。原生 PostgreSQL 验收不要求 Docker。

## 接入与运维

- [架构](ARCHITECTURE.md)
- [用户操作](docs/USER_GUIDE.md)
- [运维与部署](docs/OPERATIONS.md)
- [模块开发与发布](docs/MODULE_DEVELOPMENT.md)
- [Agent 配置](docs/AGENT_GUIDE.md)
- [安全边界](SECURITY_REPORT.md)
- [测试与失败记录](TEST_REPORT.md)
- [下一步与恢复](NEXT_ACTIONS.md)

`Dockerfile` 和 `compose.yaml` 已提供，但当前主机无 Docker，不能声称已通过容器部署。Compose 是控制面与数据库的起点，不包含已经验收的生产应用路由或独立 runner。不要将本地可信进程模式直接开放给不可信开发者。
