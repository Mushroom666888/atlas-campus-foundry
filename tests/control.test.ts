import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createControl } from "../server/control.js";
import { createRuntime } from "../server/runtime-server.js";
import type { ProductSpec } from "../packages/contracts/src/index.js";

test("control: owner boundaries, real project files, module publication/reuse and blocked model job", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-control-"));
  const c = await createControl({ dataDir: root });
  try {
    async function register(email: string) {
      const response = await c.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "Password12345", name: email },
      });
      assert.equal(response.statusCode, 201, response.body);
      return {
        cookie: response.headers["set-cookie"]!.toString().split(";")[0],
        user: response.json().user,
      };
    }
    const owner = await register("owner@campus.test"),
      stranger = await register("stranger@campus.test");
    assert.equal(owner.user.role, "admin");
    assert.equal(stranger.user.role, "developer");
    const spec: ProductSpec = {
      name: "Study Buddy",
      description: "Find course peers and form study groups",
      kind: "study",
      modules: ["groups", "search", "notifications"],
      features: ["Study partners"],
      primaryColor: "blue",
    };
    const a = await c.projects.create(
      owner.user.id,
      spec,
      "Study buddy requirement",
    );
    const b = await c.projects.create(
      owner.user.id,
      { ...spec, name: "Independent club" },
      "Independent reuse target",
    );
    assert.equal(
      (
        await c.app.inject({
          url: `/api/projects/${a.project.id}`,
          headers: { cookie: stranger.cookie },
        })
      ).statusCode,
      404,
    );
    await assert.rejects(
      c.projects.write(
        a.project.id,
        stranger.user.id,
        "src/test.ts",
        "not permitted",
      ),
    );
    await assert.rejects(
      c.projects.write(
        a.project.id,
        owner.user.id,
        "../outside.txt",
        "not permitted",
      ),
    );
    await assert.rejects(
      c.projects.write(a.project.id, owner.user.id, ".env", "not permitted"),
    );
    const recipe = {
      type: "capacity-waitlist",
      version: 1,
      entity: "group",
      capacityField: "capacity",
      promotion: "fifo",
      notify: true,
    };
    await c.projects.write(
      a.project.id,
      owner.user.id,
      "features/waitlist.json",
      JSON.stringify(recipe),
    );
    const extracted = await c.projects.extract(a.project.id, owner.user.id, {
      moduleId: "study-waitlist",
      name: "Study Waitlist",
      version: "1.0.0",
      sourceFile: "features/waitlist.json",
    });
    assert.equal(extracted.status, "pending");
    await assert.rejects(
      c.projects.install(b.project.id, owner.user.id, ["study-waitlist"]),
      /compatible approved/,
    );
    await assert.rejects(
      c.projects.review(stranger.user, "study-waitlist", "1.0.0"),
      /管理员/,
    );
    await c.projects.review(owner.user, "study-waitlist", "1.0.0");
    // Published manifests from the previous release predate the new UI metadata.
    await c.db.query(
      "UPDATE module_versions SET manifest=manifest-'aliases'-'tags'-'icon'-'configurationFields' WHERE module_id=$1",
      ["study-waitlist"],
    );
    const legacy = (
      await c.app.inject({
        url: "/api/modules",
        headers: { cookie: owner.cookie },
      })
    )
      .json()
      .items.find((m: { moduleId: string }) => m.moduleId === "study-waitlist");
    assert.deepEqual(legacy.aliases, []);
    assert.deepEqual(legacy.tags, []);
    assert.deepEqual(legacy.configurationFields, []);
    assert.equal(legacy.icon, "Boxes");
    const installed = await c.projects.install(b.project.id, owner.user.id, [
      "study-waitlist",
    ]);
    assert.ok(installed.some((m) => m.moduleId === "study-waitlist"));
    assert.deepEqual(await c.projects.recipes(b.application.id), [recipe]);
    assert.ok(
      !(await c.projects.files(b.project.id, owner.user.id)).some(
        (f) => f.path === "features/waitlist.json",
      ),
      "target must not copy original project source",
    );
    await c.projects.write(
      a.project.id,
      owner.user.id,
      "features/waitlist.json",
      JSON.stringify({ ...recipe, notify: false }),
    );
    await c.projects.extract(a.project.id, owner.user.id, {
      moduleId: "study-waitlist",
      name: "Study Waitlist",
      version: "1.1.0",
      sourceFile: "features/waitlist.json",
    });
    await c.projects.review(owner.user, "study-waitlist", "1.1.0");
    await c.projects.install(b.project.id, owner.user.id, ["study-waitlist"], {
      "study-waitlist": "1.1.0",
    });
    assert.equal(
      (await c.projects.installs(b.project.id, owner.user.id)).find(
        (m) => m.module_id === "study-waitlist",
      )?.version,
      "1.1.0",
    );
    await c.projects.rollbackModules(b.project.id, owner.user.id);
    assert.equal(
      (await c.projects.installs(b.project.id, owner.user.id)).find(
        (m) => m.module_id === "study-waitlist",
      )?.version,
      "1.0.0",
    );
    const rt = await createRuntime({
      appId: b.application.id,
      dataDir: path.join(root, "independent"),
      spec: b.project.spec,
      modules: installed.map((m) => m.moduleId),
      recipes: await c.projects.recipes(b.application.id),
    });
    try {
      const credentials = [];
      for (const name of ["first", "second", "third"]) {
        const r = await rt.app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: {
            name,
            email: `${name}@test.example`,
            password: "Password12345",
          },
        });
        credentials.push(r.headers["set-cookie"]!.toString().split(";")[0]);
      }
      const entity = (
        await rt.app.inject({
          method: "POST",
          url: "/api/entities",
          headers: { cookie: credentials[0] },
          payload: {
            kind: "group",
            title: "Installed extension group",
            data: { capacity: 1 },
          },
        })
      ).json();
      const joined = await rt.app.inject({
        method: "POST",
        url: `/api/entities/${entity.id}/join`,
        headers: { cookie: credentials[1] },
        payload: {},
      });
      assert.equal(joined.json().status, "joined");
      const waitlisted = await rt.app.inject({
        method: "POST",
        url: `/api/entities/${entity.id}/join`,
        headers: { cookie: credentials[2] },
        payload: {},
      });
      assert.equal(waitlisted.json().status, "waiting");
      await rt.app.inject({
        method: "POST",
        url: `/api/entities/${entity.id}/leave`,
        headers: { cookie: credentials[1] },
        payload: {},
      });
      const promoted = await rt.app.inject({
        url: `/api/entities/${entity.id}/members`,
        headers: { cookie: credentials[2] },
      });
      assert.equal(promoted.json().mine.status, "joined");
    } finally {
      await rt.app.close();
    }
    if (!process.env.LLM_API_KEY) {
      const job = await c.agent.create(
        owner.user.id,
        "Create a custom study application",
        a.project.id,
      );
      assert.equal(job.status, "blocked");
      assert.equal(
        (await c.agent.get(job.id, owner.user.id)).status,
        "blocked",
      );
    }
    const job = {
      id: "tool-contract",
      owner_id: owner.user.id,
      project_id: a.project.id,
      status: "running",
      mode: "test-contract-only",
      input: "contract",
    };
    assert.ok(
      Array.isArray(
        await c.agent.execute(job, "searchModules", { query: "identity" }),
      ),
    );
    await assert.rejects(
      c.agent.execute(job, "writeProjectFiles", {
        path: "../../vault.key",
        content: "bad",
      }),
    );
    await assert.rejects(
      c.agent.execute(job, "execShell", { command: "whoami" }),
    );
    const unsafe = await c.projects.create(
      owner.user.id,
      { ...spec, name: "Unsafe custom code" },
      "Executable source needs sandbox",
    );
    await c.projects.write(
      unsafe.project.id,
      owner.user.id,
      "src/feature.ts",
      "export const value = 42;",
    );
    const failed = await c.deployments.deploy(
      unsafe.project.id,
      owner.user.id,
      { provider: "local-trusted" },
    );
    assert.equal(failed.status, "failed");
    assert.match(failed.logs, /Docker/);
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
