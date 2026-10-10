import { t, useLanguage } from "./i18n";
import { VisualDesignStart } from "./visual-design";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  ViewportPortal,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Plus,
  Save,
  Search,
  Play,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
} from "lucide-react";
import type {
  Composition,
  ModuleManifest,
  ProductSpec,
  PublicUser,
} from "../packages/contracts/src/index";
import {
  validateComposition,
  compositionIssues,
} from "../packages/modules/src/composition";
import { resolveModules } from "../packages/modules/src/catalog";
import { api, post, useLoad } from "./api";
import { Loading, Notice, useAction } from "./components";
import { categoryLabels, ModuleIcon } from "./module-studio";
import { FieldInput } from "./record-module";
import "./canvas-guided.css";

type ModuleNode = Node<
  {
    module: ModuleManifest;
    title: string;
    configuration: Record<string, string | number | boolean>;
    view?: "cards" | "table" | "board";
    issues?: string[];
  },
  "module"
>;
function CanvasNode({ data, selected }: NodeProps<ModuleNode>) {
  useLanguage();
  return (
    <div
      className={`canvas-module ${selected ? "selected" : ""} ${data.module.category} ${data.issues?.length ? "invalid" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label={`${t(data.module.name)}${t("输入")}`}
      />
      <header>
        <ModuleIcon module={data.module} size={19} />
        <div>
          <strong>
            {data.title === data.module.name ? t(data.title) : data.title}
          </strong>
          <small>{t(categoryLabels[data.module.category])}</small>
        </div>
      </header>
      <div className="node-contract">
        <span>
          {data.module.category === "connector"
            ? t("事件")
            : data.module.category === "presentation"
              ? t("记录")
              : t("账号 / 数据")}
        </span>
        <span>
          {data.module.category === "presentation"
            ? t("界面")
            : data.module.category === "connector"
              ? t("结果")
              : t("记录 / 事件")}
        </span>
      </div>
      <div className="canvas-port-labels">
        <span>{t("输入")}</span>
        <span>{t("输出")}</span>
      </div>
      {!!data.issues?.length && (
        <div className="canvas-node-error">
          <AlertTriangle size={14} />
          {data.issues[0]}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        aria-label={`${t(data.module.name)}${t("输出")}`}
      />
    </div>
  );
}
const nodeTypes = { module: CanvasNode };
const edgeLabels = {
  dependency: "依赖接口",
  navigate: "页面跳转",
  embed: "内嵌记录",
  notify: "创建后通知",
  flow: "自动化",
  display: "展示数据",
};
const lanes = [
  { name: "技术底座", subtitle: "身份 / 存储 / 通信", color: "#edf1f8" },
  { name: "产品业务", subtitle: "交易 / 社区 / 校园场景", color: "#eaf3ef" },
  { name: "连接自动化", subtitle: "触发 / 条件 / 动作", color: "#faf0e5" },
  { name: "界面展示", subtitle: "列表 / 看板 / 统计", color: "#f3eef7" },
];
const laneOf = (m: ModuleManifest) =>
  m.category === "foundation"
    ? 0
    : m.category === "connector"
      ? 2
      : m.category === "presentation"
        ? 3
        : 1;
const lanePosition = (m: ModuleManifest, all: ModuleNode[]) => ({
  x: 40 + laneOf(m) * 400,
  y: 140 + all.filter((n) => laneOf(n.data.module) === laneOf(m)).length * 215,
});
function dependencyEdges(all: ModuleNode[], existing: Edge[]) {
  const result = [...existing];
  for (const target of all)
    for (const dependency of Object.keys(target.data.module.dependencies)) {
      const source = all.find((n) => n.data.module.moduleId === dependency);
      if (
        source &&
        !result.some(
          (e) =>
            e.source === source.id &&
            e.target === target.id &&
            e.data?.mode === "dependency",
        )
      )
        result.push({
          id: crypto.randomUUID(),
          source: source.id,
          target: target.id,
          label: edgeLabels.dependency,
          data: { mode: "dependency" },
        });
    }
  return result;
}
function defaults(
  module: ModuleManifest,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    module.configurationFields.map((field) => [
      field.key,
      field.key === "template"
        ? "{title} · {status}"
        : field.key === "title"
          ? "{title}"
          : field.type === "number"
            ? 0
            : field.options?.[0] || "",
    ]),
  );
}
export function VisualBuilder({ user }: { user: PublicUser }) {
  const [params] = useSearchParams();
  if (
    !params.has("project") &&
    !params.has("proposal") &&
    !params.has("add") &&
    params.get("mode") !== "manual"
  )
    return <VisualDesignStart />;
  return (
    <ReactFlowProvider>
      <CanvasEditor user={user} />
    </ReactFlowProvider>
  );
}
function CanvasEditor({ user }: { user: PublicUser }) {
  const registry = useLoad<{ items: ModuleManifest[] }>("/api/modules"),
    [params, setParams] = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<ModuleNode>([]),
    [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState(""),
    [edgeId, setEdgeId] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [name, setName] = useState(() => t("我的校园应用")),
    [description, setDescription] = useState(""),
    [linkSource, setLinkSource] = useState(""),
    [linkTarget, setLinkTarget] = useState(""),
    [mode, setMode] = useState("auto"),
    [preview, setPreview] = useState("");
  const [advanced, setAdvanced] = useState(false),
    [loaded, setLoaded] = useState(false),
    [features, setFeatures] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState(
      params.get("project") || "",
    ),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const action = useAction(),
    flow = useReactFlow<ModuleNode>(),
    initialized = useRef(false);
  useEffect(() => {
    if (!advanced) return;
    const timer = setTimeout(
      () => void flow.fitView({ padding: 0.18, maxZoom: 0.9, duration: 150 }),
      100,
    );
    return () => clearTimeout(timer);
  }, [advanced, flow]);
  const registryItems =
    registry.data?.items.filter(
      (m) => m.securityMetadata.review !== "pending",
    ) || [];
  const available = registryItems.filter(
    (m, i) => registryItems.findIndex((a) => a.moduleId === m.moduleId) === i,
  );
  const makeNode = useCallback(
    (
      module: ModuleManifest,
      position = lanePosition(module, nodes),
    ): ModuleNode => ({
      id: crypto.randomUUID(),
      type: "module",
      position,
      data: {
        module,
        title: module.name,
        configuration: defaults(module),
        view: module.recordDefinition?.view,
      },
    }),
    [nodes],
  );
  useEffect(() => {
    if (!registry.data || initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        let graph: Composition | undefined;
        if (params.get("project") || params.get("proposal")) {
          const spec = params.get("project")
            ? (
                await api<{ project: { spec: ProductSpec } }>(
                  `/api/projects/${params.get("project")}`,
                )
              ).project.spec
            : (
                await api<{ job: { plan: ProductSpec } }>(
                  `/api/jobs/${params.get("proposal")}`,
                )
              ).job.plan;
          if (!spec) throw new Error("设计方案尚未生成");
          setName(spec.name);
          setDescription(spec.description);
          setFeatures(spec.features);
          graph = spec.composition;
          if (!graph)
            graph = {
              version: 1,
              nodes: spec.modules.map((id, i) => ({
                id: crypto.randomUUID(),
                moduleId: id,
                position: {
                  x: 70 + (i % 3) * 280,
                  y: 70 + Math.floor(i / 3) * 170,
                },
                configuration: {},
              })),
              edges: [],
            };
        } else if (!params.get("add")) {
          const draft = localStorage.getItem(`foundry-canvas-${user.id}`);
          if (draft) {
            const parsed = JSON.parse(draft);
            graph = parsed.graph;
            setName(parsed.name);
            setDescription(parsed.description || "");
          }
        }
        if (graph) {
          setNodes(
            graph.nodes.flatMap((n) => {
              const module = registry.data!.items.find(
                (m) => m.moduleId === n.moduleId,
              );
              return module
                ? [
                    {
                      id: n.id,
                      type: "module" as const,
                      position: n.position,
                      data: {
                        module,
                        title: n.title || module.name,
                        configuration: n.configuration || defaults(module),
                        view: n.view || module.recordDefinition?.view,
                      },
                    },
                  ]
                : [];
            }),
          );
          setEdges(
            graph.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: edgeLabels[e.mode],
              data: { mode: e.mode },
              animated: e.mode === "flow",
            })),
          );
        } else if (params.get("add")) {
          const module = registry.data!.items.find(
            (m) => m.moduleId === params.get("add"),
          );
          if (module) {
            const all: ModuleNode[] = [];
            for (const m of resolveModules(
              [module.moduleId],
              registry.data!.items,
            ))
              all.push(makeNode(m, lanePosition(m, all)));
            setNodes(all);
            setEdges(dependencyEdges(all, []));
          }
        }
        setLoaded(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [registry.data, params, user.id, makeNode, setEdges, setNodes]);
  function graph(): Composition {
    return {
      version: 2,
      nodes: nodes.map((n) => ({
        id: n.id,
        moduleId: n.data.module.moduleId,
        position: n.position,
        title: n.data.title,
        configuration: n.data.configuration,
        view: n.data.view,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        mode: e.data?.mode as Composition["edges"][number]["mode"],
      })),
    };
  }
  useEffect(() => {
    if (initialized.current && !currentProject && nodes.length)
      localStorage.setItem(
        `foundry-canvas-${user.id}`,
        JSON.stringify({
          name,
          description,
          graph: {
            version: 2,
            nodes: nodes.map((n) => ({
              id: n.id,
              moduleId: n.data.module.moduleId,
              position: n.position,
              title: n.data.title,
              configuration: n.data.configuration,
              view: n.data.view,
            })),
            edges: edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              mode: e.data?.mode,
            })),
          },
        }),
      );
  }, [nodes, edges, name, description, currentProject, user.id]);
  function add(module: ModuleManifest, position?: { x: number; y: number }) {
    const existing = nodes.find(
      (n) => n.data.module.moduleId === module.moduleId,
    );
    if (
      existing &&
      module.category !== "connector" &&
      module.category !== "presentation"
    ) {
      setSelectedId(existing.id);
      return;
    }
    if (nodes.length >= 80) {
      setError("画布最多 80 个节点");
      return;
    }
    try {
      const all = [...nodes];
      for (const m of resolveModules([module.moduleId], available)) {
        if (
          all.some((n) => n.data.module.moduleId === m.moduleId) &&
          !(
            ["connector", "presentation"].includes(m.category) &&
            m.moduleId === module.moduleId
          )
        )
          continue;
        const placement = lanePosition(m, all);
        if (position && m.moduleId === module.moduleId)
          placement.y = Math.max(140, position.y);
        all.push(makeNode(m, placement));
      }
      if (all.length > 80) throw new Error("含依赖后超过 80 个节点");
      setNodes(all);
      setEdges(dependencyEdges(all, edges));
      setSelectedId("");
      setEdgeId("");
      setSaved(false);
      setError("");
      requestAnimationFrame(
        () =>
          void flow.fitView({ duration: 250, padding: 0.18, maxZoom: 0.85 }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function connect(connection: Connection) {
    const source = nodes.find((n) => n.id === connection.source),
      target = nodes.find((n) => n.id === connection.target);
    if (!source || !target) return;
    const kind =
      mode !== "auto"
        ? mode
        : target.data.module.dependencies[source.data.module.moduleId]
          ? "dependency"
          : target.data.module.category === "connector"
            ? "flow"
            : target.data.module.category === "presentation"
              ? "display"
              : target.data.module.moduleId === "notifications"
                ? "notify"
                : "navigate";
    setEdges((all) =>
      addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
          label: edgeLabels[kind as keyof typeof edgeLabels],
          data: { mode: kind },
          animated: kind === "flow",
        },
        all,
      ),
    );
    setSaved(false);
  }
  const selected = nodes.find((n) => n.id === selectedId),
    selectedEdge = edges.find((e) => e.id === edgeId);
  const workingSpec: ProductSpec = {
    name,
    description,
    kind: "custom",
    modules: [...new Set(nodes.map((n) => n.data.module.moduleId))],
    features,
    primaryColor: "green",
    composition: graph(),
  };
  const issues = compositionIssues(workingSpec, available, t);
  const edgeIssue = (edge: Edge) =>
    issues.find((i) => i.edgeId === edge.id) ||
    issues.find(
      (i) => i.code === "GRAPH" && /循环|私有|最多|超过/.test(i.message),
    );
  const drawnEdges = edges.map((e) => ({
    ...e,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeIssue(e)
        ? "#c83131"
        : e.data?.mode === "dependency"
          ? "#6785aa"
          : "#218474",
    },
    style: {
      stroke: edgeIssue(e)
        ? "#c83131"
        : e.data?.mode === "dependency"
          ? "#6785aa"
          : "#218474",
      strokeWidth: edgeIssue(e) ? 3 : 2,
      strokeDasharray: e.data?.mode === "dependency" ? "5 4" : undefined,
    },
    className: edgeIssue(e) ? "invalid-edge" : "",
    label: edgeIssue(e)
      ? `${t("无效")} · ${t(edgeLabels[e.data?.mode as keyof typeof edgeLabels])}`
      : t(edgeLabels[e.data?.mode as keyof typeof edgeLabels]),
  }));
  const drawnNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      issues: issues.filter((i) => i.nodeId === n.id).map((i) => i.message),
    },
  }));
  function arrange() {
    const arranged: ModuleNode[] = [];
    for (const n of nodes)
      arranged.push({ ...n, position: lanePosition(n.data.module, arranged) });
    setNodes(arranged);
    setSaved(false);
    requestAnimationFrame(
      () => void flow.fitView({ duration: 250, padding: 0.15, maxZoom: 0.9 }),
    );
  }
  function repairDependencies() {
    try {
      const all = [...nodes];
      for (const m of resolveModules(
        nodes.map((n) => n.data.module.moduleId),
        available,
      ))
        if (!all.some((n) => n.data.module.moduleId === m.moduleId))
          all.push(makeNode(m, lanePosition(m, all)));
      if (all.length > 80) throw new Error("含依赖后超过 80 个节点");
      setNodes(all);
      setEdges(dependencyEdges(all, edges));
      setSaved(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function updateNode(patch: Partial<ModuleNode["data"]>) {
    setNodes((all) =>
      all.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
    setSaved(false);
  }
  async function save(run: boolean) {
    await action.run(
      async () => {
        if (!nodes.length) throw new Error("请先添加模块");
        if (issues.length)
          throw new Error(issues.map((i) => i.message).join("；"));
        const modules = resolveModules(
          nodes.map((n) => n.data.module.moduleId),
          available,
        ).map((m) => m.moduleId);
        const spec: ProductSpec = {
          name: name.trim() || "我的校园应用",
          description: description.trim(),
          kind: "custom",
          modules,
          features,
          primaryColor: "green",
          composition: graph(),
        };
        validateComposition(spec, available);
        let id = currentProject;
        if (id)
          await api(`/api/projects/${id}`, {
            method: "PUT",
            body: JSON.stringify(spec),
          });
        else {
          const created = await post<{ project: { id: string } }>(
            "/api/projects",
            { idea: description.trim(), spec },
          );
          id = created.project.id;
          setCurrentProject(id);
          setParams({ project: id });
          localStorage.removeItem(`foundry-canvas-${user.id}`);
        }
        setSaved(true);
        setError("");
        if (run) {
          const deployment = await post<{
            app_id: string;
            port: number;
            status: string;
            logs: string;
          }>(`/api/projects/${id}/deploy`);
          if (deployment.status !== "running")
            throw new Error(deployment.logs || "部署未成功");
          setPreview(
            `http://app-${deployment.app_id}.localhost:${deployment.port}`,
          );
        }
      },
      run ? "应用已生成并运行" : "编排已保存到项目",
    );
  }
  if (!loaded) {
    if (registry.error || error)
      return (
        <Notice>
          {registry.error || error}
          <button onClick={() => window.location.reload()}>{t("重试")}</button>
        </Notice>
      );
    return <Loading />;
  }
  return (
    <div className="visual-builder">
      <div className="section-head">
        <Link to="/compose">{t("描述新想法")}</Link>
        <div className="tabs">
          <button
            className={!advanced ? "selected" : ""}
            onClick={() => setAdvanced(false)}
          >
            {t("产品方案")}
          </button>
          <button
            className={advanced ? "selected" : ""}
            onClick={() => setAdvanced(true)}
          >
            {t("技术连线")}
          </button>
        </div>
      </div>
      <header className="canvas-toolbar">
        <Link className="icon-button" to="/modules" title={t("模块仓库")}>
          <ArrowLeft size={18} />
        </Link>
        <GitBranch size={21} />
        <input
          aria-label={t("应用名称")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
        />
        <span className="save-state">{saved ? t("已保存") : t("草稿")}</span>
        <button
          disabled={action.busy || !nodes.length || !!issues.length}
          onClick={() => void save(false)}
        >
          <Save size={16} />
          {t("保存")}
        </button>
        <button
          className="primary"
          disabled={action.busy || !nodes.length || !!issues.length}
          onClick={() => void save(true)}
        >
          <Play size={16} />
          {action.busy ? t("正在生成…") : t("生成应用")}
        </button>
      </header>
      <div className="canvas-brief">
        <label>
          {t("产品描述")}
          <textarea
            aria-label={t("产品描述")}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
            maxLength={4000}
            rows={2}
            placeholder={t(
              "例如：学生买卖二手教材，商家发布商品与库存，买家下单，卖家约定取货地点，收货后评价。",
            )}
          />
        </label>
        <div
          className={`canvas-validation ${issues.length ? "has-errors" : ""}`}
          role="status"
        >
          {issues.length ? (
            <AlertTriangle size={21} />
          ) : (
            <CheckCircle2 size={21} />
          )}
          <strong>
            {!nodes.length
              ? t("等待添加模块")
              : issues.length
                ? t("{{count}} 项待处理", { count: issues.length })
                : t("结构校验通过")}
          </strong>
          <span>
            {issues.length
              ? issues[0].message
              : t("接口与依赖已匹配，生成后仍需构建和业务测试。")}
          </span>
        </div>
      </div>
      {!!nodes.length && !!issues.length && (
        <details className="canvas-validation-details">
          <summary>{t("查看校验问题")}</summary>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    if (issue.nodeId) {
                      setSelectedId(issue.nodeId);
                      setEdgeId("");
                    }
                    if (issue.edgeId) {
                      setEdgeId(issue.edgeId);
                      setSelectedId("");
                    }
                  }}
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {(error || action.error) && <Notice>{error || action.error}</Notice>}
      {action.message && (
        <Notice kind="success">
          {t(action.message)}
          {preview && (
            <a target="_blank" rel="noreferrer" href={preview}>
              {" "}
              {t("打开应用")}
              <ExternalLink size={14} />
            </a>
          )}
        </Notice>
      )}
      <div
        className={`canvas-layout ${selected || selectedEdge ? "has-selection" : "canvas-overview"}`}
      >
        <aside className="canvas-library">
          <div className="search-input">
            <Search size={15} />
            <input
              aria-label={t("搜索画布模块")}
              placeholder={t("查找模块")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label={t("画布模块分类")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">{t("全部类型")}</option>
            {[
              "commerce",
              "community",
              "foundation",
              "campus",
              "connector",
              "presentation",
              "extension",
            ].map((id) => (
              <option value={id} key={id}>
                {t(categoryLabels[id])}
              </option>
            ))}
          </select>
          <div className="canvas-library-items">
            {available
              .filter(
                (m) =>
                  (category === "all" ||
                    m.category === category ||
                    (category === "campus" && m.category === "scenario")) &&
                  `${m.name} ${t(m.name)} ${m.moduleId} ${m.tags.join(" ")}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((module) => (
                <button
                  key={module.moduleId}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/foundry-module",
                      module.moduleId,
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => add(module)}
                  aria-label={`${t("添加")}${t(module.name)}`}
                >
                  <ModuleIcon module={module} size={17} />
                  <span>
                    {t(module.name)}
                    <small>{t(categoryLabels[module.category])}</small>
                  </span>
                  <Plus size={14} />
                </button>
              ))}
          </div>
        </aside>
        {!advanced && (
          <section className="product-plan" aria-label={t("产品方案")}>
            <h2>{t("用户会用到的功能")}</h2>
            {!!features.length && (
              <ul className="plan-features">
                {features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            )}
            <div className="plan-modules">
              {nodes
                .filter(
                  (n) =>
                    !["connector", "presentation"].includes(
                      n.data.module.category,
                    ) &&
                    !["identity", "media", "search", "notifications"].includes(
                      n.data.module.moduleId,
                    ),
                )
                .map((n) => (
                  <article
                    key={n.id}
                    className={selectedId === n.id ? "selected" : ""}
                  >
                    <ModuleIcon module={n.data.module} />
                    <button
                      className="plan-module-name"
                      onClick={() => {
                        setSelectedId(n.id);
                        setEdgeId("");
                      }}
                    >
                      <strong>
                        {n.data.title === n.data.module.name
                          ? t(n.data.title)
                          : n.data.title}
                      </strong>
                      <span>{t(n.data.module.description)}</span>
                    </button>
                    <button
                      className="icon-button"
                      title={t("移除节点")}
                      aria-label={`${t("移除节点")} ${t(n.data.module.name)}`}
                      onClick={() => {
                        setNodes((all) => all.filter((a) => a.id !== n.id));
                        setEdges((all) =>
                          all.filter(
                            (e) => e.source !== n.id && e.target !== n.id,
                          ),
                        );
                        setSaved(false);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
            </div>
            <h3>{t("自动配套能力")}</h3>
            <div className="plan-support">
              {nodes
                .filter((n) =>
                  ["identity", "media", "search", "notifications"].includes(
                    n.data.module.moduleId,
                  ),
                )
                .map((n) => (
                  <span key={n.id}>
                    <ModuleIcon module={n.data.module} size={16} />
                    {t(n.data.module.name)}
                  </span>
                ))}
            </div>
            <h3>{t("功能之间的关系")}</h3>
            <div className="plan-relations">
              {edges
                .filter((e) => e.data?.mode !== "dependency")
                .map((e) => (
                  <button
                    key={e.id}
                    className={edgeIssue(e) ? "danger-text" : ""}
                    onClick={() => {
                      setEdgeId(e.id);
                      setSelectedId("");
                      setAdvanced(true);
                    }}
                  >
                    {t(nodes.find((n) => n.id === e.source)?.data.title || "")}{" "}
                    → {t(edgeLabels[e.data?.mode as keyof typeof edgeLabels])} →{" "}
                    {t(nodes.find((n) => n.id === e.target)?.data.title || "")}
                  </button>
                ))}
            </div>
            <button onClick={() => setAdvanced(true)}>
              <GitBranch size={17} />
              {t("调整功能连接")}
            </button>
          </section>
        )}
        <section
          className="canvas-surface"
          hidden={!advanced}
          aria-label={t("模块编排画布")}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const module = available.find(
              (m) =>
                m.moduleId ===
                e.dataTransfer.getData("application/foundry-module"),
            );
            if (module)
              add(
                module,
                flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
              );
          }}
        >
          <div className="canvas-mode">
            <label>
              {t("连接类型")}
              <select
                aria-label={t("连接类型")}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="auto">{t("自动识别")}</option>
                {Object.entries(edgeLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {nodes.length}
              {t("个节点 ·")}
              {edges.length}
              {t("条连接")}
            </span>
            <button
              title={t("按模块层次排列")}
              aria-label={t("按层次排列")}
              onClick={arrange}
            >
              <LayoutGrid size={17} />
            </button>
            <button onClick={repairDependencies} disabled={!nodes.length}>
              {t("补齐依赖")}
            </button>
          </div>
          <ReactFlow
            nodes={drawnNodes}
            edges={drawnEdges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              if (
                changes.some(
                  (change) =>
                    change.type !== "dimensions" && change.type !== "select",
                )
              )
                setSaved(false);
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((change) => change.type !== "select"))
                setSaved(false);
            }}
            onConnect={connect}
            onNodeDragStop={(_, node) =>
              setNodes((all) =>
                all.map((n) =>
                  n.id === node.id
                    ? {
                        ...n,
                        position: {
                          x: 40 + laneOf(n.data.module) * 400,
                          y: Math.max(140, node.position.y),
                        },
                      }
                    : n,
                ),
              )
            }
            onNodeClick={(_, n) => {
              setSelectedId(n.id);
              setEdgeId("");
            }}
            onEdgeClick={(_, e) => {
              setEdgeId(e.id);
              setSelectedId("");
            }}
            onPaneClick={() => {
              setSelectedId("");
              setEdgeId("");
            }}
            fitView
            fitViewOptions={{ maxZoom: 1, padding: 0.18 }}
            minZoom={0.15}
            maxZoom={1.6}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={20} color="#ccd5dc" />
            <ViewportPortal>
              {lanes.map((lane, i) => (
                <div
                  key={lane.name}
                  className="canvas-lane"
                  style={{
                    left: i * 400 + 20,
                    background: lane.color,
                    height: Math.max(
                      850,
                      ...nodes.map((n) => n.position.y + 230),
                    ),
                  }}
                >
                  <strong>{t(lane.name)}</strong>
                  <span>{t(lane.subtitle)}</span>
                </div>
              ))}
            </ViewportPortal>
            <Controls />
          </ReactFlow>
          {!nodes.length && (
            <div className="canvas-empty">
              <GitBranch size={36} />
              <h2>{t("新建应用")}</h2>
              <span>{t("0 个模块")}</span>
            </div>
          )}
        </section>
        <aside className="canvas-inspector" hidden={!advanced && !selected}>
          {selected ? (
            <>
              <div className="section-head">
                <h3>{t("模块属性")}</h3>
                <button
                  className="icon-button"
                  aria-label={t("关闭属性")}
                  onClick={() => setSelectedId("")}
                >
                  <X size={16} />
                </button>
              </div>
              <ModuleIcon module={selected.data.module} />
              <h3>{t(selected.data.module.name)}</h3>
              <p className="muted">{t(selected.data.module.description)}</p>
              <div className="canvas-interface-list" hidden={!advanced}>
                <strong>{t("提供的接口")}</strong>
                {selected.data.module.providedInterfaces.map((i) => (
                  <code key={i}>{i}</code>
                ))}
                <strong>{t("依赖")}</strong>
                {Object.keys(selected.data.module.dependencies).map((id) => (
                  <span key={id}>
                    {t(available.find((m) => m.moduleId === id)?.name || id)}
                  </span>
                ))}
              </div>
              <label>
                {t("显示名称")}
                <input
                  value={selected.data.title}
                  onChange={(e) => updateNode({ title: e.target.value })}
                  maxLength={60}
                />
              </label>
              {selected.data.module.recordDefinition && (
                <label>
                  {t("默认视图")}
                  <select
                    value={selected.data.view}
                    onChange={(e) =>
                      updateNode({
                        view: e.target.value as ModuleNode["data"]["view"],
                      })
                    }
                  >
                    <option value="cards">{t("卡片")}</option>
                    <option value="table">{t("表格")}</option>
                    <option value="board">{t("看板")}</option>
                  </select>
                </label>
              )}
              {selected.data.module.configurationFields.map((field) =>
                ["targetModule", "childModule"].includes(field.key) ? (
                  <label key={field.key}>
                    {t("目标模块")}
                    <select
                      value={String(
                        selected.data.configuration[field.key] || "",
                      )}
                      onChange={(e) =>
                        updateNode({
                          configuration: {
                            ...selected.data.configuration,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">{t("选择画布中的业务模块")}</option>
                      {nodes
                        .filter((n) => n.data.module.recordDefinition)
                        .map((n) => (
                          <option key={n.id} value={n.data.module.moduleId}>
                            {n.data.title}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={selected.data.configuration[field.key]}
                    onChange={(v) =>
                      updateNode({
                        configuration: {
                          ...selected.data.configuration,
                          [field.key]: v,
                        },
                      })
                    }
                  />
                ),
              )}
              {selected.data.module.moduleId === "create-linked-record" &&
                available
                  .find(
                    (m) =>
                      m.moduleId === selected.data.configuration.targetModule,
                  )
                  ?.recordDefinition?.fields.map((f) => (
                    <label key={f.key}>
                      {f.label}
                      {f.required ? " *" : ""}
                      <input
                        value={String(
                          selected.data.configuration[`data.${f.key}`] || "",
                        )}
                        onChange={(e) =>
                          updateNode({
                            configuration: {
                              ...selected.data.configuration,
                              [`data.${f.key}`]: e.target.value,
                            },
                          })
                        }
                        placeholder={`固定值或 {data.${f.key}}`}
                      />
                    </label>
                  ))}
              <hr />
              <Link to={`/modules/${selected.data.module.moduleId}`}>
                {t("查看模块详情")}
                <ExternalLink size={14} />
              </Link>
              <button
                className="danger-button"
                onClick={() => {
                  setNodes((all) => all.filter((n) => n.id !== selected.id));
                  setEdges((all) =>
                    all.filter(
                      (e) =>
                        e.source !== selected.id && e.target !== selected.id,
                    ),
                  );
                  setSelectedId("");
                  setSaved(false);
                }}
              >
                <Trash2 size={15} />
                {t("移除节点")}
              </button>
            </>
          ) : selectedEdge ? (
            <>
              <h3>{t("连接属性")}</h3>
              {edgeIssue(selectedEdge) && (
                <Notice>{edgeIssue(selectedEdge)!.message}</Notice>
              )}
              <label>
                {t("行为")}
                <select
                  value={String(selectedEdge.data?.mode)}
                  onChange={(e) => {
                    setEdges((all) =>
                      all.map((edge) =>
                        edge.id === selectedEdge.id
                          ? {
                              ...edge,
                              data: { mode: e.target.value },
                              label:
                                edgeLabels[
                                  e.target.value as keyof typeof edgeLabels
                                ],
                            }
                          : edge,
                      ),
                    );
                    setSaved(false);
                  }}
                >
                  {Object.entries(edgeLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => {
                  setEdges((all) =>
                    all.filter((e) => e.id !== selectedEdge.id),
                  );
                  setEdgeId("");
                  setSaved(false);
                }}
              >
                <Trash2 size={15} />
                {t("删除连接")}
              </button>
            </>
          ) : (
            <>
              <h3>{t("应用结构")}</h3>
              <p>
                {nodes.length}
                {t("个可配置节点")}
              </p>
              <p>
                {edges.length}
                {t("条连接")}
              </p>
              {currentProject && (
                <Link to={`/projects/${currentProject}`}>
                  {t("项目工作区")}
                  <ExternalLink size={15} />
                </Link>
              )}
            </>
          )}
        </aside>
      </div>
      <div className="canvas-layer-legend" hidden={!advanced}>
        {lanes.map((lane, i) => (
          <span key={lane.name}>
            <i style={{ background: lane.color }} />
            {t(lane.name)} ·{" "}
            {nodes.filter((n) => laneOf(n.data.module) === i).length}
          </span>
        ))}
      </div>
      <div className="canvas-link-editor" hidden={!advanced}>
        <strong>{t("连接模块")}</strong>
        <select
          aria-label={t("连线起点")}
          value={linkSource}
          onChange={(e) => setLinkSource(e.target.value)}
        >
          <option value="">{t("选择输出模块")}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.title}
            </option>
          ))}
        </select>
        <span>→</span>
        <select
          aria-label={t("连线终点")}
          value={linkTarget}
          onChange={(e) => setLinkTarget(e.target.value)}
        >
          <option value="">{t("选择输入模块")}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.title}
            </option>
          ))}
        </select>
        <button
          disabled={!linkSource || !linkTarget}
          onClick={() =>
            connect({
              source: linkSource,
              target: linkTarget,
              sourceHandle: null,
              targetHandle: null,
            })
          }
        >
          <Plus size={17} />
          {t("添加连线")}
        </button>
      </div>
    </div>
  );
}
