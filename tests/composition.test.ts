import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, resolveModules } from "../packages/modules/src/catalog.js";
import {
  compositionIssues,
  validateComposition,
  moduleReferences,
} from "../packages/modules/src/composition.js";
import type {
  ProductSpec,
  Composition,
} from "../packages/contracts/src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createControl } from "../server/control.js";

test("guided canvas validates intent, complete dependency wiring, port types and missing inputs", () => {
  const modules = resolveModules([
    "sales-orders",
    "discussion-forum",
    "table-view",
  ]);
  const graph: Composition = {
    version: 2,
    nodes: modules.map((m) => ({
      id: m.moduleId,
      moduleId: m.moduleId,
      configuration: {},
      position: { x: 0, y: 0 },
    })),
    edges: modules.flatMap((m) =>
      Object.keys(m.dependencies).map((dep) => ({
        id: `${dep}-${m.moduleId}`,
        source: dep,
        target: m.moduleId,
        mode: "dependency" as const,
      })),
    ),
  };
  const spec: ProductSpec = {
    name: "经营测试",
    description: "学生在校内购买二手教材，商家接单并当面交付",
    kind: "custom",
    modules: modules.map((m) => m.moduleId),
    features: [],
    primaryColor: "green",
    composition: graph,
  };
  assert.ok(
    compositionIssues(spec, catalog).some(
      (i) => i.code === "INPUT" && i.nodeId === "table-view",
    ),
  );
  graph.edges.push({
    id: "bad",
    source: "sales-orders",
    target: "table-view",
    mode: "display",
  });
  assert.ok(compositionIssues(spec, catalog).some((i) => i.edgeId === "bad"));
  assert.throws(() => validateComposition(spec, catalog), /订单|展示/);
  graph.edges = graph.edges.filter((e) => e.id !== "bad");
  graph.nodes = graph.nodes.filter((n) => n.moduleId !== "table-view");
  spec.modules = spec.modules.filter((id) => id !== "table-view");
  validateComposition(spec, catalog);
  assert.deepEqual(compositionIssues(spec, catalog), []);
  assert.ok(
    compositionIssues({ ...spec, description: "拖拽" }, catalog).some(
      (i) => i.code === "INTENT",
    ),
  );
  const missing = {
    ...spec,
    composition: {
      ...graph,
      edges: graph.edges.filter(
        (e) => !(e.source === "stock-inventory" && e.target === "sales-orders"),
      ),
    },
  };
  assert.ok(
    compositionIssues(missing, catalog).some(
      (i) => i.code === "DEPENDENCY_LINK",
    ),
  );
  assert.throws(() => validateComposition(missing, catalog), /库存/);
  graph.edges.push({
    id: "self",
    source: "sales-orders",
    target: "sales-orders",
    mode: "navigate",
  });
  assert.ok(compositionIssues(spec, catalog).some((i) => i.edgeId === "self"));
  assert.deepEqual(
    moduleReferences(
      "交易平台 +交易 +店铺 +论坛 +个人主页 +私聊 +登录接口 +用户数据库 +评分",
      catalog,
    ).unknown,
    [],
  );
});

test("saving a v2 graph replaces removed branches atomically even when connector types remain installed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-graph-update-"));
  const control = await createControl({ dataDir: root });
  try {
    const registered = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "graph-update@test.example",
        password: "GraphPassword123",
      },
    });
    assert.equal(registered.statusCode, 201);
    const actor = registered.json().user.id;
    function specification(branches: string[]): ProductSpec {
      const modules = resolveModules([
        ...branches,
        "when-created",
        "audit-entry",
      ]);
      const graph: Composition = { version: 2, nodes: [], edges: [] };
      for (const module of modules.filter(
        (m) => !["when-created", "audit-entry"].includes(m.moduleId),
      )) {
        graph.nodes.push({
          id: module.moduleId,
          moduleId: module.moduleId,
          configuration: {},
          position: { x: 0, y: 0 },
        });
        for (const dep of Object.keys(module.dependencies))
          graph.edges.push({
            id: `${dep}-${module.moduleId}`,
            source: dep,
            target: module.moduleId,
            mode: "dependency",
          });
      }
      for (const branch of branches) {
        const trigger = `${branch}-trigger`,
          audit = `${branch}-audit`;
        graph.nodes.push(
          {
            id: trigger,
            moduleId: "when-created",
            configuration: {},
            position: { x: 800, y: 0 },
          },
          {
            id: audit,
            moduleId: "audit-entry",
            configuration: {},
            position: { x: 800, y: 200 },
          },
        );
        graph.edges.push(
          {
            id: `${branch}-flow`,
            source: branch,
            target: trigger,
            mode: "flow",
          },
          { id: `${branch}-log`, source: trigger, target: audit, mode: "flow" },
        );
      }
      return {
        name: `Graph ${branches.length}`,
        description: "创建校园书签和待办记录并独立记录每条分支的活动",
        kind: "custom",
        modules: modules.map((m) => m.moduleId),
        features: [],
        primaryColor: "green",
        composition: graph,
      };
    }
    const initial = specification(["bookmarks", "checklists"]);
    validateComposition(initial, catalog);
    const { project } = await control.projects.create(
      actor,
      initial,
      initial.description,
    );
    const next = specification(["bookmarks"]);
    validateComposition(next, catalog);
    await control.projects.update(project.id, actor, next);
    const saved = await control.projects.get(project.id, actor);
    assert.equal(saved.name, next.name);
    assert.deepEqual(saved.spec.composition, next.composition);
    assert.deepEqual(
      (await control.projects.application(project.id, actor)).spec,
      saved.spec,
    );
    assert.deepEqual(
      JSON.parse(
        await control.projects.read(project.id, actor, "product.json"),
      ),
      saved.spec,
    );
    const installed = await control.projects.installs(project.id, actor);
    assert.ok(!installed.some((m) => m.module_id === "checklists"));
    assert.ok(installed.some((m) => m.module_id === "when-created"));
    const history = (
      await control.db.query(
        "SELECT * FROM install_history ORDER BY created_at",
      )
    ).rows;
    const invalid = structuredClone(saved.spec);
    invalid.composition!.edges = invalid.composition!.edges.filter(
      (e) => e.id !== "bookmarks-flow",
    );
    await assert.rejects(
      control.projects.update(project.id, actor, invalid),
      /没有业务输入/,
    );
    assert.deepEqual(await control.projects.get(project.id, actor), saved);
    assert.deepEqual(
      await control.projects.installs(project.id, actor),
      installed,
    );
    assert.deepEqual(
      (
        await control.db.query(
          "SELECT * FROM install_history ORDER BY created_at",
        )
      ).rows,
      history,
    );
    assert.deepEqual(
      JSON.parse(
        await control.projects.read(project.id, actor, "product.json"),
      ),
      saved.spec,
    );
  } finally {
    await control.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
