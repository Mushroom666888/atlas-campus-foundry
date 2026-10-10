# 集中接入清单

本地平台、数据库、三个应用和现有验收已经可以运行。不要在聊天中发送 API Key、密码或私钥。已建立忽略 Git 的 `.env`，只需在本机填写对应字段。

本次的项目删除/恢复、中英文切换、模块编辑和独立 ZIP 导出不需要额外凭据。导出包的本地安装、启动与重启持久化已经实际验证。先描述想法的 Canvas 会保存需求，但真实 AI 设计仍等待模型接入；用户已说明 Agent 接口稍后配置，因此不会以此阻止其他功能交付。导出包的云部署配置已提供，尚未运行 Docker 验收。

导出包使用自己的 `.env.example`：`RUNTIME_PORT`/`RUNTIME_HOST` 控制本地监听，`RUNTIME_PUBLIC_ORIGIN`/`COOKIE_SECURE` 控制访问与 Cookie，`APP_DATABASE_URL` 可接独立 PostgreSQL；缺省使用包内 `app-data`。邮件可选字段为 `EMAIL_PROVIDER`/`SMTP_URL`/`EMAIL_FROM`。这些值不会从平台导出。解压目录中的 `npm run verify` 读取 `.env` 并检查本地运行服务；`npm run deploy` 启动该包的 Compose，执行前仍需本机具备 Docker。Compose 默认固定映射本机 4100 端口；公网 TLS/反向代理需要独立配置，不会由导出自动完成。

| 优先级 | 需要什么 / 最少操作 | 用途与必要性 | 本地替代 | 配置位置 | 自动验证 | 不提供的影响 |
|---|---|---|---|---|---|---|
| P0 | 从支持 function calling 的模型服务控制台创建专用 API Key，并复制实际可用的模型 ID | 核心 AI 自主生成和修复的必要资源 | 可用的本地 OpenAI-compatible 模型；本机未发现已运行模型 | .env: LLM_API_KEY, LLM_MODEL；非默认服务另填 LLM_BASE_URL | npm run verify-integrations；随后 npm run verify-live-agent | AI 任务保存为 BLOCKED；模块组装、数据库和应用仍可使用 |
| P0 | 安装/启动 Docker Desktop 的 Linux Engine；如系统要求，完成管理员授权或重启 | 隔离编译、测试及生成代码运行必需 | 已验证的 local-trusted 仅运行平台自带代码，不能替代不可信代码隔离 | .env: DEPLOYMENT_PROVIDER=docker, FOUNDRY_IMAGE=campus-foundry:local | npm run image:build，然后 npm run verify-docker | 自定义代码可保存，但禁止在宿主控制服务执行 |
| P1 | 提供有权使用的独立应用域名和测试主机授权；凭据放本地 SSH/密钥管理中 | 非可信应用和公网 HTTPS 的资源条件 | 当前本地可信应用使用独立 *.localhost 主机名 | .env: APP_DOMAIN, PUBLIC_ORIGIN=https://实际工作台域名, COOKIE_SECURE=true | 隔离/域名工程完成后由 Codex 运行部署与浏览器测试 | 本地可信预览继续可用；不能开放公共托管 |
| P2，可选 | 提供 SMTP 连接串和已验证发件地址 | 真实邮箱投递；不是本地密码账号运行的必要条件 | 真实本地 outbox 文件，明确标记没有外部投递 | .env: EMAIL_PROVIDER=smtp, SMTP_URL, EMAIL_FROM | npm run verify-integrations 仅验证连接，不自动给他人发邮件 | 邮件留在本地 outbox；不能声称完成真实邮箱投递验证 |

## 获取与配置说明

- 模型：使用你有授权的提供商控制台创建专用凭据，确认模型支持 tools/function calling。默认 base URL 是 https://api.openai.com/v1。验证会发出真实请求，可能产生服务正常费用；当前没有凭据，因此未发生此类调用。
- Docker：Windows 需要满足 Docker Desktop 的 WSL2/虚拟化条件。当前主机没有安装 WSL/Docker。操作系统授权/重启由用户完成；无需用户编写工程代码。安装后镜像构建、隔离测试和修复由 Codex 继续完成。
- 域名/主机：只需要提供授权资源，不要求用户手工实现 runner 或反向代理。**动态 HTTPS 路由和独立 runner 是仍需 Codex 完成的工程，不能伪装成填一个环境变量即完成。** ENABLE_CUSTOM_CODE 保持 false，直到这些边界经过实际测试。
- SMTP：使用专用应用密码/令牌，不使用主邮箱密码。不要把 SMTP_URL 写进项目源码或日志。真实投递验收需要明确的收件人授权，当前未发送任何外部邮件。

不需要 GitHub 授权即可使用已有调研结果。不需要地图 API Key：当前只使用用户填写的坐标与 OpenStreetMap 链接。不需要外部 PostgreSQL：本地 PGlite 和原生 PostgreSQL 18.4 适配器已经验证。

## 完成连接后的统一入口

1. 修改本机 .env 后重启 Studio。
2. `npm run complete-connected` 依次运行已有本地验收、实际外部服务检查、Docker 执行器和真实模型工作流。每一步的日志和状态写入 artifacts/acceptance/，某一步 BLOCKED 不会阻止其他步骤记录结果。
3. 返回码 0 表示该命令覆盖的检查全部通过，1 表示失败，2 表示外部接入受阻。它不代表尚未实现的生产工程或通用模块生态被自动补齐。
4. 后续 Codex 读取 NEXT_ACTIONS.md，完成实际模型生成产物的独立业务/浏览器验收、通用代码模块提取和生产边界。不需要用户充当测试工程师。
