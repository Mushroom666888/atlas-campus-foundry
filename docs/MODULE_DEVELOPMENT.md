# 模块开发与发布

模块契约见 `packages/contracts/src/index.ts` 的 `moduleManifestSchema`。内置模块见 `packages/modules/src/catalog.ts`，能力调用与持久化见 `packages/modules/src/runtime.ts`。模块不是独立复制的应用模板。

## 契约

每个清单声明 moduleId、版本、能力、配置 Schema、提供/依赖接口、版本依赖、迁移、权限、事件、前后端导出名称、健康检查、测试、平台兼容版本、审查及许可证。导出名称表示逻辑接口，不是动态加载不可信源码的路径。

内置模块与平台发布绑定，由本平台维护清单。发布新平台版本时应对不兼容模块更改提升版本并提供迁移；当前仅验证平台 0.1.0 的内置模块版本。注册表允许经审核的扩展保留多个版本。依赖解析使用有预算的约束回溯，检查循环和版本冲突，安装记录持久化精确版本。

当前安装的配置对象为空；任意 JSON Schema 配置编辑器及通用第三方配置解析尚未实现。不要在清单中宣称尚未实现的事件、迁移或权限。

## 已验证的策略提取

在源项目保存 `features/waitlist.json`：

```json
{
  "type": "capacity-waitlist",
  "version": 1,
  "entity": "group",
  "capacityField": "capacity",
  "promotion": "fifo",
  "notify": true
}
```

在模块发布页填写源项目、此路径、一个未占用的标识和 semver 版本。系统读取源文件、验证契约、识别依赖并创建 pending 版本。管理员审核后，独立目标项目可安装。报名/候补/退出/递补真实修改数据库并产生通知。`tests/control.test.ts` 在独立应用中验证该行为，目标工作区没有源项目的契约文件。

`1.0.0 -> 1.1.0 -> 回滚` 的扩展安装路径已测试。源项目、模块所有者、审核者、版本和操作均记录。普通开发者不能批准发布，不能覆盖内置命名空间或其他人的模块版本。

这是支持特定策略的声明式提取，不等同于自动拆解任意业务源码。候补执行器为工程实现，不能作为“模型已经自主生成新功能”的证据。通用可执行模块打包、签名、供应链审查和跨应用任意代码复用尚未完成。

## 自定义代码

工作区有 `src/sdk.d.ts`。后端 `src/feature.ts` 导出 `register(app, context)`，可使用应用专属 db、requireUser 和 APP_* 环境变量。测试放 `src/feature.test.ts`；自定义前端放 `public/`，入口 `/custom/`。这些代码仅在启用且通过门禁的 Docker 应用中加载，不能在本地可信运行模式执行。

必须通过真实 `runBuild` 和 `runTests`；当前主机缺少 Docker，因此上述自定义代码执行契约为 IMPLEMENTED/BLOCKED，不是 TESTED。
