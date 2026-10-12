# AI Product Agent

模型接口实现为 OpenAI-compatible Chat Completions + function calling，可通过 `LlmProvider` 替换。官方 OpenAI 文档页面在本环境请求均返回 403；适配器已按兼容协议实现，不能据此声称获得了官方在线文档确认或真实服务验证。

## 配置

在忽略提交的 `.env` 中填写 `LLM_API_KEY`、`LLM_MODEL`，需要兼容服务时修改 `LLM_BASE_URL`。HTTPS 用于远程服务；纯 HTTP 仅允许 localhost 模型服务。代码不内置 API Key，不向浏览器返回密钥。

重启 Studio 后运行 `npm run verify-integrations`。它会发出一次真实工具调用请求，检测实际模型是否支持 function calling。该调用可能产生提供商正常费用，只有配置了对应凭据和模型才会发出。

## 工具与执行

工具定义在 `server/agent.ts`，包含 inspectProject、searchModules、inspectModule、selectModules、resolveDependencies、createApplication、readProjectFiles、writeProjectFiles、generateCustomFeature、runBuild、runTests、inspectLogs、diagnoseError、createPreview、requestDeployment、extractReusableModule、validateModule。

工具输入由 Zod 验证；返回真实服务结果或带 code/message 的失败。每次调用参数、结果和时间存入 job_events，规格存入 jobs.plan，文件改动保存版本。任务刷新页面后仍可读取。缺凭据时创建 blocked 任务，不返回假生成结果。

默认最多 18 步，硬上限 40 步，累计 3 次工具失败后停止修复。单个账号最多 3 个排队/执行任务，单 worker 最多 3 个活动任务。取消会中止模型请求，停止服务会留下 interrupted 状态。自定义模型文本、仓库内容和模块文档不能扩大工具权限。

模型声明完成不直接等于 succeeded：必须有成功预览；写过自定义文件的任务还必须有最后修改之后成功的构建和测试。规格或模块变动会使旧验证结果失效。

## 文件读取、并发修改与恢复

`readProjectFiles` 支持 `offset` 和 `maxChars`（默认及上限 8000）。每个文件返回完整文件的 SHA-256 `hash`、本次内容、`offset`、`nextOffset` 和 `totalChars`。读取较大文件时继续按 `nextOffset` 分页，不要把第一页当成整个文件。

`writeProjectFiles` 的每个文件必须携带 `expectedHash`：修改现有文件使用最后读到的完整哈希；仅新建文件使用 `null`。版本不匹配会拒绝写入并保留用户修改，Agent 应重新读取、理解差异，再提交合并结果。HTTP 文件编辑也使用同一协议。`product.json` 由产品规格和 Canvas 管理，不能通过文件工具直接覆盖。

一个批次可能有前面的文件写入成功、后面的文件冲突。工具会记录已经写入的路径，旧构建/测试/预览证据在变更尝试前即失效。文件历史和恢复只对项目所有者开放，恢复产生新版本。当前互斥锁仅覆盖单个控制进程，不宣称已经实现跨进程协作事务。

产品规格可包含 `requirements.roles`、`requirements.models`、`requirements.scenarios`；角色、模型引用和关联模块由契约校验。它们用于开发计划和需求追踪，场景状态保持 `NOT_RUN`，不把保存需求当成业务验收成功。

## 证据区别

- TESTED：真实工具、权限、文件持久化、任务日志、修复预算、旧预览失效。
- CONTRACT TEST ONLY：`ScriptedContractProvider` 仅存在于测试文件，驱动真实工具；不是实际 LLM。
- BLOCKED：真实 LLM 生成与修复、Docker 内编译测试、自定义运行时和前端的完整验收。
- PLANNED：更严格的 token/费用预算、长期任务租约、多 worker、生成代码质量评估和全面提示注入红队测试。

`npm run verify-live-agent` 已准备真实服务工作流入口，保存所有调用证据。它不把脚本化响应作为模型成功，且不替代独立生成产物的业务 API/浏览器验收。该最终验收在资源接入后仍需继续完成。
