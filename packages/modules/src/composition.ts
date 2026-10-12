import {
  AppError,
  type Composition,
  type ModuleManifest,
  type ProductSpec,
} from "../../contracts/src/index.js";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;
const sourceMessage: Translate = (key, values = {}) =>
  key.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ""),
  );

export function connectionError(
  graph: Composition,
  edge: Composition["edges"][number],
  available: ModuleManifest[],
  translate: Translate = sourceMessage,
): string | null {
  const a = graph.nodes.find((n) => n.id === edge.source),
    b = graph.nodes.find((n) => n.id === edge.target);
  const from = available.find((m) => m.moduleId === a?.moduleId),
    to = available.find((m) => m.moduleId === b?.moduleId);
  if (!from || !to || a?.id === b?.id)
    return translate("连线端点无效，模块不能连接自己");
  if (edge.mode === "dependency")
    return to.dependencies[from.moduleId] &&
      to.requiredInterfaces.some((i) => from.providedInterfaces.includes(i))
      ? null
      : translate("{{target}}不依赖{{source}}的接口", {
          target: translate(to.name),
          source: translate(from.name),
        });
  if (
    edge.mode === "flow" &&
    (!(from.recordDefinition || from.category === "connector") ||
      to.category !== "connector")
  )
    return translate("自动化输入必须是业务记录或连接器，输出必须是连接器");
  if (
    edge.mode === "display" &&
    (!from.recordDefinition || to.category !== "presentation")
  )
    return translate("展示组件只接受业务记录数据；订单和库存需要专用交易界面");
  if (edge.mode === "embed" && (!from.recordDefinition || !to.recordDefinition))
    return translate("内嵌只支持两个业务记录模块");
  if (
    edge.mode === "notify" &&
    (!from.recordDefinition || to.moduleId !== "notifications")
  )
    return translate("通知连线必须从业务记录连接站内通知");
  if (
    edge.mode === "navigate" &&
    (["connector", "presentation"].includes(from.category) ||
      ["connector", "presentation"].includes(to.category))
  )
    return translate("页面跳转只能连接有业务界面的模块");
  if (
    edge.mode === "navigate" &&
    [from, to].some((m) => ["identity", "search", "media"].includes(m.moduleId))
  )
    return translate("身份、搜索和存储由业务界面调用，请使用依赖接口连接");
  return null;
}

export type CompositionIssue = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
};
export function compositionIssues(
  spec: ProductSpec,
  available: ModuleManifest[],
  translate: Translate = sourceMessage,
): CompositionIssue[] {
  const graph = spec.composition;
  if (!graph) return [];
  const issues: CompositionIssue[] = [];
  for (const edge of graph.edges) {
    const message = connectionError(graph, edge, available, translate);
    if (message) issues.push({ code: "CONNECTION", message, edgeId: edge.id });
  }
  if (graph.version === 2) {
    if (spec.description.trim().length < 12)
      issues.push({
        code: "INTENT",
        message: translate(
          "请描述目标用户、主要业务流程与完成条件（至少 12 字）",
        ),
      });
    for (const node of graph.nodes) {
      const module = available.find((m) => m.moduleId === node.moduleId);
      if (!module) continue;
      for (const dependency of Object.keys(module.dependencies)) {
        const provider = graph.nodes.find((n) => n.moduleId === dependency);
        if (!provider)
          issues.push({
            code: "DEPENDENCY",
            nodeId: node.id,
            message: translate("{{module}}缺少依赖：{{dependency}}", {
              module: translate(module.name),
              dependency: translate(
                available.find((m) => m.moduleId === dependency)?.name ||
                  dependency,
              ),
            }),
          });
        else if (
          !graph.edges.some(
            (e) =>
              e.mode === "dependency" &&
              e.source === provider.id &&
              e.target === node.id,
          )
        )
          issues.push({
            code: "DEPENDENCY_LINK",
            nodeId: node.id,
            message: translate("{{module}}尚未连接依赖：{{dependency}}", {
              module: translate(module.name),
              dependency: translate(
                available.find((m) => m.moduleId === dependency)?.name ||
                  dependency,
              ),
            }),
          });
      }
      if (
        ["connector", "presentation"].includes(module.category) &&
        !graph.edges.some(
          (e) => e.target === node.id && ["flow", "display"].includes(e.mode),
        )
      )
        issues.push({
          code: "INPUT",
          nodeId: node.id,
          message: translate("{{module}}没有业务输入", {
            module: translate(module.name),
          }),
        });
    }
    if (
      !graph.nodes.some((n) => {
        const m = available.find((m) => m.moduleId === n.moduleId);
        return (
          m?.recordDefinition ||
          m?.category === "commerce" ||
          m?.category === "community" ||
          ["events", "groups", "content", "profiles", "campus"].includes(
            n.moduleId,
          )
        );
      })
    )
      issues.push({
        code: "NO_BUSINESS",
        message: translate("至少添加一个有业务界面的模块"),
      });
  }
  try {
    validateComposition(
      { ...spec, composition: { ...graph, version: 1 } },
      available,
      translate,
    );
  } catch (e) {
    const message = (e as Error).message;
    if (!issues.some((i) => i.message === message))
      issues.push({ code: "GRAPH", message });
  }
  return issues;
}

