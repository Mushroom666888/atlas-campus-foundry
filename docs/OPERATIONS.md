# 运维与部署

## 启动和数据

- `npm run dev`：构建并启动控制面，自动选取本地空闲端口。
- `npm run deploy-local`：在已运行的控制面中创建/恢复 Events、Marketplace、Study Buddy。
- 默认 `.data/control/` 为控制数据库，`.data/apps/<appId>/db/` 为应用数据库；应用文件和图片也在各自目录。
- `.data/projects/<projectId>/` 为可编辑工作区；`.data/revisions/<projectId>/` 保存文件修改前后内容。
- `.data/artifacts/<deploymentId>/` 包含构件清单、工作区快照、运行配置和日志。
- `DATA_DIR` 可设置独立目录。同一主机的 PGlite 目录受进程锁保护，重复打开会失败；暂停的进程不会因超时失去锁。不同容器或网络共享磁盘不属于此锁的保证范围。

Windows 只对本次已执行环境作兼容承诺。其他系统的启动脚本、Docker 镜像及 Linux 文件权限尚未实测。

## 停止和恢复

前台运行时 Ctrl+C 会关闭控制面和应用进程。应用通过 IPC 监测父进程异常退出并主动停止。再次启动会把未结束的任务/部署标为 interrupted；在 UI 中重试任务或重新创建预览。该流程已通过实际进程终止验收。

单次部署预检失败不会停止当前健康实例。启动后健康检查失败会保留 failed 记录和日志，使用回滚操作恢复上一构件。停止、重启、回滚及移除均保留应用数据。

日志最多保留 128 KB 数据库日志及 2 MB 本地进程日志；Docker 配置单日志 2 MB、2 个轮换文件。自定义 APP_* 变量在返回的应用日志中做已知值脱敏。

## 备份

本地 PGlite 已实现离线快照和实际恢复演练。先停止 Studio（前台 Ctrl+C）；工作台会关闭自己的应用进程。运行中的数据库无法取得备份锁，命令会拒绝操作。应用必须有本版本生成的 storage.json 标记；旧版数据需先运行并正常停止一次，不要手动伪造标记。

```powershell
npm run backup -- create .backups/checkpoint
npm run backup -- verify .backups/checkpoint
npm run backup -- restore .backups/checkpoint .data/restored-checkpoint
$env:DATA_DIR = '.data/restored-checkpoint'
npm run dev
```

备份和恢复目标必须不存在；不会覆盖当前数据。恢复后原账号可登录，历史终态保留，未完成任务/部署标记 interrupted；从 Studio 重新部署，或运行 `npm run deploy-local` 恢复三个样例。旧端口和进程号不会继续使用。要切回原目录，停止恢复环境并执行 `Remove-Item Env:DATA_DIR` 后再启动。

快照包含控制库、各应用数据库/图片、模块/项目/修订、构件、outbox、vault.key 和本地登录文件；不包含 .env、测试数据库或过期访问地址。目录清单保留 PostgreSQL 必需的空目录；每个文件均有 SHA-256 校验。快照含敏感信息且未加密，必须使用受保护本地目录或加密磁盘，不要上传公开存储或提交 Git。校验不是数字签名，仅恢复可信来源的备份。

`npm run verify-backup` 实测了恢复后的账号、业务对象、图片、密钥、文件版本和 HTTP 重启，也检测损坏、路径穿越、运行中数据和终态记录。当前物理恢复仅允许同操作系统；建议使用相同代码版本和 package-lock.json。自动调度、异地加密、保留策略和跨版本迁移仍未完成。

原生/远程 PostgreSQL 应使用 PostgreSQL 官方 `pg_dump`/`pg_restore`，为各应用分配单独数据库和角色。文件备份命令会拒绝外部 PostgreSQL、容器或未知应用存储，避免静默漏备份。测试脚本创建的临时服务器仅供验收，不作为常驻生产服务。容器卷离线备份与 PostgreSQL 服务备份的统一编排尚未实现。

## 容器准备（未在本机执行）

```powershell
npm run image:build
npm run verify-docker
```

隔离构建命令固定，禁用网络，限制 CPU、内存、PID，移除 capability，使用只读容器根目录和非 root 用户。生成代码工作区挂载到 `/opt/foundry/app-workspace`，便于使用镜像中已审核的依赖；不会自动安装任意模型建议的软件包。

应用容器拥有专属数据目录、内部 Docker 网络和有限资源。控制面不应直接持有共享生产 Docker socket；生产仍需独立 runner 服务或专门受控主机。不能把这些 Docker 参数当成已经通过 hostile-tenant 安全验收。

`npm run deploy` 使用 Compose 启动 PostgreSQL 和 Studio，需要先在本地配置 `POSTGRES_PASSWORD`。这是未实测的单机控制面配置；它不自动完成公网应用域名路由。没有执行公网发布、DNS 修改或云资源购买。

## 域名与 HTTPS

本地可信应用采用独立 `app-<uuid>.localhost` 主机名，避免不同端口共享浏览器 Cookie。生成代码部署还要求 `ENABLE_CUSTOM_CODE=true`、`APP_DOMAIN`、HTTPS `PUBLIC_ORIGIN` 和 `COOKIE_SECURE=true`。启用前必须完成独立应用域名、反向代理、Host/Origin 验证、配额和独立 runner 的实际安全审查。

Secure 模式采用 `__Host-` Cookie。当前域名配置校验只是门禁，不等于动态 HTTPS 路由已实现。公共域名路由自动化和证书流程仍是明确的工程待办。
