# Atlas 商业模块与社区交付记录

2026-10-10，Windows / Node 24.17.0。工程目录：`C:\Users\14237\Desktop\Campus AI App Foundry`。

## A. 自主完成与真实验收

- **IMPLEMENTED / TESTED**：94 个内置模块，分类搜索、筛选、详情、明确标记的交互示例、接口与依赖说明、`+模块名` 引用。分类为 10 商业、4 社区、10 基础、50 校园记录功能、12 连接器、8 展示组件。50 个早期校园模块属于类型化记录集合，不是 50 套完整商业引擎。
- **IMPLEMENTED / TESTED**：商家店铺、商品货架、库存、订单、交付、服务预约、交易评价、优惠券、收藏、经营统计。价格确认、库存并发、幂等下单、取消恢复、买卖双方权限和真实 SQL 持久化经过验证。仅支持线下结算。
- **IMPLEMENTED / TESTED**：可复用论坛、个人主页、产品展示和用户目录。用户自填学校、简介、标签；公开接口不返回登录邮箱。Atlas 和生成应用使用同一实现，各有独立账号、数据和会话。已有私聊、登录、媒体和通知模块继续共用。
- **IMPLEMENTED / TESTED**：Canvas v2 要求产品描述，分技术底座、产品业务、自动化、展示四层；自动补齐依赖并显示连线，错误连线标红，无效结构不能保存或生成。真实端口拖拽、分支删除、刷新、嵌入、通知和部署均有测试。通过结构校验不等于自然语言需求已经被模型理解。
- **IMPLEMENTED / TESTED**：首页背景轻微运动，离屏/后台暂停，遵循减少动态偏好；现有 ATLAS 字标和字体可读性修复保留。
- **DEPLOYED locally / TESTED**：Campus Events、Campus Marketplace、Study Buddy、校园失物协作台、Campus Commerce 均已更新本地运行版本。五个应用共享同一份模块源码，独立持久化；商业应用安装 18 个模块（含递归基础依赖），没有虚构商家/帖子。

入口：`http://127.0.0.1:3000`，模块 `/modules`，画布 `/compose`，社区 `/community`。商业应用当前入口在 `.data/commercial-showcase.json`，重启/重部署可能换端口。启动命令为 `npm run dev`；随后 `npm run deploy-local`、`npm run deploy-visual`、`npm run deploy-commerce` 恢复验收应用。

测试：`npm run check` 通过 lint、构建和 **21 项 Node 测试**；`npm run e2e` **7/7**；增强截图就绪条件后社区/Canvas **2/2**；既有账号 **69/69** 路由/视口检查；原生 PostgreSQL 18.4 验证迁移、最后一件商品的并发下单和数据库服务重启；依赖审计 0 通告。证据见 [本轮证据](evidence/2026-10-10-commerce/README.md) 和 [测试报告](../TEST_REPORT.md)。

## B. 集中外部依赖

| 优先级 | 用户资源 | 最少操作与配置位置 | 不提供的影响 |
|---|---|---|---|
| P0 | 支持工具调用的模型服务 | 在本机 `.env` 填入 `LLM_API_KEY`、`LLM_MODEL`；兼容服务另填 `LLM_BASE_URL` | 真实自主生成/修复仍 BLOCKED，模块组装可用 |
| P0 | Docker Linux Engine | 安装/启动 Docker Desktop，完成必要的系统授权；后续镜像与测试由工程流程执行 | 无法验收不可信生成代码隔离，宿主运行门禁保持关闭 |
| P1 | 公网测试主机与独立域名授权 | 通过本地密钥/授权配置资源；详细项见接入清单 | 不可公开托管；仍需完成 runner/TLS 工程 |
| P2 可选 | SMTP | 本机填 `SMTP_URL`、`EMAIL_FROM`、`EMAIL_PROVIDER=smtp` | 邮件仅进入本地 outbox |

不要在聊天中发送密钥。准确获取、配置和验证说明见 [USER_ACTION_REQUIRED.md](USER_ACTION_REQUIRED.md)。当前没有支付凭据需求，因为在线收款尚未实现。

## C. 未完成与边界

- **BLOCKED**：真实 LLM、自定义代码 Docker 运行及外部 SMTP；本轮连接检查确认这些服务未接通。Agent 契约测试使用明确的脚本 Provider，不代表真实模型生成成功。
- **PLANNED**：在线收款、托管/退款/佣金/对账；大历史数据完整分页；举报、封禁和运营审核；通用可执行模块提取签名与多版本运行；独立 runner、TLS、操作系统级租户限额及公网安全验收。
- **保留的失败结果**：无参数 `npm run reuse-report` 对所有历史应用检查时，另一账号的旧应用源码版本不一致。没有绕过所有权更新它。`--showcase` 明确只验收五个声明的样例并通过，报告仍列出范围外旧应用。
- 当前运行模式只允许平台自带的可信模块，不能对外承诺生产级隔离或“任意拖拽一定能生成正确商业产品”。无公网部署，无真实资金流转。

## D. 接入后的收尾

`npm run verify-integrations` 检查配置；`npm run complete-connected` 连续运行已有验收、Docker 和实际模型流程，保存每步结果。资源连接后仍需根据实际模型产物完成独立业务/浏览器验收，并继续实现上述生产工程。恢复入口为 `NEXT_ACTIONS.md`，不会在会话结束后自动无限执行。
