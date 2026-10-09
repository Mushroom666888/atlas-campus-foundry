import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowRight,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Table2,
  Columns3,
} from "lucide-react";
import type {
  ModuleField,
  ModuleManifest,
  ProductSpec,
  PublicUser,
} from "../packages/contracts/src/index";
import type { ModuleRecord } from "../packages/modules/src/records";
import { businessCatalog } from "../packages/modules/src/business-catalog";
import { connectedModules } from "../packages/modules/src/composition";
import { api, post } from "./api";
import { Empty, Modal, Notice, useAction } from "./components";

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ModuleField;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <label>
      {field.label}
      {field.required && <span className="required-mark"> *</span>}
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          required={field.required}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          required={field.required}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">选择{field.label}</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : (
        <input
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "url"
                  ? "url"
                  : "text"
          }
          required={field.required}
          min={field.min}
          max={field.max}
          step={field.type === "number" ? "any" : undefined}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(
              field.type === "number" && e.target.value !== ""
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
export function sampleData(module: ModuleManifest) {
  return Object.fromEntries(
    module.recordDefinition!.fields.map((f) => [
      f.key,
      f.type === "number"
        ? Math.min(f.max ?? 10, 3)
        : f.type === "date"
          ? "2026-10-12"
          : f.type === "select"
            ? f.options![0]
            : f.type === "url"
              ? "https://example.org"
              : f.type === "boolean"
                ? false
                : `${f.label}示例`,
    ]),
  );
}
export function RecordModule({
  module,
  user,
  spec,
  preview = false,
  contextId,
  depth = 0,
  onNavigate,
}: {
  module: ModuleManifest;
  user?: PublicUser;
  spec?: ProductSpec;
  preview?: boolean;
  contextId?: string;
  depth?: number;
  onNavigate?: (id: string) => void;
}) {
  const definition = module.recordDefinition!;
  const display = connectedModules(
    spec?.composition,
    module.moduleId,
    "display",
  ).map((n) => n.moduleId);
  const initialView = display.includes("table-view")
    ? "table"
    : display.includes("board-view")
      ? "board"
      : display.includes("card-view")
        ? "cards"
        : spec?.composition?.nodes.find((n) => n.moduleId === module.moduleId)
            ?.view || definition.view;
  const [view, setView] = useState(initialView),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [revision, setRevision] = useState(0);
  const [items, setItems] = useState<ModuleRecord[]>(
    preview
      ? [
          {
            id: "preview",
            module_id: module.moduleId,
            owner_id: "preview",
            title: `${module.name}示例`,
            data: sampleData(module),
            status: definition.statuses[0],
            context_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      : [],
  );
  const [counts, setCounts] = useState<{ status: string; count: number }[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!preview);
  const [selected, setSelected] = useState<ModuleRecord | null>(null),
    [editing, setEditing] = useState<ModuleRecord | "new" | null>(null);
  const action = useAction();
  const endpoint = `/api/modules/${module.moduleId}/records`;
  useEffect(() => {
    if (preview) return;
    let current = true;
    setLoading(true);
    const params = new URLSearchParams({ q: query });
    if (status) params.set("status", status);
    if (contextId) params.set("contextId", contextId);
    void api<{
      items: ModuleRecord[];
      counts: { status: string; count: number }[];
    }>(`${endpoint}?${params}`)
      .then((data) => {
        if (current) {
          setItems(data.items);
          setCounts(data.counts);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [endpoint, query, status, revision, contextId, preview]);
  const visible = preview
    ? items.filter(
        (r) =>
          (!query || JSON.stringify(r).includes(query)) &&
          (!status || r.status === status),
      )
    : items;
  const own = (item: ModuleRecord) => preview || item.owner_id === user?.id;
  const refresh = () => setRevision((v) => v + 1);
  async function changeStatus(item: ModuleRecord, next: string) {
    await action.run(async () => {
      if (preview)
        setItems((rows) =>
          rows.map((row) =>
            row.id === item.id ? { ...row, status: next } : row,
          ),
        );
      else {
        await api(`${endpoint}/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        });
        refresh();
      }
      if (selected?.id === item.id) setSelected({ ...item, status: next });
    });
  }
  const card = (item: ModuleRecord) => (
    <article className="business-card" key={item.id}>
      <button className="record-title" onClick={() => setSelected(item)}>
        {item.title}
        <ArrowRight size={14} />
      </button>
      <dl>
        {definition.fields.slice(0, 3).map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{String(item.data[field.key] ?? "—")}</dd>
          </div>
        ))}
      </dl>
      <footer>
        {own(item) ? (
          <select
            aria-label={`${item.title}状态`}
            value={item.status}
            disabled={action.busy}
            onChange={(e) => void changeStatus(item, e.target.value)}
          >
            {definition.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ) : (
          <span className="badge">{item.status}</span>
        )}
      </footer>
    </article>
  );
  return (
    <section
      className={`record-module ${depth ? "embedded-module" : ""}`}
      data-module-id={module.moduleId}
    >
      <div className="section-head">
        <div>
          <h2>
            {spec?.composition?.nodes.find(
              (n) => n.moduleId === module.moduleId,
            )?.title || module.name}
          </h2>
          <small className="muted">
            {preview
              ? "交互预览 · 示例数据仅保留本页"
              : definition.visibility === "owner"
                ? "仅自己可见"
                : "应用内共享 · 创建者可编辑"}
          </small>
        </div>
        <button className="primary" onClick={() => setEditing("new")}>
          <Plus size={16} />
          新增
        </button>
      </div>
      {error && <Notice>{error}</Notice>}
      {action.error && <Notice>{action.error}</Notice>}
      <div className="record-toolbar">
        {(!spec?.composition || display.includes("keyword-search")) && (
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label={`搜索${module.name}`}
              placeholder="搜索记录"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        {(!spec?.composition || display.includes("status-picker")) && (
          <label className="status-control">
            <ListFilter size={16} />
            <select
              aria-label="筛选状态"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              {definition.statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <div className="segmented">
          {(
            [
              ["cards", LayoutGrid, "卡片"],
              ["table", Table2, "表格"],
              ["board", Columns3, "看板"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              className={view === id ? "selected" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
      {(display.includes("metric-counter") ||
        display.includes("status-summary")) && (
        <div className="record-metrics">
          <strong>
            {preview ? visible.length : counts.reduce((n, c) => n + c.count, 0)}{" "}
            <small>条记录</small>
          </strong>
          {display.includes("status-summary") &&
            definition.statuses.map((s) => (
              <span key={s}>
                {s}{" "}
                <b>
                  {preview
                    ? visible.filter((r) => r.status === s).length
                    : counts.find((c) => c.status === s)?.count || 0}
                </b>
              </span>
            ))}
        </div>
      )}
      {loading ? (
        <p className="muted">正在加载…</p>
      ) : !visible.length ? (
        <Empty>暂无符合条件的记录</Empty>
      ) : view === "table" ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{definition.titleLabel}</th>
                {definition.fields.slice(0, 4).map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(r)}
                    >
                      {r.title}
                    </button>
                  </td>
                  {definition.fields.slice(0, 4).map((f) => (
                    <td key={f.key}>{String(r.data[f.key] ?? "—")}</td>
                  ))}
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "board" ? (
        <div className="record-board">
          {definition.statuses.map((s) => (
            <section key={s}>
              <h3>
                {s}
                <span>{visible.filter((r) => r.status === s).length}</span>
              </h3>
              {visible.filter((r) => r.status === s).map(card)}
            </section>
          ))}
        </div>
      ) : (
        <div className="record-grid">{visible.map(card)}</div>
      )}
      {onNavigate && (
        <div className="inline-actions">
          {connectedModules(spec?.composition, module.moduleId, "navigate").map(
            (n) => (
              <button key={n.id} onClick={() => onNavigate(n.moduleId)}>
                {n.title ||
                  businessCatalog.find((m) => m.moduleId === n.moduleId)
                    ?.name ||
                  n.moduleId}
                <ArrowRight size={16} />
              </button>
            ),
          )}
        </div>
      )}
      {editing && (
        <RecordEditor
          module={module}
          record={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (preview) {
              const item = {
                id: editing === "new" ? crypto.randomUUID() : editing.id,
                module_id: module.moduleId,
                owner_id: "preview",
                ...input,
                context_id: contextId ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as ModuleRecord;
              setItems((rows) =>
                editing === "new"
                  ? [item, ...rows]
                  : rows.map((r) => (r.id === item.id ? item : r)),
              );
            } else if (editing === "new")
              await post(endpoint, { ...input, contextId });
            else
              await api(`${endpoint}/${editing.id}`, {
                method: "PATCH",
                body: JSON.stringify(input),
              });
            setEditing(null);
            setSelected(null);
            refresh();
          }}
        />
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <span className="badge">{selected.status}</span>
          <dl className="definition-list">
            {definition.fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {f.type === "url" &&
                  /^https?:\/\//.test(String(selected.data[f.key])) ? (
                    <a
                      href={String(selected.data[f.key])}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {String(selected.data[f.key])}
                    </a>
                  ) : (
                    String(selected.data[f.key] ?? "—")
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {own(selected) && (
            <div className="inline-actions">
              <button
                onClick={() => {
                  setEditing(selected);
                  setSelected(null);
                }}
              >
                编辑
              </button>
              <button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    if (preview)
                      setItems((rows) =>
                        rows.filter((r) => r.id !== selected.id),
                      );
                    else
                      await api(`${endpoint}/${selected.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ archived: true }),
                      });
                    setSelected(null);
                    refresh();
                  })
                }
              >
                <Archive size={15} />
                归档
              </button>
            </div>
          )}
          {depth < 3 &&
            !preview &&
            connectedModules(spec?.composition, module.moduleId, "embed").map(
              (node) => {
                const child = businessCatalog.find(
                  (m) => m.moduleId === node.moduleId,
                );
                return child ? (
                  <RecordModule
                    key={node.id}
                    module={child}
                    user={user}
                    spec={spec}
                    contextId={selected.id}
                    depth={depth + 1}
                  />
                ) : null;
              },
            )}
        </Modal>
      )}
    </section>
  );
}
function RecordEditor({
  module,
  record,
  onClose,
  onSave,
}: {
  module: ModuleManifest;
  record?: ModuleRecord;
  onClose: () => void;
  onSave: (input: {
    title: string;
    data: Record<string, unknown>;
    status: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(record?.title || ""),
    [data, setData] = useState<Record<string, unknown>>(record?.data || {}),
    [status, setStatus] = useState(
      record?.status || module.recordDefinition!.statuses[0],
    );
  const action = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void action.run(() =>
      onSave({
        title,
        data: Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== ""),
        ),
        status,
      }),
    );
  }
  return (
    <Modal
      title={`${record ? "编辑" : "新增"}${module.name}`}
      onClose={onClose}
    >
      <form className="record-form" onSubmit={submit}>
        {action.error && <Notice>{action.error}</Notice>}
        <label>
          {module.recordDefinition!.titleLabel}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
        </label>
        {module.recordDefinition!.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={data[field.key]}
            onChange={(v) => setData({ ...data, [field.key]: v })}
          />
        ))}
        <label>
          状态
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {module.recordDefinition!.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={action.busy}>
          保存
        </button>
      </form>
    </Modal>
  );
}