export function validateComposition(
  spec: ProductSpec,
  available: ModuleManifest[],
  translate: Translate = sourceMessage,
) {
  const graph = spec.composition;
  if (!graph) return;
  if (graph.version === 2) {
    const issues = compositionIssues(spec, available, translate);
    if (issues.length)
      throw new AppError(
        422,
        "INVALID_COMPOSITION",
        issues.map((i) => i.message).join("；"),
      );
  }
  const fail = (
    message: string,
    values?: Record<string, string | number>,
  ): never => {
    throw new AppError(422, "INVALID_COMPOSITION", translate(message, values));
  };
  const registry = new Map(available.map((m) => [m.moduleId, m]));
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  if (
    nodes.size !== graph.nodes.length ||
    new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length
  )
    fail("节点或连线 ID 重复");
  const collections = new Set<string>();
  for (const node of graph.nodes) {
    const module = registry.get(node.moduleId);
    if (!module || !spec.modules.includes(node.moduleId))
      fail("画布包含未安装模块");
    if (module!.recordDefinition) {
      if (collections.has(node.moduleId))
        fail("同一业务模块在画布中只能有一个入口");
      collections.add(node.moduleId);
    }
    for (const field of module!.configurationFields) {
      const value = node.configuration[field.key];
      if (field.required && (value === undefined || value === ""))
        fail("{{module}}缺少配置：{{field}}", {
          module: translate(module!.name),
          field: translate(field.label),
        });
      if (
        value !== undefined &&
        (field.type === "number"
          ? typeof value !== "number"
          : typeof value !== "string")
      )
        fail("节点配置类型不正确");
      if (field.options && !field.options.includes(String(value)))
        fail("节点配置不在允许选项中");
    }
    if (["create-linked-record", "embedded-list"].includes(node.moduleId)) {
      const target = String(
        node.configuration[
          node.moduleId === "embedded-list" ? "childModule" : "targetModule"
        ],
      );
      if (
        !registry.get(target)?.recordDefinition ||
        !spec.modules.includes(target)
      )
        fail("创建关联记录的目标必须是已安装业务模块");
      if (!graph.nodes.some((n) => n.moduleId === target))
        fail("目标业务模块必须在画布中");
    }
  }
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const error = connectionError(graph, edge, available, translate);
    if (error) fail(error);
    const source = nodes.get(edge.source),
      target = nodes.get(edge.target);
    if (!source || !target || source.id === target.id) fail("连线端点无效");
    const from = registry.get(source!.moduleId)!,
      to = registry.get(target!.moduleId)!;
    const key = `${edge.source}:${edge.target}:${edge.mode}`;
    if (seen.has(key)) fail("重复连线");
    seen.add(key);
    if (
      edge.mode === "flow" &&
      (!(from.recordDefinition || from.category === "connector") ||
        to.category !== "connector")
    )
      fail("自动化连线需要业务记录或连接节点作为输入，连接节点作为输出");
    if (
      edge.mode === "display" &&
      (!from.recordDefinition || to.category !== "presentation")
    )
      fail("展示连线必须从业务模块连接到展示组件");
    if (
      edge.mode === "embed" &&
      (!from.recordDefinition || !to.recordDefinition)
    )
      fail("内嵌连线必须连接两个业务模块");
    if (
      edge.mode === "notify" &&
      (!from.recordDefinition || to.moduleId !== "notifications")
    )
      fail("通知连线必须连接业务模块和站内通知");
    if (
      edge.mode === "navigate" &&
      (["connector", "presentation"].includes(from.category) ||
        ["connector", "presentation"].includes(to.category))
    )
      fail("页面跳转只能连接有业务界面的模块");
  }
  const links = graph.edges.filter((e) => e.mode === "flow");
  for (const node of graph.nodes)
    for (const child of connectedModules(graph, node.moduleId, "embed"))
      links.push({
        id: `derived-${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        mode: "embed",
      });
  const visiting = new Set<string>(),
    depths = new Map<string, number>();
  const walk = (id: string): number => {
    if (visiting.has(id)) fail("自动化或内嵌连接存在循环");
    if (depths.has(id)) return depths.get(id)!;
    visiting.add(id);
    const depth = Math.max(
      0,
      ...links.filter((e) => e.source === id).map((e) => walk(e.target) + 1),
    );
    visiting.delete(id);
    depths.set(id, depth);
    if (depth > 16) fail("连接超过 16 层");
    return depth;
  };
  for (const node of graph.nodes) walk(node.id);
  // A connection must never widen the visibility of its source records.
  for (const root of graph.nodes) {
    const visibility = registry.get(root.moduleId)?.recordDefinition
      ?.visibility;
    if (!visibility) continue;
    const checked = new Set<string>();
    const inspect = (id: string, embedDepth: number) => {
      const state = `${id}:${embedDepth}`;
      if (checked.has(state)) return;
      checked.add(state);
      for (const link of links.filter((e) => e.source === id)) {
        const next = nodes.get(link.target)!;
        const targetId =
          next.moduleId === "create-linked-record"
            ? String(next.configuration.targetModule)
            : next.moduleId;
        if (
          visibility === "owner" &&
          registry.get(targetId)?.recordDefinition?.visibility === "application"
        )
          fail("私有记录不能连接到共享记录模块");
        const depth = embedDepth + (link.mode === "embed" ? 1 : 0);
        if (depth > 3) fail("内嵌记录最多支持 3 层");
        inspect(next.id, depth);
      }
    };
    inspect(root.id, 0);
  }
  for (const node of graph.nodes)
    if (
      links.filter((e) => e.target === node.id && e.mode === "embed").length > 1
    )
      fail("内嵌模块只能有一个父模块");
  for (const node of graph.nodes) {
    if (
      links.filter((e) => e.target === node.id && e.mode === "flow").length > 1
    )
      fail("自动化节点只能有一个上游输入");
    const displays = connectedModules(graph, node.moduleId, "display").filter(
      (n) => ["card-view", "table-view", "board-view"].includes(n.moduleId),
    );
    if (displays.length > 1) fail("一个业务模块只能连接一种默认视图");
  }
}

export function moduleReferences(input: string, modules: ModuleManifest[]) {
  const names = modules
    .flatMap((m) =>
      [m.moduleId, m.name, ...m.aliases].map((name) => ({
        name,
        id: m.moduleId,
      })),
    )
    .sort((a, b) => b.name.length - a.name.length);
  const ids = new Set<string>(),
    unknown: string[] = [];
  for (const match of input.matchAll(/\+([\p{L}\p{N}][\p{L}\p{N}-]*)/gu)) {
    const token = match[1];
    const matches = names.filter(
      (item) => item.name.toLowerCase() === token.toLowerCase(),
    );
    const unique = [...new Set(matches.map((m) => m.id))];
    if (unique.length === 1) ids.add(unique[0]);
    else unknown.push(token);
  }
  return { moduleIds: [...ids], unknown };
}

export function connectedModules(
  graph: Composition | undefined,
  moduleId: string,
  mode: Composition["edges"][number]["mode"],
) {
  if (!graph) return [];
  const source = graph.nodes.find((n) => n.moduleId === moduleId);
  const direct = graph.edges
    .filter((e) => e.source === source?.id && e.mode === mode)
    .map((e) => graph.nodes.find((n) => n.id === e.target)!)
    .filter(Boolean);
  if (mode !== "embed") return direct;
  const embedded = graph.edges
    .filter((e) => e.source === source?.id && e.mode === "display")
    .flatMap((e) => {
      const widget = graph.nodes.find((n) => n.id === e.target);
      return widget?.moduleId === "embedded-list"
        ? graph.nodes.filter(
            (n) => n.moduleId === widget.configuration.childModule,
          )
        : [];
    });
  return [...direct, ...embedded];
}
export function compositionLayer(module: {
  moduleId: string;
  category: string;
}): 0 | 1 | 2 | 3 {
  // These original domain services remain in the foundation catalog for compatibility.
  if (["profiles", "campus", "events", "groups"].includes(module.moduleId))
    return 1;
  return module.category === "foundation"
    ? 0
    : module.category === "connector"
      ? 2
      : module.category === "presentation"
        ? 3
        : 1;
}
