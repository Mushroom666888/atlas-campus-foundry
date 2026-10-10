import { test } from "node:test";
import assert from "node:assert/strict";
import type { InjectOptions } from "fastify";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { catalog, resolveModules } from "../packages/modules/src/catalog.js";
import {
  moduleReferences,
  validateComposition,
} from "../packages/modules/src/composition.js";
import { createRuntime } from "../server/runtime-server.js";
import { createControl } from "../server/control.js";
import {
  type Composition,
  type ModuleManifest,
  type ProductSpec,
  productSpecSchema,
} from "../packages/contracts/src/index.js";

function sample(module: ModuleManifest) {
  return Object.fromEntries(
    module.recordDefinition!.fields.map((f) => [
      f.key,
      f.type === "number"
        ? Math.min(f.max || 5, 3)
        : f.type === "date"
          ? "2026-10-12"
          : f.type === "select"
            ? f.options![0]
            : f.type === "url"
              ? "https://example.org"
              : f.type === "boolean"
                ? false
                : `${f.label}实测`,
    ]),
  );
}
const specification = (
  modules: string[],
  composition?: Composition,
): ProductSpec => ({
  name: "Module acceptance",
  description: "Real database module acceptance",
  kind: "custom",
  modules: resolveModules(modules).map((m) => m.moduleId),
  features: [],
  primaryColor: "green",
  composition,
});
const node = (
  id: string,
  moduleId: string,
  configuration: Composition["nodes"][number]["configuration"] = {},
) => ({ id, moduleId, position: { x: 0, y: 0 }, configuration });
const edge = (
  source: string,
  target: string,
  mode: Composition["edges"][number]["mode"] = "flow",
) => ({ id: `${source}-${target}`, source, target, mode });

test("94 catalog modules, typed graph contracts and exact multilingual module references", () => {
  assert.equal(catalog.length, 94);
  assert.equal(new Set(catalog.map((m) => m.moduleId)).size, 94);
  assert.deepEqual(
    [
      "foundation",
      "campus",
      "connector",
      "presentation",
      "commerce",
      "community",
    ].map((c) => catalog.filter((m) => m.category === c).length),
    [10, 50, 12, 8, 10, 4],
  );
  assert.deepEqual(
    moduleReferences(
      "我要 +失物招领 +聊天 +notifications +lost-found",
      catalog,
    ),
    { moduleIds: ["lost-found", "chat", "notifications"], unknown: [] },
  );
  assert.deepEqual(moduleReferences("应用 +不存在", catalog).unknown, [
    "不存在",
  ]);
  const graph: Composition = {
    version: 1,
    nodes: [node("a", "lost-found"), node("b", "checklists")],
    edges: [edge("a", "b", "embed")],
  };
  const spec = specification(["lost-found", "checklists"], graph);
  validateComposition(spec, catalog);
  assert.throws(
    () =>
      validateComposition(
        {
          ...spec,
          composition: {
            ...graph,
            edges: [...graph.edges, edge("b", "a", "embed")],
          },
        },
        catalog,
      ),
    /循环/,
  );
  assert.throws(
    () =>
      validateComposition(
        { ...spec, composition: { ...graph, edges: [edge("a", "b")] } },
        catalog,
      ),
    /自动化/,
  );
  assert.throws(
    () =>
      validateComposition(
        {
          ...spec,
          composition: {
            ...graph,
            nodes: [...graph.nodes, node("c", "lost-found")],
          },
        },
        catalog,
      ),
    /只能有一个/,
  );
  const widgetGraph: Composition = {
    version: 1,
    nodes: [
      node("a", "lost-found"),
      node("b", "checklists"),
      node("w", "embedded-list", { childModule: "checklists" }),
    ],
    edges: [edge("a", "w", "display")],
  };
  validateComposition(
    specification(["lost-found", "checklists", "embedded-list"], widgetGraph),
    catalog,
  );
  assert.throws(
    () =>
      validateComposition(
        specification(["lost-found", "checklists", "embedded-list"], {
          ...widgetGraph,
          edges: [...widgetGraph.edges, edge("b", "a", "embed")],
        }),
        catalog,
      ),
    /循环/,
  );
});

