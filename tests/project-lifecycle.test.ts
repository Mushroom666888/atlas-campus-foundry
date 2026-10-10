import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createControl } from "../server/control.js";
import { randomUUID } from "node:crypto";

test("project trash: owner permission, task cancellation, real process shutdown, data and file restoration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-lifecycle-"));
  const c = await createControl({ dataDir: root });
  try {
    const register = async (email: string) => {
      const response = await c.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, name: "Creator", password: "Lifecycle12345" },
      });
      assert.equal(response.statusCode, 201);
      return {
        user: response.json().user,
        cookie: response.headers["set-cookie"]!.toString().split(";")[0],
      };
    };
    const owner = await register("owner@lifecycle.test"),
      stranger = await register("other@lifecycle.test");
    const created = await c.projects.create(
      owner.user.id,
      {
        name: "Keep my data",
        description: "Lifecycle verification with a real application",
        kind: "study",
        modules: ["groups"],
        features: [],
        primaryColor: "green",
      },
      "Test archive and restore",
    );
    const id = created.project.id;
    const original = await readFile(
      path.join(c.projects.workspace(id), "product.json"),
      "utf8",
    );
    const denied = await c.app.inject({
      method: "DELETE",
      url: `/api/projects/${id}`,
      headers: { cookie: stranger.cookie },
    });
    assert.equal(denied.statusCode, 404);
    const pending = await c.agent.create(
      owner.user.id,
      "A retained project task",
      id,
    );
    const deployment = await c.deployments.deploy(id, owner.user.id);
    assert.equal(deployment.status, "running", deployment.logs);
    const base = `http://127.0.0.1:${deployment.port}`;
    const account = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "enduser@lifecycle.test",
        name: "End user",
        password: "Enduser12345",
      }),
    });
    assert.equal(account.status, 201);
    const cookie = account.headers.get("set-cookie")!.split(";")[0];
    const record = await fetch(base + "/api/entities", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "group",
        title: "Retained group",
        data: {},
      }),
    });
    assert.equal(record.status, 201);
    const entity = (await record.json()) as { id: string };
    const deleted = await c.app.inject({
      method: "DELETE",
      url: `/api/projects/${id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.equal(deleted.json().dataRetained, true);
    assert.equal(
      (
        await c.app.inject({
          url: "/api/deployments",
          headers: { cookie: owner.cookie },
        })
      ).json().items.length,
      0,
    );
    await assert.rejects(
      fetch(base + "/api/health", { signal: AbortSignal.timeout(1500) }),
    );
    assert.equal(
      (await c.agent.get(pending.id, owner.user.id)).status,
      "cancelled",
    );
    assert.equal(
      (
        await c.app.inject({
          url: "/api/projects",
          headers: { cookie: owner.cookie },
        })
      ).json().items.length,
      0,
    );
    assert.equal(
      (
        await c.app.inject({
          url: "/api/projects?trash=true",
          headers: { cookie: owner.cookie },
        })
      ).json().items[0].id,
      id,
    );
    assert.equal(
      (
        await c.app.inject({
          url: `/api/projects/${id}`,
          headers: { cookie: owner.cookie },
        })
      ).statusCode,
      404,
    );
    await assert.rejects(
      c.deployments.restart(deployment.id, owner.user.id),
      /不存在/,
    );
    assert.equal(
      (
        await c.app.inject({
          url: `/api/projects/${id}/export`,
          headers: { cookie: owner.cookie },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await c.app.inject({
          method: "POST",
          url: `/api/projects/${id}/restore`,
          headers: { cookie: stranger.cookie },
          payload: {},
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await c.app.inject({
          method: "POST",
          url: `/api/projects/${id}/restore`,
          headers: { cookie: owner.cookie },
          payload: {},
        })
      ).statusCode,
      200,
    );
    assert.equal(
      await c.projects.read(id, owner.user.id, "product.json"),
      original,
    );
    assert.equal(
      (await c.deployments.get(deployment.id, owner.user.id)).status,
      "stopped",
    );
    assert.equal(
      (
        await c.app.inject({
          url: "/api/deployments",
          headers: { cookie: owner.cookie },
        })
      ).json().items[0].id,
      deployment.id,
    );
    const restarted = await c.deployments.deploy(id, owner.user.id);
    assert.equal(restarted.status, "running", restarted.logs);
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${restarted.port}/api/entities/${entity.id}`,
          { headers: { cookie } },
        )
      ).status,
      200,
    );
    const audit = await c.db.query<{ action: string }>(
      "SELECT action FROM audit_log WHERE resource_id=$1",
      [id],
    );
    assert.ok(audit.rows.some((r) => r.action === "project.trashed"));
    assert.ok(audit.rows.some((r) => r.action === "project.restored"));
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("project lifecycle concurrency: restore waits for archive, jobs stay blocked, create/restore quota is atomic", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-lifecycle-race-"));
  const c = await createControl({ dataDir: root });
  try {
    const registered = await c.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "race@atlas.test", password: "RacePassword123" },
    });
    const actor = registered.json().user.id;
    const spec = {
      name: "Race test",
      description: "Controlled concurrent lifecycle operations",
      kind: "custom",
      modules: ["identity"],
      features: [],
      primaryColor: "green",
    };
    const created = await c.projects.create(actor, spec, "Concurrency test");
    let release!: () => void, entered!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const archiving = c.deployments.archiveProject(
      created.project.id,
      actor,
      async () => {
        entered();
        await barrier;
      },
    );
    await ready;
    try {
      await assert.rejects(
        c.deployments.restoreProject(created.project.id, actor),
        /稍后恢复/,
      );
      await assert.rejects(
        c.agent.create(
          actor,
          "Must not create during deletion",
          created.project.id,
        ),
        /不存在/,
      );
    } finally {
      release();
      await archiving;
    }
    await assert.rejects(c.projects.get(created.project.id, actor));
    const second = randomUUID();
    await c.db.transaction(async (tx) => {
      for (let i = 0; i < 20; i++) {
        const id = i === 19 ? second : randomUUID();
        await tx.query(
          "INSERT INTO projects(id,owner_id,name,idea,spec,deleted_at) VALUES($1,$2,'Quota fixture','test',$3,$4)",
          [
            id,
            actor,
            JSON.stringify(spec),
            i === 19 ? new Date().toISOString() : null,
          ],
        );
        await tx.query(
          "INSERT INTO applications(id,project_id,spec) VALUES($1,$2,$3)",
          [randomUUID(), id, JSON.stringify(spec)],
        );
      }
    });
    const results = await Promise.allSettled([
      c.deployments.restoreProject(created.project.id, actor),
      c.deployments.restoreProject(second, actor),
      c.projects.create(actor, spec, "Concurrent create"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const active = (
      await c.db.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM projects WHERE owner_id=$1 AND deleted_at IS NULL",
        [actor],
      )
    ).rows[0].count;
    assert.equal(active, 20);
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
