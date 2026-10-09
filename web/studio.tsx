import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  FileCode2,
  Folder,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Upload,
  WandSparkles,
  MoveUpRight,
  X,
} from "lucide-react";
import { api, post, useLoad } from "./api";
import { Badge, Empty, Loading, Modal, Notice, useAction } from "./components";
import {
  ModuleExplorer,
  ModuleDetail,
  ModuleMentionInput,
} from "./module-studio";
const VisualBuilder = lazy(() =>
  import("./visual-builder").then((m) => ({ default: m.VisualBuilder })),
);
import type {
  ModuleManifest,
  ProductSpec,
  PublicUser,
} from "../packages/contracts/src/index";
type Project = {
  id: string;
  app_id: string;
  name: string;
  idea: string;
  spec: ProductSpec;
  updated_at: string;
};
type Job = {
  id: string;
  input: string;
  status: string;
  error: string | null;
  project_id: string | null;
  created_at: string;
  result?: { summary?: string };
};
type Deployment = {
  id: string;
  app_id: string;
  project_name: string;
  status: string;
  provider: string;
  port: number;
  created_at: string;
  previous_id: string | null;
};
const formatDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const kindNames = {
  events: "活动与社团",
  marketplace: "校园二手",
  study: "学习搭子",
  custom: "自定义产品",
};
const seedModules = {
  events: ["events", "search", "groups"],
  marketplace: ["content", "search", "chat", "media", "profiles"],
  study: ["profiles", "groups", "chat", "campus", "search", "notifications"],
  custom: ["identity", "content"],
};
export function Studio({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const system = useLoad<{
    llm: { configured: boolean; model: string | null };
    deployment: { docker: boolean; provider: string };
  }>("/api/system");
  return (
    <div className="studio">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-symbol">
            <MoveUpRight size={25} strokeWidth={3} />
          </span>
          <span>
            atlas<small>开发者工作台</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <Link
          className="primary create-link"
          to="/create"
          onClick={() => setOpen(false)}
        >
          <Plus size={18} />
          创建产品
        </Link>
        <nav onClick={() => setOpen(false)}>
          <NavLink end to="/studio">
            <LayoutDashboard size={18} />
            项目总览
          </NavLink>
          <NavLink to="/builder">
            <WandSparkles size={18} />
            AI Builder
          </NavLink>
          <NavLink to="/modules">
            <Boxes size={18} />
            模块仓库
          </NavLink>
          <NavLink to="/compose">
            <GitBranch size={18} />
            可视化编排
          </NavLink>
          <NavLink to="/deployments">
            <Rocket size={18} />
            应用部署
          </NavLink>
          <NavLink to="/publisher">
            <Upload size={18} />
            模块发布
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <span
              className={system.data?.llm.configured ? "dot" : "dot amber"}
            />{" "}
            {system.data?.llm.configured ? "模型已连接" : "模型待连接"}
          </div>
          <div className="user-row">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {user.name}
              <small>{user.role === "admin" ? "平台管理员" : "开发者"}</small>
            </span>
            <button
              className="icon-button"
              title="退出登录"
              aria-label="退出登录"
              onClick={() => void post("/api/auth/logout").then(onLogout)}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="studio-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="打开导航"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span>个人工作空间</span>
          <span className="topbar-right">
            <span className="dot" />
            本地环境<span className="version">v0.1</span>
          </span>
        </header>
        <main className="workspace">
          <Routes>
            <Route path="/studio" element={<Dashboard />} />
            <Route path="/create" element={<CreateProduct />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/modules/:moduleId" element={<ModuleDetail />} />
            <Route
              path="/compose"
              element={
                <Suspense fallback={<Loading />}>
                  <VisualBuilder user={user} />
                </Suspense>
              }
            />
            <Route path="/projects/:id" element={<ProjectWorkspace />} />
            <Route path="/deployments" element={<DeploymentView />} />
            <Route path="/publisher" element={<Publisher user={user} />} />
            <Route
              path="*"
              element={
                <Empty>
                  页面不存在。<Link to="/">返回项目总览</Link>
                </Empty>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Dashboard() {
  const projects = useLoad<{ items: Project[] }>("/api/projects"),
    deployments = useLoad<{ items: Deployment[] }>("/api/deployments"),
    jobs = useLoad<{ items: Job[] }>("/api/jobs");
  return (
    <>
      <Heading
        eyebrow="ATLAS STUDIO"
        title="项目总览"
        subtitle="你的校园产品、共享能力与运行状态。"
      >
        <Link className="primary" to="/create">
          <Plus size={17} />
          新建项目
        </Link>
      </Heading>
      <section className="metrics">
        <div>
          <Folder size={19} />
          <span>
            产品项目<strong>{projects.data?.items.length ?? "—"}</strong>
          </span>
        </div>
        <div>
          <Activity size={19} />
          <span>
            运行中的应用
            <strong>
              {deployments.data?.items.filter((d) => d.status === "running")
                .length ?? "—"}
            </strong>
          </span>
        </div>
        <div>
          <GitBranch size={19} />
          <span>
            开发任务<strong>{jobs.data?.items.length ?? "—"}</strong>
          </span>
        </div>
      </section>
      <section>
        <div className="section-head">
          <h2>我的项目</h2>
          <span className="muted">
            {projects.data?.items.length ?? 0} 个项目
          </span>
        </div>
        {projects.error && <Notice>{projects.error}</Notice>}
        {projects.loading ? (
          <Loading />
        ) : !projects.data?.items.length ? (
          <Empty>
            还没有项目。
            <Link to="/create">
              创建第一个校园产品 <ArrowRight size={14} />
            </Link>
          </Empty>
        ) : (
          <div className="project-list">
            {projects.data.items.map((p) => (
              <Link to={`/projects/${p.id}`} className="project-row" key={p.id}>
                <span className={`project-icon ${p.spec.kind}`}>
                  <Package size={24} />
                </span>
                <div className="project-summary">
                  <h3>{p.name}</h3>
                  <p>{p.spec.description}</p>
                  <div className="project-meta">
                    <span>{kindNames[p.spec.kind]}</span>
                    <span>{p.spec.modules.length} 个模块</span>
                  </div>
                </div>
                <div className="project-right">
                  <span>{formatDate(p.updated_at)}</span>
                  <ChevronRight size={18} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="recent-section">
        <div className="section-head">
          <h2>最近执行</h2>
          <Link to="/builder">
            全部任务 <ArrowRight size={14} />
          </Link>
        </div>
        {jobs.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>需求</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {jobs.data.items.slice(0, 5).map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link to={`/builder?job=${j.id}`}>
                        {j.input.slice(0, 70)}
                      </Link>
                    </td>
                    <td>
                      <Badge status={j.status} />
                    </td>
                    <td>{formatDate(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>暂无开发任务</Empty>
        )}
      </section>
    </>
  );
}
function CreateProduct() {
  const [mode, setMode] = useState<"assembly" | "llm">("llm"),
    [kind, setKind] = useState<ProductSpec["kind"]>("events"),
    [selected, setSelected] = useState<string[]>(seedModules.events);
  const registry = useLoad<{ items: ModuleManifest[] }>("/api/modules");
  const action = useAction(),
    navigate = useNavigate();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    void action.run(async () => {
      if (mode === "llm") {
        const job = await post<{ id: string }>("/api/jobs", {
          input: values.idea,
        });
        navigate(`/builder?job=${job.id}`);
      } else {
        const result = await post<{ project: Project }>("/api/projects", {
          idea: values.idea,
          spec: {
            name: values.name,
            description: values.idea,
            kind,
            modules: selected,
            features: String(values.features || "")
              .split("\n")
              .filter(Boolean),
            primaryColor:
              kind === "marketplace"
                ? "rose"
                : kind === "study"
                  ? "blue"
                  : "green",
          },
        });
        navigate(`/projects/${result.project.id}`);
      }
    });
  }
  return (
    <>
      <Heading eyebrow="NEW PRODUCT" title="创建校园产品" />
      <div className="create-layout">
        <section>
          <div className="tabs">
            <button
              className={mode === "llm" ? "selected" : ""}
              onClick={() => setMode("llm")}
            >
              <WandSparkles size={16} />
              AI 开发
            </button>
            <button
              className={mode === "assembly" ? "selected" : ""}
              onClick={() => setMode("assembly")}
            >
              <Boxes size={16} />
              模块组装
            </button>
          </div>
          {action.error && <Notice>{action.error}</Notice>}
          <form className="product-form" onSubmit={submit}>
            {mode === "assembly" && (
              <label>
                产品名称
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="例如：校园学习搭子"
                />
              </label>
            )}
            <label>
              产品需求
              <ModuleMentionInput name="idea" rows={7} />
            </label>
            {mode === "assembly" && (
              <>
                <label>
                  产品类型
                  <select
                    value={kind}
                    onChange={(e) => {
                      const value = e.target.value as ProductSpec["kind"];
                      setKind(value);
                      setSelected(seedModules[value]);
                    }}
                  >
                    {Object.entries(kindNames).map(([k, n]) => (
                      <option key={k} value={k}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  产品功能
                  <textarea
                    name="features"
                    rows={3}
                    placeholder="每行一项需求"
                  />
                </label>
                <fieldset>
                  <legend>安装模块</legend>
                  <div className="module-checkboxes">
                    {registry.data?.items
                      .filter((m) => m.securityMetadata.review !== "pending")
                      .map((m) => (
                        <label
                          className="check-row"
                          key={`${m.moduleId}-${m.version}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(m.moduleId)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, m.moduleId]
                                  : selected.filter((id) => id !== m.moduleId),
                              )
                            }
                          />
                          <span>
                            {m.name}
                            <small>{m.description}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                </fieldset>
              </>
            )}
            <button
              className="primary"
              disabled={
                action.busy || (!selected.length && mode === "assembly")
              }
            >
              {mode === "llm" ? <WandSparkles size={17} /> : <Plus size={17} />}{" "}
              {action.busy
                ? "正在提交…"
                : mode === "llm"
                  ? "启动 AI 开发"
                  : "创建并安装模块"}
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
        <aside className="context-panel">
          <span className="eyebrow">执行环境</span>
          <h3>{mode === "llm" ? "AI 开发任务" : "确定性模块组装"}</h3>
          <SystemSummary />
          <div className="rule" />
          <p>
            {mode === "llm"
              ? "模型未连接时，需求会保存为等待配置的任务。"
              : "依据所选能力生成项目和依赖；此模式不属于 AI 自主代码生成。"}
          </p>
        </aside>
      </div>
    </>
  );
}
function SystemSummary() {
  const system = useLoad<{
    llm: { configured: boolean; model: string | null };
    deployment: { docker: boolean; provider: string };
  }>("/api/system");
  return (
    <dl className="definition-list">
      <div>
        <dt>模型服务</dt>
        <dd>
          {system.data?.llm.configured ? system.data.llm.model : "未连接"}
        </dd>
      </div>
      <div>
        <dt>代码隔离环境</dt>
        <dd>
          {system.data?.deployment.docker ? "Docker 可用" : "Docker 不可用"}
        </dd>
      </div>
      <div>
        <dt>本地应用运行</dt>
        <dd>平台共享模块</dd>
      </div>
    </dl>
  );
}
function Builder() {
  const navigate = useNavigate();
  const jobs = useLoad<{ items: Job[] }>("/api/jobs", 3000);
  const query = new URLSearchParams(location.search);
  const [selected, setSelected] = useState(query.get("job") || "");
  const projects = useLoad<{ items: Project[] }>("/api/projects");
  const action = useAction();
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("job");
    if (requested) setSelected(requested);
  }, [location.search]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    void action.run(async () => {
      const job = await post<{ id: string }>("/api/jobs", {
        input: values.input,
        projectId: values.projectId || undefined,
      });
      setSelected(job.id);
      navigate(`/builder?job=${job.id}`);
      form.reset();
      await jobs.refresh();
    });
  }
  return (
    <>
      <Heading
        eyebrow="PRODUCT AGENT"
        title="AI Builder"
        subtitle="需求、计划、工具执行与验证记录。"
      />
      <div className="builder-layout">
        <section className="job-list">
          <h2>开发任务</h2>
          {jobs.data?.items.length ? (
            jobs.data.items.map((j) => (
              <button
                key={j.id}
                className={`job-item ${selected === j.id ? "selected" : ""}`}
                onClick={() => {
                  setSelected(j.id);
                  navigate(`/builder?job=${j.id}`);
                }}
              >
                <span>{j.input.slice(0, 65)}</span>
                <Badge status={j.status} />
                <small>{formatDate(j.created_at)}</small>
              </button>
            ))
          ) : (
            <Empty>暂无任务</Empty>
          )}
        </section>
        <section className="builder-main">
          {selected ? (
            <JobDetail id={selected} />
          ) : (
            <Empty>提交一个需求，开始开发任务</Empty>
          )}
          {action.error && <Notice>{action.error}</Notice>}
          <form className="composer" onSubmit={submit}>
            <label>
              关联项目
              <select name="projectId">
                <option value="">创建新项目</option>
                {projects.data?.items.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              新的需求
              <ModuleMentionInput
                key={query.get("modules") || "input"}
                name="input"
                rows={3}
                seed={
                  query.get("modules")
                    ? `我想使用 +${query.get("modules")} `
                    : ""
                }
              />
            </label>
            <button className="primary" disabled={action.busy}>
              <Send size={16} />
              提交需求
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
function JobDetail({ id }: { id: string }) {
  const job = useLoad<{
    job: Job;
    events: {
      id: number;
      type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }[];
  }>(`/api/jobs/${id}`, 2000);
  const action = useAction();
  if (job.loading) return <Loading />;
  if (job.error) return <Notice>{job.error}</Notice>;
  const data = job.data!;
  return (
    <div className="job-detail">
      <div className="section-head">
        <h2>任务记录</h2>
        <Badge status={data.job.status} />
      </div>
      <p className="requirement">{data.job.input}</p>
      {data.job.error && (
        <Notice kind="info">
          {data.job.error === "LLM_UNCONFIGURED"
            ? "模型尚未连接。需求已经保存，可在配置完成后重试。"
            : data.job.error}
        </Notice>
      )}
      {action.error && <Notice>{action.error}</Notice>}
      <div className="inline-actions">
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const retry = await post<{ id: string }>(`/api/jobs/${id}/retry`);
              location.href = `/builder?job=${retry.id}`;
            })
          }
        >
          <RefreshCw size={15} />
          重试
        </button>
        {["running", "queued"].includes(data.job.status) && (
          <button
            onClick={() =>
              void action.run(() => post(`/api/jobs/${id}/cancel`))
            }
          >
            <Square size={15} />
            取消
          </button>
        )}
        {data.job.project_id && (
          <Link to={`/projects/${data.job.project_id}`}>
            打开项目 <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <div className="timeline">
        {data.events.map((event) => (
          <div className="timeline-event" key={event.id}>
            <span className="timeline-marker" />
            <div>
              <div className="event-heading">
                <strong>
                  {event.type === "tool_call"
                    ? `工具 · ${event.payload.name}`
                    : event.type === "tool_result"
                      ? `执行结果 · ${event.payload.name}`
                      : event.type === "requested"
                        ? "需求已保存"
                        : event.type === "assistant"
                          ? "Agent"
                          : "执行异常"}
                </strong>
                <time>{formatDate(event.created_at)}</time>
              </div>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </div>
          </div>
        ))}
      </div>
      {data.job.result?.summary && <p>{data.job.result.summary}</p>}
    </div>
  );
}
function Modules() {
  return <ModuleExplorer />;
}
function ProjectWorkspace() {
  const { id } = useParams();
  const project = useLoad<{
    project: Project;
    application: { id: string };
    installs: { module_id: string; version: string }[];
  }>(`/api/projects/${id}`);
  const [tab, setTab] = useState("overview"),
    [file, setFile] = useState(""),
    [content, setContent] = useState("");
  const files = useLoad<{ items: { path: string; size: number }[] }>(
    `/api/projects/${id}/files`,
  );
  const action = useAction();
  if (project.loading) return <Loading />;
  if (project.error) return <Notice>{project.error}</Notice>;
  const data = project.data!;
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={15} />
        全部项目
      </Link>
      <Heading
        eyebrow={kindNames[data.project.spec.kind]}
        title={data.project.name}
        subtitle={data.project.spec.description}
      >
        <Link className="button" to={`/compose?project=${id}`}>
          <GitBranch size={16} />
          可视化编排
        </Link>
        <Link to="/builder" className="button">
          <WandSparkles size={16} />
          继续开发
        </Link>
        <button
          className="primary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const result = await post<Deployment>(
                `/api/projects/${id}/deploy`,
              );
              if (result.status !== "running")
                throw new Error("部署失败，请查看部署日志");
              setTab("deploy");
            }, "应用已启动")
          }
        >
          <Play size={16} />
          {action.busy ? "正在执行…" : "创建预览"}
        </button>
      </Heading>
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
      <div className="tabs">
        <button
          className={tab === "overview" ? "selected" : ""}
          onClick={() => setTab("overview")}
        >
          <Folder size={16} />
          产品与模块
        </button>
        <button
          className={tab === "files" ? "selected" : ""}
          onClick={() => setTab("files")}
        >
          <FileCode2 size={16} />
          项目文件
        </button>
        <button
          className={tab === "deploy" ? "selected" : ""}
          onClick={() => setTab("deploy")}
        >
          <Rocket size={16} />
          预览与部署
        </button>
        <button
          className={tab === "settings" ? "selected" : ""}
          onClick={() => setTab("settings")}
        >
          <Settings2 size={16} />
          配置
        </button>
      </div>
      {tab === "overview" && (
        <div className="project-overview">
          <section>
            <h2>产品规格</h2>
            <SpecEditor project={data.project} refresh={project.refresh} />
          </section>
          <section>
            <div className="section-head">
              <h2>已安装能力</h2>
              <Link to="/modules">
                <Plus size={15} />
                安装
              </Link>
            </div>
            <div className="installed-list">
              {data.installs.map((m) => (
                <div key={m.module_id}>
                  <Boxes size={17} />
                  <strong>{m.module_id}</strong>
                  <code>{m.version}</code>
                  <button
                    className="icon-button"
                    aria-label={`卸载 ${m.module_id}`}
                    title={`卸载 ${m.module_id}`}
                    onClick={() =>
                      void action.run(async () => {
                        await post(`/api/projects/${id}/modules`, {
                          modules: data.project.spec.modules.filter(
                            (n) => n !== m.module_id,
                          ),
                        });
                        await project.refresh();
                      }, "安装方案已更新；依赖仍被需要的模块会保留")
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                void action.run(async () => {
                  await post(`/api/projects/${id}/modules/rollback`);
                  await project.refresh();
                }, "模块版本已回滚")
              }
            >
              <RefreshCw size={15} />
              回滚上次安装
            </button>
          </section>
        </div>
      )}
      {tab === "files" && (
        <section className="file-editor">
          <div className="file-tree">
            <div className="section-head">
              <h3>文件</h3>
              <button
                className="icon-button"
                title="新建文件"
                aria-label="新建文件"
                onClick={() => {
                  setFile("src/feature.ts");
                  setContent("");
                }}
              >
                <Plus size={16} />
              </button>
            </div>
            {files.data?.items.map((f) => (
              <button
                key={f.path}
                className={f.path === file ? "selected" : ""}
                onClick={() =>
                  void action.run(async () => {
                    setContent(
                      (
                        await api<{ content: string }>(
                          `/api/projects/${id}/file?path=${encodeURIComponent(f.path)}`,
                        )
                      ).content,
                    );
                    setFile(f.path);
                  })
                }
              >
                <FileCode2 size={15} />
                {f.path}
              </button>
            ))}
          </div>
          <div className="code-pane">
            <div className="toolbar">
              <input
                aria-label="文件路径"
                value={file}
                onChange={(e) => setFile(e.target.value)}
                placeholder="src/feature.ts"
              />
              <button
                title="保存文件"
                aria-label="保存文件"
                disabled={!file || action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api(`/api/projects/${id}/file`, {
                      method: "PUT",
                      body: JSON.stringify({ path: file, content }),
                    });
                    await files.refresh();
                  }, "文件已保存")
                }
              >
                <Save size={16} />
              </button>
              <button
                onClick={() =>
                  void action.run(async () => {
                    const result = await post<{ ok: boolean; stderr: string }>(
                      `/api/projects/${id}/validate`,
                      { kind: "build" },
                    );
                    if (!result.ok) throw new Error(result.stderr);
                  }, "构建通过")
                }
              >
                <Code2 size={16} />
                构建
              </button>
              <button
                onClick={() =>
                  void action.run(async () => {
                    const result = await post<{ ok: boolean; stderr: string }>(
                      `/api/projects/${id}/validate`,
                      { kind: "test" },
                    );
                    if (!result.ok) throw new Error(result.stderr);
                  }, "测试通过")
                }
              >
                <Check size={16} />
                测试
              </button>
            </div>
            <textarea
              className="code-input"
              spellCheck={false}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-label="文件内容"
            />
          </div>
        </section>
      )}
      {tab === "deploy" && <DeploymentView projectId={id} compact />}
      {tab === "settings" && <EnvironmentSettings id={id!} />}
    </>
  );
}
function SpecEditor({
  project,
  refresh,
}: {
  project: Project;
  refresh: () => Promise<void>;
}) {
  const action = useAction();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    void action.run(async () => {
      await api(`/api/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...project.spec,
          name: values.name,
          description: values.description,
          features: String(values.features).split("\n").filter(Boolean),
        }),
      });
      await refresh();
    }, "产品规格已更新");
  }
  return (
    <form onSubmit={submit}>
      <label>
        名称
        <input name="name" defaultValue={project.name} required minLength={2} />
      </label>
      <label>
        需求描述
        <textarea
          name="description"
          defaultValue={project.spec.description}
          required
          minLength={5}
          rows={4}
        />
      </label>
      <label>
        功能清单
        <textarea
          name="features"
          defaultValue={project.spec.features.join("\n")}
          rows={4}
        />
      </label>
      {action.error && <Notice>{action.error}</Notice>}
      {action.message && <Notice kind="success">{action.message}</Notice>}
      <button disabled={action.busy}>
        <Save size={15} />
        保存规格
      </button>
    </form>
  );
}
function EnvironmentSettings({ id }: { id: string }) {
  const env = useLoad<{ items: { name: string }[] }>(`/api/projects/${id}/env`);
  const action = useAction();
  return (
    <section className="settings-form">
      <h2>环境变量</h2>
      <Notice kind="info">
        密钥加密保存，仅供隔离部署使用。本地共享模块不接收自定义密钥。
      </Notice>
      {env.data?.items.map((item) => (
        <div className="env-row" key={item.name}>
          <code>{item.name}</code>
          <span>••••••••</span>
          <button
            className="icon-button"
            title="删除变量"
            aria-label={`删除 ${item.name}`}
            onClick={() =>
              void action.run(async () => {
                await api(`/api/projects/${id}/env/${item.name}`, {
                  method: "DELETE",
                });
                await env.refresh();
              })
            }
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          void action.run(async () => {
            await api(`/api/projects/${id}/env`, {
              method: "PUT",
              body: JSON.stringify(values),
            });
            form.reset();
            await env.refresh();
          }, "变量已保存");
        }}
      >
        <label>
          变量名称
          <input
            name="name"
            pattern="APP_[A-Z0-9_]+"
            placeholder="APP_SERVICE_TOKEN"
            required
          />
        </label>
        <label>
          值<input name="value" type="password" autoComplete="off" required />
        </label>
        {action.error && <Notice>{action.error}</Notice>}
        <button className="primary" disabled={action.busy}>
          <Save size={16} />
          保存变量
        </button>
      </form>
    </section>
  );
}
function DeploymentView({
  projectId,
  compact = false,
}: {
  projectId?: string;
  compact?: boolean;
}) {
  const records = useLoad<{ items: Deployment[] }>(
    `/api/deployments${projectId ? `?projectId=${projectId}` : ""}`,
    4000,
  );
  const [logs, setLogs] = useState<string | null>(null),
    [health, setHealth] = useState("");
  const action = useAction();
  return (
    <>
      {!compact && (
        <Heading
          eyebrow="APPLICATION HOSTING"
          title="应用部署"
          subtitle="本地运行实例、版本记录与健康状态。"
        />
      )}
      {action.error && <Notice>{action.error}</Notice>}
      {health && <Notice kind="info">{health}</Notice>}
      {records.loading ? (
        <Loading />
      ) : records.data?.items.length ? (
        <div className="deployment-list">
          {records.data.items
            .filter((d) => d.status !== "deleted")
            .map((d) => (
              <article className="deployment-row" key={d.id}>
                <div className="deployment-info">
                  <Rocket size={21} />
                  <div>
                    <h3>{d.project_name}</h3>
                    <small>
                      {d.id.slice(0, 8)} · {d.provider} ·{" "}
                      {formatDate(d.created_at)}
                    </small>
                  </div>
                  <Badge status={d.status} />
                </div>
                <div className="inline-actions">
                  {d.status === "running" && (
                    <a
                      className="button primary"
                      href={`http://app-${d.app_id}.localhost:${d.port}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} />
                      打开应用
                    </a>
                  )}
                  <button
                    title="查看日志"
                    onClick={() =>
                      void action.run(async () =>
                        setLogs(
                          (
                            await api<{ logs: string }>(
                              `/api/deployments/${d.id}/logs`,
                            )
                          ).logs,
                        ),
                      )
                    }
                  >
                    <Terminal size={15} />
                    日志
                  </button>
                  <button
                    title="健康检查"
                    aria-label={`健康检查 ${d.id.slice(0, 8)}`}
                    onClick={() =>
                      void action.run(async () => {
                        const result = await api<{ healthy: boolean }>(
                          `/api/deployments/${d.id}/health`,
                        );
                        setHealth(
                          `${d.project_name}：${result.healthy ? "健康检查通过" : "服务当前不可达"}`,
                        );
                      })
                    }
                  >
                    <Activity size={16} />
                  </button>
                  <button
                    title="重新部署"
                    aria-label={`重新部署 ${d.id.slice(0, 8)}`}
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await post(`/api/deployments/${d.id}/restart`);
                        await records.refresh();
                      })
                    }
                  >
                    <RefreshCw size={16} />
                  </button>
                  {d.status === "running" && (
                    <button
                      title="停止应用"
                      aria-label={`停止 ${d.id.slice(0, 8)}`}
                      onClick={() =>
                        void action.run(async () => {
                          await post(`/api/deployments/${d.id}/stop`);
                          await records.refresh();
                        })
                      }
                    >
                      <Square size={15} />
                    </button>
                  )}
                  {d.previous_id && (
                    <button
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          await post(`/api/deployments/${d.id}/rollback`);
                          await records.refresh();
                        })
                      }
                    >
                      <GitBranch size={15} />
                      回滚
                    </button>
                  )}
                  <button
                    title="移除实例，保留数据"
                    aria-label={`移除 ${d.id.slice(0, 8)}`}
                    onClick={() =>
                      void action.run(async () => {
                        await api(`/api/deployments/${d.id}`, {
                          method: "DELETE",
                        });
                        await records.refresh();
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <Empty>暂无部署。在项目中创建预览以启动应用。</Empty>
      )}
      {logs !== null && (
        <Modal title="部署日志" onClose={() => setLogs(null)}>
          <pre className="log-view">{logs || "暂时没有日志"}</pre>
        </Modal>
      )}
    </>
  );
}
function Publisher({ user }: { user: PublicUser }) {
  const projects = useLoad<{ items: Project[] }>("/api/projects"),
    pending = useLoad<{
      items: {
        module_id: string;
        version: string;
        manifest: ModuleManifest;
        recipe: unknown;
      }[];
    }>("/api/modules/pending");
  const action = useAction();
  return (
    <>
      <Heading
        eyebrow="MODULE LIFECYCLE"
        title="模块发布"
        subtitle="从项目能力提取契约，经审核后供其他应用安装。"
      />
      <div className="publisher-layout">
        <section>
          <h2>提取项目能力</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void action.run(async () => {
                await post(`/api/projects/${values.projectId}/extract`, {
                  moduleId: values.moduleId,
                  name: values.name,
                  version: values.version,
                  sourceFile: values.sourceFile,
                });
                await pending.refresh();
              }, "已提取模块，等待管理员审核");
            }}
          >
            <label>
              源项目
              <select name="projectId" required>
                <option value="">选择项目</option>
                {projects.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              契约文件路径
              <input
                name="sourceFile"
                required
                placeholder="features/waitlist.json"
              />
            </label>
            <label>
              模块标识
              <input
                name="moduleId"
                required
                pattern="[a-z][a-z0-9-]{1,63}"
                placeholder="study-waitlist"
              />
            </label>
            <label>
              模块名称
              <input name="name" required placeholder="学习小组候补" />
            </label>
            <label>
              版本
              <input
                name="version"
                required
                pattern="[0-9]+\.[0-9]+\.[0-9]+"
                defaultValue="1.0.0"
              />
            </label>
            {action.error && <Notice>{action.error}</Notice>}
            {action.message && <Notice kind="success">{action.message}</Notice>}
            <button className="primary" disabled={action.busy}>
              <Upload size={16} />
              提取并提交审核
            </button>
          </form>
        </section>
        <section>
          <h2>待审核版本</h2>
          {pending.data?.items.length ? (
            pending.data.items.map((m) => (
              <article
                className="review-item"
                key={`${m.module_id}-${m.version}`}
              >
                <h3>{m.manifest.name}</h3>
                <code>
                  {m.module_id}@{m.version}
                </code>
                <details>
                  <summary>查看契约与权限</summary>
                  <pre>
                    {JSON.stringify(
                      { manifest: m.manifest, recipe: m.recipe },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                {user.role === "admin" && (
                  <button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await post(`/api/modules/${m.module_id}/approve`, {
                          version: m.version,
                        });
                        await pending.refresh();
                      }, "模块已审核并发布")
                    }
                  >
                    <ShieldCheck size={16} />
                    审核并发布
                  </button>
                )}
              </article>
            ))
          ) : (
            <Empty>没有等待审核的模块</Empty>
          )}
          <div className="rule" />
          <p className="muted">
            当前发布范围：经过验证的容量与 FIFO
            候补契约。自定义可执行模块暂不开放发布。
          </p>
        </section>
      </div>
    </>
  );
}
