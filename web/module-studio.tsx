import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Code2,
  Database,
  GitBranch,
  LayoutGrid,
  List,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import type { ModuleManifest } from "../packages/contracts/src/index";
import { moduleReferences } from "../packages/modules/src/composition";
import { post, useLoad } from "./api";
import { Empty, Loading, Notice, useAction } from "./components";
import { FieldInput, RecordModule } from "./record-module";
import { FoundationPreview } from "./foundation-preview";

export const categoryLabels: Record<string, string> = {
  foundation: "基础能力",
  campus: "校园功能",
  scenario: "校园功能",
  connector: "连接自动化",
  presentation: "展示组件",
  extension: "社区扩展",
};
export function ModuleIcon({
  module,
  size = 22,
}: {
  module: Pick<ModuleManifest, "moduleId" | "category" | "tags">;
  size?: number;
}) {
  const Icon =
    module.category === "connector"
      ? Workflow
      : module.category === "presentation"
        ? LayoutGrid
        : module.moduleId === "chat"
          ? MessageCircle
          : module.moduleId === "notifications"
            ? Bell
            : module.moduleId === "identity"
              ? ShieldCheck
              : module.tags.includes("课程学习")
                ? BookOpen
                : module.moduleId === "groups"
                  ? Users
                  : Boxes;
  return (
    <span className={`module-glyph ${module.category}`}>
      <Icon size={size} />
    </span>
  );
}
export function ModuleExplorer() {
  const registry = useLoad<{ items: ModuleManifest[] }>("/api/modules");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [tag, setTag] = useState("all"),
    [view, setView] = useState("grid");
  const modules = registry.data?.items || [];
  const unique = modules.filter(
    (m, i) => modules.findIndex((a) => a.moduleId === m.moduleId) === i,
  );
  const tags = [...new Set(unique.flatMap((m) => m.tags))];
  const filtered = unique.filter(
    (m) =>
      (category === "all" ||
        (category === "campus"
          ? ["campus", "scenario"].includes(m.category)
          : category === "extension"
            ? m.securityMetadata.review !== "platform"
            : m.category === category)) &&
      (tag === "all" || m.tags.includes(tag)) &&
      `${m.name} ${m.moduleId} ${m.description} ${m.aliases.join(" ")} ${m.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="module-explorer">
      <div className="section-head module-page-heading">
        <div>
          <span className="eyebrow">MODULE LIBRARY</span>
          <h1>模块仓库</h1>
          <p className="muted">
            {
              unique.filter((m) => m.securityMetadata.review === "platform")
                .length
            }{" "}
            个内置模块 ·{" "}
            {
              unique.filter((m) => m.securityMetadata.review !== "platform")
                .length
            }{" "}
            个社区模块
          </p>
        </div>
        <Link className="button primary" to="/compose">
          <GitBranch size={17} />
          可视化编排
        </Link>
      </div>
      <div
        className="module-category-tabs"
        role="tablist"
        aria-label="模块分类"
      >
        {[
          "all",
          "foundation",
          "campus",
          "connector",
          "presentation",
          "extension",
        ].map((id) => (
          <button
            role="tab"
            aria-selected={category === id}
            className={category === id ? "selected" : ""}
            key={id}
            onClick={() => setCategory(id)}
          >
            {id === "all" ? "全部模块" : categoryLabels[id]}
          </button>
        ))}
      </div>
      <div className="toolbar module-filters">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="搜索模块"
            placeholder="搜索名称、能力、+模块名"
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/^\+/, ""))}
          />
        </div>
        <select
          aria-label="按领域筛选"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="all">全部领域</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="muted">{filtered.length} 个结果</span>
        <div className="segmented">
          <button
            title="网格"
            aria-label="网格"
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            title="列表"
            aria-label="列表"
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {registry.loading && <Loading />}
      {registry.error && <Notice>{registry.error}</Notice>}
      <div className={view === "grid" ? "catalog-grid" : "catalog-list"}>
        {filtered.map((module) => (
          <article className="catalog-card" key={module.moduleId}>
            <Link
              to={`/modules/${module.moduleId}`}
              className="catalog-card-main"
            >
              <div className="catalog-card-top">
                <ModuleIcon module={module} />
                <span className="category-caption">
                  {categoryLabels[module.category]}
                </span>
              </div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <div className="catalog-tags">
                {module.tags.slice(0, 2).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </Link>
            <footer>
              <code>+{module.moduleId}</code>
              <Link
                title={`编排${module.name}`}
                aria-label={`编排${module.name}`}
                to={`/compose?add=${module.moduleId}`}
                className="icon-button"
              >
                <Plus size={17} />
              </Link>
              <Link
                title={`查看${module.name}`}
                aria-label={`查看${module.name}`}
                to={`/modules/${module.moduleId}`}
                className="icon-button"
              >
                <ChevronRight size={17} />
              </Link>
            </footer>
          </article>
        ))}
      </div>
      {!registry.loading && !filtered.length && <Empty>没有匹配的模块</Empty>}
    </div>
  );
}
export function ModuleDetail() {
  const { moduleId } = useParams(),
    registry = useLoad<{ items: ModuleManifest[] }>("/api/modules");
  const projects = useLoad<{
    items: { id: string; name: string; spec: { modules: string[] } }[];
  }>("/api/projects");
  const [tab, setTab] = useState("preview"),
    [project, setProject] = useState("");
  const action = useAction(),
    module = registry.data?.items.find((m) => m.moduleId === moduleId);
  if (registry.loading) return <Loading />;
  if (!module) return <Notice>模块不存在或无访问权限</Notice>;
  const endpoint = module.recordDefinition
    ? `/api/modules/${module.moduleId}/records`
    : (
        {
          identity: "/api/auth/register",
          chat: "/api/conversations",
          notifications: "/api/notifications",
          media: "/api/uploads",
          search: "/api/entities?q=关键词",
        } as Record<string, string>
      )[module.moduleId] || "/api/entities";
  return (
    <div className="module-detail-page">
      <Link className="back-link" to="/modules">
        <ArrowLeft size={16} />
        模块仓库
      </Link>
      <div className="module-detail-heading">
        <ModuleIcon module={module} size={30} />
        <div>
          <div className="inline-actions">
            <span className="category-caption">
              {categoryLabels[module.category]}
            </span>
            <span className="muted">v{module.version}</span>
          </div>
          <h1>{module.name}</h1>
          <p>{module.description}</p>
        </div>
        <div className="detail-actions">
          <Link
            className="button primary"
            to={`/compose?add=${module.moduleId}`}
          >
            <Plus size={16} />
            加入画布
          </Link>
          <Link className="button" to={`/builder?modules=${module.moduleId}`}>
            <Code2 size={16} />+ 引用模块
          </Link>
        </div>
      </div>
      <div className="module-detail-layout">
        <section>
          <div className="tabs">
            {[
              ["preview", "界面预览"],
              ["interfaces", "接口与数据"],
              ["dependencies", "依赖与权限"],
            ].map(([id, name]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === "preview" && (
            <div className="module-preview-frame">
              <div className="preview-chrome">
                <span />
                <span />
                <span />
                <code>{module.name}</code>
              </div>
              <div className="module-preview-body">
                {module.recordDefinition ? (
                  <RecordModule key={module.moduleId} module={module} preview />
                ) : (
                  <CapabilityPreview module={module} />
                )}
              </div>
            </div>
          )}
          {tab === "interfaces" && (
            <div className="interface-panel">
              <h2>连接接口</h2>
              <div className="interface-diagram">
                <div>
                  <small>输入</small>
                  <strong>
                    {module.category === "connector"
                      ? "记录事件 / 上游结果"
                      : module.recordDefinition
                        ? "账号 + 表单字段"
                        : "用户操作"}
                  </strong>
                </div>
                <ArrowRight />
                <div>
                  <ModuleIcon module={module} />
                  <strong>{module.name}</strong>
                </div>
                <ArrowRight />
                <div>
                  <small>输出</small>
                  <strong>
                    {module.category === "presentation"
                      ? "交互界面"
                      : module.category === "connector"
                        ? "条件结果 / 受控动作"
                        : "记录 + 状态 + 事件"}
                  </strong>
                </div>
              </div>
              {module.recordDefinition ? (
                <>
                  <h3>数据字段</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>字段键</th>
                        <th>类型</th>
                        <th>约束</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{module.recordDefinition.titleLabel}</td>
                        <td>title</td>
                        <td>text</td>
                        <td>必填，160 字符</td>
                      </tr>
                      {module.recordDefinition.fields.map((field) => (
                        <tr key={field.key}>
                          <td>{field.label}</td>
                          <td>
                            <code>{field.key}</code>
                          </td>
                          <td>{field.type}</td>
                          <td>
                            {field.options?.join(" / ") ||
                              (field.required ? "必填" : "选填")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="endpoint-list">
                    {[
                      ["GET", "", "读取与搜索"],
                      ["POST", "", "创建记录"],
                      ["GET", "/:id", "读取详情"],
                      ["PATCH", "/:id", "更新 / 状态 / 归档"],
                    ].map(([method, suffix, label]) => (
                      <details key={method + suffix}>
                        <summary>
                          <b>{method}</b>
                          <code>
                            {endpoint}
                            {suffix}
                          </code>
                          <span>{label}</span>
                        </summary>
                        <pre>
                          {JSON.stringify(
                            method === "GET"
                              ? {
                                  query: {
                                    q: "",
                                    status: "",
                                    contextId: "optional UUID",
                                  },
                                  response: "items + counts / record",
                                }
                              : {
                                  title: module.recordDefinition!.titleLabel,
                                  data: Object.fromEntries(
                                    module.recordDefinition!.fields.map((f) => [
                                      f.key,
                                      f.type,
                                    ]),
                                  ),
                                  status: module.recordDefinition!.statuses,
                                  contextId: "optional parent UUID",
                                },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3>
                    {["connector", "presentation"].includes(module.category)
                      ? "编排契约"
                      : "API 入口"}
                  </h3>
                  <code>
                    {["connector", "presentation"].includes(module.category)
                      ? module.providedInterfaces.join(" · ")
                      : endpoint}
                  </code>
                  {module.configurationFields.map((field) => (
                    <p key={field.key}>
                      <strong>{field.label}</strong> <code>{field.key}</code> ·{" "}
                      {field.type}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
          {tab === "dependencies" && (
            <div className="interface-panel">
              <h2>依赖模块</h2>
              {Object.keys(module.dependencies).length ? (
                Object.entries(module.dependencies).map(([id, version]) => (
                  <Link
                    className="dependency-row"
                    key={id}
                    to={`/modules/${id}`}
                  >
                    <Boxes size={18} />
                    {registry.data!.items.find((m) => m.moduleId === id)
                      ?.name || id}
                    <code>{version}</code>
                    <ArrowRight size={16} />
                  </Link>
                ))
              ) : (
                <p>无额外依赖</p>
              )}
              <h3>权限</h3>
              {module.requiredPermissions.map((permission) => (
                <p key={permission}>
                  <ShieldCheck size={15} /> <code>{permission}</code>
                </p>
              ))}
              <h3>运行方式</h3>
              <p>
                {module.recordDefinition
                  ? "标准数据模块，所有写入进行字段验证；仅创建者可修改。"
                  : "平台受控的共享实现。"}
              </p>
              <p>
                {module.recordDefinition?.visibility === "owner"
                  ? "记录仅所属账号可读取。"
                  : "应用之间使用独立数据库。"}
              </p>
              <details>
                <summary>完整模块契约</summary>
                <pre>{JSON.stringify(module, null, 2)}</pre>
              </details>
            </div>
          )}
        </section>
        <aside className="module-detail-aside">
          <h3>安装模块</h3>
          <label>
            目标项目
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">选择项目</option>
              {projects.data?.items.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {action.error && <Notice>{action.error}</Notice>}
          {action.message && <Notice kind="success">{action.message}</Notice>}
          <button
            className="primary"
            disabled={
              !project ||
              action.busy ||
              module.securityMetadata.review === "pending"
            }
            onClick={() =>
              void action.run(async () => {
                const current = projects.data!.items.find(
                  (p) => p.id === project,
                )!;
                await post(`/api/projects/${project}/modules`, {
                  modules: [
                    ...new Set([...current.spec.modules, module.moduleId]),
                  ],
                });
                await projects.refresh();
              }, "模块及依赖已安装")
            }
          >
            <Plus size={16} />
            安装到项目
          </button>
          <hr />
          <dl>
            <dt>引用标识</dt>
            <dd>
              <code>+{module.moduleId}</code>
            </dd>
            <dt>许可证</dt>
            <dd>{module.license}</dd>
            <dt>实现</dt>
            <dd>
              {module.recordDefinition
                ? "结构化业务模块"
                : module.category === "connector"
                  ? "受控连接节点"
                  : module.category === "presentation"
                    ? "数据驱动组件"
                    : "共享基础能力"}
            </dd>
          </dl>
          <Link to={`/compose?add=${module.moduleId}`}>
            配置连接 <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function CapabilityPreview({ module }: { module: ModuleManifest }) {
  const [settings, setSettings] = useState<Record<string, unknown>>({}),
    [message, setMessage] = useState(""),
    [messages, setMessages] = useState(["欢迎加入校园交流"]),
    [done, setDone] = useState(false);
  if (
    [
      "events",
      "groups",
      "profiles",
      "content",
      "search",
      "media",
      "campus",
    ].includes(module.moduleId)
  )
    return <FoundationPreview module={module} />;
  if (["connector", "presentation"].includes(module.category))
    return (
      <div className="capability-preview">
        <span className="muted">组件预览 · 未连接应用数据</span>
        <div className="connection-preview">
          <span className="port-dot" />
          <div>
            <ModuleIcon module={module} />
            <h3>{module.name}</h3>
          </div>
          <span className="port-dot output" />
        </div>
        {module.configurationFields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={settings[field.key]}
            onChange={(v) => setSettings({ ...settings, [field.key]: v })}
          />
        ))}
        <Link className="button" to={`/compose?add=${module.moduleId}`}>
          在画布配置 <ArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="capability-preview">
      <small className="muted">交互示例 · 不向服务器提交</small>
      <h2>{module.name}</h2>
      {module.moduleId === "chat" ? (
        <>
          <div className="sample-messages">
            {messages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) setMessages([...messages, message]);
              setMessage("");
            }}
          >
            <input
              aria-label="预览消息"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="输入消息"
            />
            <button className="primary">发送</button>
          </form>
        </>
      ) : module.moduleId === "identity" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <label>
            邮箱
            <input type="email" required placeholder="student@example.edu" />
          </label>
          <label>
            密码
            <input type="password" required minLength={10} />
          </label>
          <button className="primary">预览登录</button>
          {done && (
            <Notice kind="info">表单校验通过。此预览未创建会话。</Notice>
          )}
        </form>
      ) : module.moduleId === "notifications" ? (
        <button className="preview-notification" onClick={() => setDone(!done)}>
          <Bell size={21} />
          <span>
            你的活动报名已记录<small>{done ? "已读" : "未读"}</small>
          </span>
          {done && <Check size={18} />}
        </button>
      ) : (
        <>
          <div className="interface-diagram">
            <Database />
            <div>
              <strong>{module.name}</strong>
              <p>{module.description}</p>
            </div>
            <ArrowRight />
          </div>
          <label>
            {module.moduleId === "search" ? "搜索内容" : "名称"}
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={module.name}
            />
          </label>
          <button onClick={() => setDone(true)}>
            预览{module.moduleId === "search" ? "搜索" : "提交"}
          </button>
          {done && (
            <p className="preview-notification">
              {message || module.name} · 本页示例
            </p>
          )}
          <Link to={`/compose?add=${module.moduleId}`}>
            创建实际运行实例 <ArrowRight size={15} />
          </Link>
        </>
      )}
    </div>
  );
}

export function ModuleMentionInput({
  name,
  seed = "",
  rows = 4,
}: {
  name: string;
  seed?: string;
  rows?: number;
}) {
  const registry = useLoad<{ items: ModuleManifest[] }>("/api/modules"),
    [value, setValue] = useState(seed),
    [open, setOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const modules =
    registry.data?.items.filter(
      (m) => m.securityMetadata.review !== "pending",
    ) || [];
  const token = value.match(/\+([^\s+]*)$/)?.[1];
  const suggestions = modules
    .filter((m) =>
      `${m.name} ${m.moduleId} ${m.aliases.join(" ")}`
        .toLowerCase()
        .includes((token || "").toLowerCase()),
    )
    .slice(0, 8);
  const references = moduleReferences(value, modules);
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => {
      setValue("");
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  function add(id: string) {
    setValue(
      token !== undefined
        ? value.replace(/\+[^\s+]*$/, `+${id} `)
        : `${value}${value ? " " : ""}+${id} `,
    );
    setOpen(false);
    ref.current?.focus();
  }
  return (
    <div className="mention-input">
      <textarea
        ref={ref}
        name={name}
        value={value}
        required
        minLength={5}
        maxLength={12000}
        rows={rows}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(/\+[^\s+]*$/.test(e.target.value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (open && e.key === "ArrowDown") {
            e.preventDefault();
            (
              e.currentTarget.parentElement?.querySelector(
                ".mention-option",
              ) as HTMLButtonElement
            )?.focus();
          }
        }}
        placeholder="例如：校园失物平台 +失物招领 +聊天 +通知"
      />
      <div className="mention-footer">
        <div className="reference-chips">
          {references.moduleIds.map((id) => (
            <span key={id}>
              +{modules.find((m) => m.moduleId === id)?.name}
            </span>
          ))}
          {references.unknown.map((id) => (
            <span className="unresolved" key={id}>
              未识别：{id}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          title="引用模块"
          aria-label="引用模块"
          onClick={() => setOpen(!open)}
        >
          <Plus size={18} />
        </button>
      </div>
      {open && (
        <div className="mention-menu" role="listbox" aria-label="选择引用模块">
          {suggestions.map((m) => (
            <button
              className="mention-option"
              type="button"
              key={m.moduleId}
              onClick={() => add(m.moduleId)}
            >
              <ModuleIcon module={m} size={16} />
              <span>
                {m.name}
                <small>+{m.moduleId}</small>
              </span>
            </button>
          ))}
          {!suggestions.length && <p>没有匹配模块</p>}
        </div>
      )}
    </div>
  );
}
