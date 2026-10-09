import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
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
} from "lucide-react";
import type {
  Composition,
  ModuleManifest,
  ProductSpec,
  PublicUser,
} from "../packages/contracts/src/index";
import { validateComposition } from "../packages/modules/src/composition";
import { resolveModules } from "../packages/modules/src/catalog";
import { api, post, useLoad } from "./api";
import { Notice, useAction } from "./components";
import { categoryLabels, ModuleIcon } from "./module-studio";
import { FieldInput } from "./record-module";

type ModuleNode = Node<
  {
    module: ModuleManifest;
    title: string;
    configuration: Record<string, string | number | boolean>;
    view?: "cards" | "table" | "board";
  },
  "module"
>;
function CanvasNode({ data, selected }: NodeProps<ModuleNode>) {
  return (
    <div
      className={`canvas-module ${selected ? "selected" : ""} ${data.module.category}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label={`${data.module.name}输入`}
      />
      <header>
        <ModuleIcon module={data.module} size={19} />
        <div>
          <strong>{data.title}</strong>
          <small>{categoryLabels[data.module.category]}</small>
        </div>
      </header>
      <div className="node-contract">
        <span>
          {data.module.category === "connector"
            ? "事件"
            : data.module.category === "presentation"
              ? "记录"
              : "账号 / 数据"}
        </span>
        <span>
          {data.module.category === "presentation"
            ? "界面"
            : data.module.category === "connector"
              ? "结果"
              : "记录 / 事件"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        aria-label={`${data.module.name}输出`}
      />
    </div>
  );
}
const nodeTypes = { module: CanvasNode };
const edgeLabels = {
  navigate: "页面跳转",
  embed: "内嵌记录",
  notify: "创建后通知",
  flow: "自动化",
  display: "展示数据",
};
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
    [name, setName] = useState("我的校园应用"),
    [mode, setMode] = useState("auto"),
    [preview, setPreview] = useState("");
  const [currentProject, setCurrentProject] = useState(
      params.get("project") || "",
    ),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const action = useAction(),
    flow = useReactFlow<ModuleNode>(),
    initialized = useRef(false);
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
      position = {
        x: 80 + (nodes.length % 3) * 280,
        y: 80 + Math.floor(nodes.length / 3) * 180,
      },
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
    [nodes.length],
  );
  useEffect(() => {
    if (!registry.data || initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        let graph: Composition | undefined;
        if (params.get("project")) {
          const data = await api<{ project: { spec: ProductSpec } }>(
            `/api/projects/${params.get("project")}`,
          );
          setName(data.project.spec.name);
          graph = data.project.spec.composition;
          if (!graph)
            graph = {
              version: 1,
              nodes: data.project.spec.modules.map((id, i) => ({
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
            const node = makeNode(module);
            setNodes([node]);
            setSelectedId(node.id);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [registry.data, params, user.id, makeNode, setEdges, setNodes]);
  function graph(): Composition {
    return {
      version: 1,
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
          graph: {
            version: 1,
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
  }, [nodes, edges, name, currentProject, user.id]);
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
    const node = makeNode(module, position);
    setNodes((all) => [...all, node]);
    setSelectedId(node.id);
    setSaved(false);
  }
  function connect(connection: Connection) {
    const source = nodes.find((n) => n.id === connection.source),
      target = nodes.find((n) => n.id === connection.target);
    if (!source || !target || source.id === target.id) return;
    const kind =
      mode !== "auto"
        ? mode
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
        const modules = resolveModules(
          nodes.map((n) => n.data.module.moduleId),
          available,
        ).map((m) => m.moduleId);
        const spec: ProductSpec = {
          name: name.trim() || "我的校园应用",
          description:
            nodes.map((n) => n.data.title).join("、") + "组成的校园应用",
          kind: "custom",
          modules,
          features: [],
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
            { idea: "Visual composition", spec },
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
  return (
    <div className="visual-builder">
      <header className="canvas-toolbar">
        <Link className="icon-button" to="/modules" title="模块仓库">
          <ArrowLeft size={18} />
        </Link>
        <GitBranch size={21} />
        <input
          aria-label="应用名称"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
        />
        <span className="save-state">{saved ? "已保存" : "草稿"}</span>
        <button
          disabled={action.busy || !nodes.length}
          onClick={() => void save(false)}
        >
          <Save size={16} />
          保存
        </button>
        <button
          className="primary"
          disabled={action.busy || !nodes.length}
          onClick={() => void save(true)}
        >
          <Play size={16} />
          {action.busy ? "正在生成…" : "生成应用"}
        </button>
      </header>
      {(error || action.error) && <Notice>{error || action.error}</Notice>}
      {action.message && (
        <Notice kind="success">
          {action.message}
          {preview && (
            <a target="_blank" rel="noreferrer" href={preview}>
              {" "}
              打开应用 <ExternalLink size={14} />
            </a>
          )}
        </Notice>
      )}
      <div className="canvas-layout">
        <aside className="canvas-library">
          <div className="search-input">
            <Search size={15} />
            <input
              aria-label="搜索画布模块"
              placeholder="查找模块"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="画布模块分类"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">全部类型</option>
            {["foundation", "campus", "connector", "presentation"].map((id) => (
              <option value={id} key={id}>
                {categoryLabels[id]}
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
                  `${m.name} ${m.moduleId} ${m.tags.join(" ")}`
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
                  aria-label={`添加${module.name}`}
                >
                  <ModuleIcon module={module} size={17} />
                  <span>
                    {module.name}
                    <small>{categoryLabels[module.category]}</small>
                  </span>
                  <Plus size={14} />
                </button>
              ))}
          </div>
        </aside>
        <section
          className="canvas-surface"
          aria-label="模块编排画布"
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
              连接类型
              <select
                aria-label="连接类型"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="auto">自动识别</option>
                {Object.entries(edgeLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {nodes.length} 个节点 · {edges.length} 条连接
            </span>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              setSaved(false);
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              setSaved(false);
            }}
            onConnect={connect}
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
            minZoom={0.3}
            maxZoom={1.6}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={20} color="#ccd5dc" />
            <Controls />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) =>
                (n as ModuleNode).data.module.category === "connector"
                  ? "#bd7b33"
                  : "#168676"
              }
            />
          </ReactFlow>
          {!nodes.length && (
            <div className="canvas-empty">
              <GitBranch size={36} />
              <h2>新建应用</h2>
              <span>0 个模块</span>
            </div>
          )}
        </section>
        <aside className="canvas-inspector">
          {selected ? (
            <>
              <div className="section-head">
                <h3>模块属性</h3>
                <button
                  className="icon-button"
                  aria-label="关闭属性"
                  onClick={() => setSelectedId("")}
                >
                  <X size={16} />
                </button>
              </div>
              <ModuleIcon module={selected.data.module} />
              <h3>{selected.data.module.name}</h3>
              <p className="muted">{selected.data.module.description}</p>
              <label>
                显示名称
                <input
                  value={selected.data.title}
                  onChange={(e) => updateNode({ title: e.target.value })}
                  maxLength={60}
                />
              </label>
              {selected.data.module.recordDefinition && (
                <label>
                  默认视图
                  <select
                    value={selected.data.view}
                    onChange={(e) =>
                      updateNode({
                        view: e.target.value as ModuleNode["data"]["view"],
                      })
                    }
                  >
                    <option value="cards">卡片</option>
                    <option value="table">表格</option>
                    <option value="board">看板</option>
                  </select>
                </label>
              )}
              {selected.data.module.configurationFields.map((field) =>
                ["targetModule", "childModule"].includes(field.key) ? (
                  <label key={field.key}>
                    目标模块
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
                      <option value="">选择画布中的业务模块</option>
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
                查看模块详情 <ExternalLink size={14} />
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
                移除节点
              </button>
            </>
          ) : selectedEdge ? (
            <>
              <h3>连接属性</h3>
              <label>
                行为
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
                      {label}
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
                删除连接
              </button>
            </>
          ) : (
            <>
              <h3>应用结构</h3>
              <p>{nodes.length} 个可配置节点</p>
              <p>{edges.length} 条连接</p>
              {currentProject && (
                <Link to={`/projects/${currentProject}`}>
                  项目工作区 <ExternalLink size={15} />
                </Link>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
