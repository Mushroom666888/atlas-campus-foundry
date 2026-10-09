import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createControl } from "../server/control.js";
import { applicationSecrets } from "../server/vault.js";

test("actual local deployment: HTTP, persistence across restart, immutable rollback, failed deployment and secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-deployment-"));
  const control = await createControl({ dataDir: root });
  try {
    const registration = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "deployer@test.example",
        password: "Deployment12345",
        name: "Deployer",
      },
    });
    assert.equal(registration.statusCode, 201, registration.body);
    const user = registration.json().user;
    const cookie = registration.headers["set-cookie"]!.toString().split(";")[0];
    const created = await control.projects.create(
      user.id,
      {
        name: "Deployment Study",
        description: "Exercise real process lifecycle and PostgreSQL storage",
        kind: "study",
        modules: ["groups", "notifications", "search"],
        features: [],
        primaryColor: "blue",
      },
      "Deployment acceptance",
    );
    const secret = await control.app.inject({
      method: "PUT",
      url: `/api/projects/${created.project.id}/env`,
      headers: { cookie },
      payload: { name: "APP_TEST_SECRET", value: "secret-not-in-logs" },
    });
    assert.equal(secret.statusCode, 200, secret.body);
    assert.deepEqual(
      await applicationSecrets(control.db, root, created.application.id),
      { APP_TEST_SECRET: "secret-not-in-logs" },
    );
    const stored = await control.db.query<{ encrypted_value: string }>(
      "SELECT encrypted_value FROM app_secrets",
    );
    assert.ok(!stored.rows[0].encrypted_value.includes("secret-not-in-logs"));
    const injection = await control.app.inject({
      method: "PUT",
      url: `/api/projects/${created.project.id}/env`,
      headers: { cookie },
      payload: { name: "APP_UNSAFE", value: "value\nNODE_OPTIONS=--inspect" },
    });
    assert.equal(injection.statusCode, 400);
    const first = await control.deployments.deploy(created.project.id, user.id);
    assert.equal(first.status, "running", first.logs);
    let base = `http://127.0.0.1:${first.port}`;
    const login = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@test.example",
        name: "Student",
        password: "Student12345",
      }),
    });
    assert.equal(login.status, 201);
    const runtimeCookie = login.headers.get("set-cookie")!.split(";")[0];
    const entityResponse = await fetch(`${base}/api/entities`, {
      method: "POST",
      headers: { cookie: runtimeCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "group",
        title: "Persistent mathematics group",
        data: { capacity: 1 },
      }),
    });
    assert.equal(entityResponse.status, 201);
    const entity = (await entityResponse.json()) as { id: string };
    const restarted = await control.deployments.restart(first.id, user.id);
    assert.equal(restarted.status, "running", restarted.logs);
    base = `http://127.0.0.1:${restarted.port}`;
    assert.equal(
      (
        await fetch(`${base}/api/entities/${entity.id}`, {
          headers: { cookie: runtimeCookie },
        })
      ).status,
      200,
    );
    assert.equal((await fetch(base)).status, 200);
    await control.projects.write(
      created.project.id,
      user.id,
      "features/waitlist.json",
      JSON.stringify({
        type: "capacity-waitlist",
        version: 1,
        entity: "group",
        capacityField: "capacity",
        promotion: "fifo",
        notify: true,
      }),
    );
    await control.projects.extract(created.project.id, user.id, {
      moduleId: "deployment-waitlist",
      name: "Waitlist test",
      version: "1.0.0",
      sourceFile: "features/waitlist.json",
    });
    await control.projects.review(user, "deployment-waitlist", "1.0.0");
    await control.projects.install(created.project.id, user.id, [
      "deployment-waitlist",
      "search",
    ]);
    const upgraded = await control.deployments.deploy(
      created.project.id,
      user.id,
    );
    assert.equal(upgraded.status, "running", upgraded.logs);
    const upgradedInfo = (await (
      await fetch(`http://127.0.0.1:${upgraded.port}/api/application`)
    ).json()) as { recipes: unknown[] };
    assert.equal(upgradedInfo.recipes.length, 1);
    const rolledBack = await control.deployments.rollback(upgraded.id, user.id);
    assert.equal(rolledBack.status, "running", rolledBack.logs);
    const restoredInfo = (await (
      await fetch(`http://127.0.0.1:${rolledBack.port}/api/application`)
    ).json()) as { recipes: unknown[] };
    assert.equal(
      restoredInfo.recipes.length,
      0,
      "rollback must restore prior recipe snapshot, not current installs",
    );
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${rolledBack.port}/api/entities/${entity.id}`,
          { headers: { cookie: runtimeCookie } },
        )
      ).status,
      200,
    );
    const artifact = JSON.parse(
      await readFile(path.join(rolledBack.artifact, "artifact.json"), "utf8"),
    );
    assert.equal(artifact.source, "@campus/modules");
    assert.ok(artifact.sourceHash.length === 64);
    await control.projects.write(
      created.project.id,
      user.id,
      "src/feature.ts",
      "export const unsafe = true;",
    );
    const failed = await control.deployments.deploy(
      created.project.id,
      user.id,
    );
    assert.equal(failed.status, "failed");
    assert.match(failed.logs, /Docker/);
    assert.equal(
      (await control.deployments.health(rolledBack.id, user.id)).healthy,
      true,
      "preflight failure must preserve existing running service",
    );
    const logs = await control.deployments.logs(rolledBack.id, user.id);
    assert.match(logs, /health check passed/);
    assert.ok(!logs.includes("secret-not-in-logs"));
    await control.deployments.stop(rolledBack.id, user.id);
    assert.equal(
      (await control.deployments.health(rolledBack.id, user.id)).healthy,
      false,
    );
  } finally {
    await control.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