test("dense invalid graphs are rejected within a bounded validation budget", () => {
  const graph: Composition = {
    version: 1,
    nodes: [node("source", "bookmarks")],
    edges: [],
  };
  let parents = ["source"];
  for (let layer = 0; layer < 16; layer++) {
    const children = [0, 1, 2].map((i) => `n-${layer}-${i}`);
    graph.nodes.push(...children.map((id) => node(id, "audit-entry")));
    graph.edges.push(
      ...parents.flatMap((from) => children.map((to) => edge(from, to))),
    );
    parents = children;
  }
  const started = performance.now();
  assert.throws(
    () =>
      validateComposition(
        specification(["bookmarks", "audit-entry"], graph),
        catalog,
      ),
    /一个上游/,
  );
  assert.ok(
    performance.now() - started < 1000,
    "validation must not enumerate DAG paths",
  );
});

test("all 50 business modules execute real validated CRUD, private reads, ownership, search and database restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-business-"));
  const spec = specification(catalog.map((m) => m.moduleId));
  const config = {
    appId: "business-test",
    dataDir: root,
    spec,
    modules: spec.modules,
    recipes: [],
  };
  let runtime = await createRuntime(config);
  try {
    const login = async (email: string) => {
      const response = await runtime.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "BusinessPassword123" },
      });
      assert.equal(response.statusCode, 201);
      return response.headers["set-cookie"]!.toString().split(";")[0];
    };
    const owner = await login("owner@business.test"),
      other = await login("other@business.test");
    const records: { moduleId: string; id: string }[] = [];
    for (const module of catalog.filter((m) => m.recordDefinition)) {
      // Distinct simulated clients keep this contract sweep below each IP's real rate limit.
      const remoteAddress = `192.0.2.${records.length + 1}`;
      const inject = (options: InjectOptions) =>
        runtime.app.inject({
          ...options,
          remoteAddress,
        });
      const url = `/api/modules/${module.moduleId}/records`;
      const created = await inject({
        method: "POST",
        url,
        headers: { cookie: owner },
        payload: { title: `${module.name}真实测试`, data: sample(module) },
      });
      assert.equal(
        created.statusCode,
        201,
        `${module.moduleId}: ${created.body}`,
      );
      const id = created.json().id;
      records.push({ moduleId: module.moduleId, id });
      const searched = await inject({
        url: `${url}?q=${encodeURIComponent("真实测试")}`,
        headers: { cookie: owner },
      });
      assert.equal(searched.statusCode, 200, searched.body);
      assert.equal(searched.json().items.length, 1);
      assert.equal(searched.json().counts[0].count, 1);
      const updated = await inject({
        method: "PATCH",
        url: `${url}/${id}`,
        headers: { cookie: owner },
        payload: { status: module.recordDefinition!.statuses[1] },
      });
      assert.equal(updated.statusCode, 200, updated.body);
      assert.equal(updated.json().status, module.recordDefinition!.statuses[1]);
      const stranger = await inject({
        method: "PATCH",
        url: `${url}/${id}`,
        headers: { cookie: other },
        payload: { title: "attack" },
      });
      assert.equal(
        stranger.statusCode,
        module.recordDefinition!.visibility === "owner" ? 404 : 403,
      );
      const otherRead = await inject({
        url,
        headers: { cookie: other },
      });
      assert.equal(
        otherRead.json().items.length,
        module.recordDefinition!.visibility === "owner" ? 0 : 1,
      );
      const invalid = await inject({
        method: "POST",
        url,
        headers: { cookie: owner },
        payload: {
          title: "Invalid",
          data: { ...sample(module), unexpected: "blocked" },
        },
      });
      assert.equal(invalid.statusCode, 400);
      const sql = await inject({
        url: `${url}?q=${encodeURIComponent("' OR 1=1 --")}`,
        headers: { cookie: owner },
      });
      assert.equal(sql.statusCode, 200, sql.body);
      assert.equal(sql.json().items.length, 0);
    }
    const badUrl = await runtime.app.inject({
      method: "POST",
      url: "/api/modules/bookmarks/records",
      headers: { cookie: owner },
      payload: {
        title: "XSS",
        data: { category: "test", link: "javascript:alert(1)" },
      },
    });
    assert.equal(badUrl.statusCode, 400);
    await runtime.app.close();
    runtime = await createRuntime(config);
    for (const record of records)
      assert.equal(
        (
          await runtime.app.inject({
            url: `/api/modules/${record.moduleId}/records/${record.id}`,
            headers: { cookie: owner },
          })
        ).statusCode,
        200,
      );
    const first = records[0],
      firstUrl = `/api/modules/${first.moduleId}/records/${first.id}`;
    assert.equal(
      (
        await runtime.app.inject({
          method: "PATCH",
          url: firstUrl,
          headers: { cookie: owner },
          payload: { archived: true },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await runtime.app.inject({ url: firstUrl, headers: { cookie: owner } }))
        .statusCode,
      404,
    );
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/business-module-results.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          status: "TESTED",
          count: records.length,
          modules: records.map((r) => r.moduleId),
          checks: [
            "persistent create/read/search/update/archive",
            "private visibility",
            "ownership",
            "field validation",
            "SQL/XSS probes",
            "database restart",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("12 connectors execute events, conditions, field mapping, notification, linked records, audit and transactional rollback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-flow-"));
  const graph: Composition = {
    version: 1,
    nodes: [
      node("source", "expenses"),
      node("target", "bookmarks"),
      node("created", "when-created"),
      node("status", "status-condition", { value: "已记录" }),
      node("keyword", "keyword-condition", { field: "title", value: "校园" }),
      node("number", "number-condition", {
        field: "amount",
        operator: ">=",
        value: 10,
      }),
      node("map", "field-map", { from: "category", to: "folder" }),
      node("text", "text-template", { template: "{title}/{data.folder}" }),
      node("unique", "unique-record"),
      node("notify", "notify-author"),
      node("copy", "create-linked-record", {
        targetModule: "bookmarks",
        title: "{title}",
        "data.category": "{data.folder}",
      }),
      node("audit", "audit-entry"),
      node("updated", "when-updated"),
      node("notify2", "notify-author"),
      node("archived", "when-archived"),
      node("audit2", "audit-entry"),
    ],
    edges: [
      edge("source", "created"),
      edge("created", "status"),
      edge("status", "keyword"),
      edge("keyword", "number"),
      edge("number", "map"),
      edge("map", "text"),
      edge("text", "unique"),
      edge("unique", "notify"),
      edge("notify", "copy"),
      edge("copy", "audit"),
      edge("source", "updated"),
      edge("updated", "notify2"),
      edge("source", "archived"),
      edge("archived", "audit2"),
    ],
  };
  const spec = productSpecSchema.parse(
    specification(
      graph.nodes.map((n) => n.moduleId),
      graph,
    ),
  );
  validateComposition(spec, catalog);
  const runtime = await createRuntime({
    appId: "flow",
    dataDir: root,
    spec,
    modules: spec.modules,
    recipes: [],
  });
  try {
    const login = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "flow@test.example", password: "FlowPassword123" },
    });
    const cookie = login.headers["set-cookie"]!.toString().split(";")[0];
    const create = (title: string, amount = 25, status = "已记录") =>
      runtime.app.inject({
        method: "POST",
        url: "/api/modules/expenses/records",
        headers: { cookie },
        payload: {
          title,
          status,
          data: { type: "支出", amount, category: "学习", date: "2026-10-12" },
        },
      });
    const record = await create("校园教材");
    assert.equal(record.statusCode, 201, record.body);
    const notifications = () =>
      runtime.db.query<{ body: string }>("SELECT body FROM notifications");
    assert.equal((await notifications()).rows[0].body, "校园教材/学习");
    const copies = await runtime.db.query<{
      data: { category: string };
      context_id: string;
    }>(
      "SELECT data,context_id FROM module_records WHERE module_id='bookmarks'",
    );
    assert.equal(copies.rows[0].data.category, "学习");
    assert.equal(copies.rows[0].context_id, record.json().id);
    assert.equal((await create("校园教材")).statusCode, 201);
    await create("不含关键词");
    await create("校园低金额", 1);
    await create("校园其他状态", 25, "已核对");
    assert.equal((await notifications()).rows.length, 1);
    await runtime.app.inject({
      method: "PATCH",
      url: `/api/modules/expenses/records/${record.json().id}`,
      headers: { cookie },
      payload: { status: "已核对" },
    });
    assert.equal((await notifications()).rows.length, 2);
    await runtime.app.inject({
      method: "PATCH",
      url: `/api/modules/expenses/records/${record.json().id}`,
      headers: { cookie },
      payload: { archived: true },
    });
    assert.equal(
      (
        await runtime.db.query(
          "SELECT * FROM domain_events WHERE type='composition.activity'",
        )
      ).rows.length,
      2,
    );
    spec.composition!.nodes.find((n) => n.id === "copy")!.configuration[
      "data.category"
    ] = "";
    const before = (
      await runtime.db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM module_records",
      )
    ).rows[0].count;
    assert.equal((await create("校园回滚测试")).statusCode, 400);
    assert.equal(
      (
        await runtime.db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM module_records",
        )
      ).rows[0].count,
      before,
    );
    assert.equal((await notifications()).rows.length, 2);
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("embedded records enforce declared parent contracts; Agent +references persist and constrain module tools", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "foundry-compose-control-"),
  );
  const control = await createControl({ dataDir: root });
  try {
    const registered = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "compose@test.example",
        password: "ComposePassword123",
      },
    });
    const actor = registered.json().user.id;
    const graph: Composition = {
      version: 1,
      nodes: [node("a", "lost-found"), node("b", "checklists")],
      edges: [edge("a", "b", "embed")],
    };
    const created = await control.projects.create(
      actor,
      specification(["lost-found", "checklists"], graph),
      "Visual assembly",
    );
    const saved = await control.projects.get(created.project.id, actor);
    assert.deepEqual(saved.spec.composition, graph);
    const beforeFile = await control.projects.read(
      created.project.id,
      actor,
      "product.json",
    );
    const oversized = structuredClone(saved.spec);
    oversized.composition!.nodes[0].configuration = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`field${i}`, "x".repeat(4000)]),
    );
    await assert.rejects(
      control.projects.update(created.project.id, actor, oversized),
      /200 KB/,
    );
    assert.deepEqual(
      (await control.projects.get(created.project.id, actor)).spec,
      saved.spec,
    );
    assert.equal(
      await control.projects.read(created.project.id, actor, "product.json"),
      beforeFile,
    );
    await control.projects.update(
      created.project.id,
      actor,
      specification(
        ["lost-found", "checklists", "create-linked-record", "embedded-list"],
        {
          version: 1,
          nodes: [
            ...graph.nodes,
            node("copy", "create-linked-record", {
              targetModule: "checklists",
              title: "{title}",
            }),
            node("widget", "embedded-list", { childModule: "checklists" }),
          ],
          edges: [edge("a", "copy"), edge("a", "widget", "display")],
        },
      ),
    );
    await control.projects.install(created.project.id, actor, [
      "lost-found",
      "create-linked-record",
      "embedded-list",
    ]);
    const pruned = (await control.projects.get(created.project.id, actor)).spec
      .composition!;
    assert.deepEqual(
      pruned.nodes.map((n) => n.moduleId),
      ["lost-found"],
    );
    assert.deepEqual(pruned.edges, []);
    const job = await control.agent.create(
      actor,
      "我要 +失物招领 +聊天",
      created.project.id,
    );
    const storedJob = await control.agent.get(job.id, actor);
    await control.agent.execute(storedJob, "selectModules", {
      moduleIds: ["identity"],
    });
    assert.ok(
      (await control.projects.installs(created.project.id, actor)).some(
        (m) => m.module_id === "chat",
      ),
    );
    assert.equal(
      (
        await control.db.query(
          "SELECT * FROM job_events WHERE job_id=$1 AND type='module_references'",
          [job.id],
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      control.agent.create(actor, "我要 +fake-module"),
      /无法识别/,
    );
    const config = {
      appId: "embed",
      dataDir: path.join(root, "embed"),
      spec: saved.spec,
      modules: saved.spec.modules,
      recipes: [],
    };
    const runtime = await createRuntime(config);
    try {
      const login = await runtime.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "embed@test.example",
          password: "EmbeddedPassword123",
        },
      });
      const cookie = login.headers["set-cookie"]!.toString().split(";")[0];
      const parent = await runtime.app.inject({
        method: "POST",
        url: "/api/modules/lost-found/records",
        headers: { cookie },
        payload: {
          title: "丢失的书",
          data: { type: "寻物", place: "教学楼", date: "2026-10-12" },
        },
      });
      const child = await runtime.app.inject({
        method: "POST",
        url: "/api/modules/checklists/records",
        headers: { cookie },
        payload: {
          title: "查找教室",
          data: { priority: "高", due: "2026-10-13" },
          contextId: parent.json().id,
        },
      });
      assert.equal(child.statusCode, 201, child.body);
      const list = await runtime.app.inject({
        url: `/api/modules/checklists/records?contextId=${parent.json().id}`,
        headers: { cookie },
      });
      assert.equal(list.json().items.length, 1);
      assert.equal(
        (
          await runtime.app.inject({
            method: "POST",
            url: "/api/modules/lost-found/records",
            headers: { cookie },
            payload: {
              title: "非法关联",
              data: { type: "寻物", place: "教学楼", date: "2026-10-12" },
              contextId: child.json().id,
            },
          })
        ).statusCode,
        422,
      );
    } finally {
      await runtime.app.close();
    }
  } finally {
    await control.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("private records cannot be embedded or copied into shared modules, including stale runtime graphs", async () => {
  const graph: Composition = {
    version: 1,
    nodes: [node("p", "bookmarks"), node("c", "resource-links")],
    edges: [edge("p", "c", "embed")],
  };
  const spec = specification(
    ["bookmarks", "resource-links", "create-linked-record"],
    graph,
  );
  assert.throws(() => validateComposition(spec, catalog), /私有/);
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-private-"));
  const runtime = await createRuntime({
    appId: "private",
    dataDir: root,
    spec,
    modules: spec.modules,
    recipes: [],
  });
  try {
    const cookies: string[] = [];
    for (const email of ["owner@private.test", "stranger@private.test"]) {
      const login = await runtime.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "PrivatePassword123" },
      });
      cookies.push(login.headers["set-cookie"]!.toString().split(";")[0]);
    }
    const parent = await runtime.app.inject({
      method: "POST",
      url: "/api/modules/bookmarks/records",
      headers: { cookie: cookies[0] },
      payload: {
        title: "Secret",
        data: sample(catalog.find((m) => m.moduleId === "bookmarks")!),
      },
    });
    assert.equal(parent.statusCode, 201, parent.body);
    const child = await runtime.app.inject({
      method: "POST",
      url: "/api/modules/resource-links/records",
      headers: { cookie: cookies[0] },
      payload: {
        title: "Copy",
        contextId: parent.json().id,
        data: sample(catalog.find((m) => m.moduleId === "resource-links")!),
      },
    });
    assert.equal(child.statusCode, 422, child.body);
    const stranger = await runtime.app.inject({
      url: "/api/modules/resource-links/records",
      headers: { cookie: cookies[1] },
    });
    assert.deepEqual(stranger.json().items, []);
    spec.composition = {
      version: 1,
      nodes: [
        node("p", "bookmarks"),
        node("c", "resource-links"),
        node("copy", "create-linked-record", {
          targetModule: "resource-links",
          title: "{title}",
        }),
      ],
      edges: [edge("p", "copy")],
    };
    assert.throws(() => validateComposition(spec, catalog), /私有/);
    const copy = await runtime.app.inject({
      method: "POST",
      url: "/api/modules/bookmarks/records",
      headers: { cookie: cookies[0] },
      payload: {
        title: "Secret copy",
        data: sample(catalog.find((m) => m.moduleId === "bookmarks")!),
      },
    });
    assert.equal(copy.statusCode, 422, copy.body);
    spec.modules = spec.modules.filter((id) => id !== "resource-links");
    const uninstalled = await runtime.app.inject({
      method: "POST",
      url: "/api/modules/bookmarks/records",
      headers: { cookie: cookies[0] },
      payload: {
        title: "Uninstalled copy",
        data: sample(catalog.find((m) => m.moduleId === "bookmarks")!),
      },
    });
    assert.equal(uninstalled.statusCode, 409, uninstalled.body);
    assert.equal(
      (
        await runtime.db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM module_records",
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
