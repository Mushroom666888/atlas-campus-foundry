import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createControl } from "../server/control.js";
import {
  requirementsSchema,
  type ProductRequirements,
} from "../packages/contracts/src/requirements.js";

const requirements: ProductRequirements = {
  roles: [
    { id: "buyer", name: "Buyer", responsibility: "Manage own reservations" },
  ],
  models: [
    {
      id: "reservation",
      name: "Reservation",
      fields: [
        {
          name: "venue",
          type: "reference",
          references: "venue",
          required: true,
        },
      ],
    },
    {
      id: "venue",
      name: "Venue",
      fields: [{ name: "name", type: "text", required: true }],
    },
  ],
  scenarios: [
    {
      id: "reserve",
      title: "Reserve a venue",
      roleId: "buyer",
      given: "Available venue",
      when: "Submit reservation",
      then: "One persistent reservation belongs to buyer",
      moduleIds: ["campus"],
    },
  ],
};

test("requirements: references, module traceability, legacy specs, honest readiness and restart persistence", async () => {
  assert.equal(requirementsSchema.safeParse(requirements).success, true);
  assert.equal(
    requirementsSchema.safeParse({
      ...requirements,
      roles: [...requirements.roles, requirements.roles[0]],
    }).success,
    false,
  );
  assert.equal(
    requirementsSchema.safeParse({
      ...requirements,
      models: [requirements.models[0]],
    }).success,
    false,
  );
  assert.equal(
    requirementsSchema.safeParse({ ...requirements, roles: [] }).success,
    false,
  );
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-requirements-"));
  let c = await createControl({ dataDir: root });
  try {
    const registered = await c.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "creator@requirements.test",
        password: "Requirements123",
      },
    });
    const user = registered.json().user.id,
      cookie = registered.headers["set-cookie"]!.toString().split(";")[0];
    const spec = {
      name: "Venue business",
      description: "Student venue reservations",
      kind: "custom",
      modules: ["campus"],
      features: [],
      requirements,
    };
    const project = (
      await c.projects.create(user, spec, "Explicit requirements")
    ).project;
    const status = await c.app.inject({
      url: `/api/projects/${project.id}/requirements`,
      headers: { cookie },
    });
    assert.equal(status.json().status, "specified");
    assert.deepEqual(status.json().scenarios, [
      { id: "reserve", status: "NOT_RUN" },
    ]);
    await assert.rejects(
      c.projects.install(project.id, user, ["identity"]),
      /未安装模块/,
    );
    await assert.rejects(
      c.projects.update(project.id, user, {
        ...project.spec,
        requirements: {
          ...requirements,
          scenarios: [
            { ...requirements.scenarios[0], moduleIds: ["missing-module"] },
          ],
        },
      }),
      /未安装模块/,
    );
    assert.deepEqual(
      (await c.projects.get(project.id, user)).spec.requirements,
      requirements,
    );
    const legacy = (
      await c.projects.create(
        user,
        { ...spec, requirements: undefined },
        "Legacy specification",
      )
    ).project;
    assert.equal(
      (await c.projects.requirements(legacy.id, user)).status,
      "incomplete",
    );
    await c.app.close();
    c = await createControl({ dataDir: root });
    assert.deepEqual(
      (await c.projects.get(project.id, user)).spec.requirements,
      requirements,
    );
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("workspace: conditional writes, revision recovery, managed configuration and owner boundaries", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-revisions-"));
  const c = await createControl({ dataDir: root });
  try {
    async function register(email: string) {
      const result = await c.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "SourceHistory123" },
      });
      return {
        user: result.json().user.id,
        cookie: result.headers["set-cookie"]!.toString().split(";")[0],
      };
    }
    const owner = await register("owner@source.test"),
      stranger = await register("stranger@source.test");
    const { project } = await c.projects.create(
      owner.user,
      {
        name: "Source review",
        description: "Human and agent collaboration",
        kind: "custom",
        modules: ["identity"],
        features: [],
      },
      "Editor",
    );
    const url = `/api/projects/${project.id}`;
    const file = "src/example.ts";
    const put = (content: string, expectedHash: string | null) =>
      c.app.inject({
        method: "PUT",
        url: `${url}/file`,
        headers: { cookie: owner.cookie },
        payload: { path: file, content, expectedHash },
      });
    const first = await put("export const value = 1;", null);
    assert.equal(first.statusCode, 200, first.body);
    const version = (
      await c.app.inject({
        url: `${url}/file?path=${file}`,
        headers: { cookie: owner.cookie },
      })
    ).json();
    assert.equal(version.hash, first.json().hash);
    const competing = await Promise.all([
      put("export const value = 2;", version.hash),
      put("export const value = 3;", version.hash),
    ]);
    assert.deepEqual(competing.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal((await put("lost update", version.hash)).statusCode, 409);
    const history = (
      await c.app.inject({
        url: `${url}/file-history?path=${file}`,
        headers: { cookie: owner.cookie },
      })
    ).json().items;
    assert.equal(history.length, 2);
    const revisionUrl = `${url}/revisions/${first.json().revision}`;
    const current = await c.projects.readVersion(project.id, owner.user, file);
    const restored = await c.app.inject({
      method: "POST",
      url: revisionUrl + "/restore",
      headers: { cookie: owner.cookie },
      payload: { expectedHash: current.hash },
    });
    assert.equal(restored.statusCode, 200, restored.body);
    assert.equal(
      await c.projects.read(project.id, owner.user, file),
      "export const value = 1;",
    );
    assert.equal(
      (await c.projects.history(project.id, owner.user, file)).length,
      3,
    );
    assert.equal(
      (
        await c.app.inject({
          method: "POST",
          url: revisionUrl + "/restore",
          headers: { cookie: owner.cookie },
          payload: { expectedHash: current.hash },
        })
      ).statusCode,
      409,
    );
    for (const endpoint of [
      `${url}/file?path=${file}`,
      `${url}/file-history?path=${file}`,
      revisionUrl,
    ])
      assert.equal(
        (
          await c.app.inject({
            url: endpoint,
            headers: { cookie: stranger.cookie },
          })
        ).statusCode,
        404,
      );
    await assert.rejects(
      c.projects.edit(project.id, owner.user, "product.json", "{}", null),
      /产品配置/,
    );
    const specFile = await c.projects.readVersion(
      project.id,
      owner.user,
      "product.json",
    );
    for (const alias of [
      "product.json/",
      "src//example.ts",
      "DIST/feature.js",
      "SecretS/key.txt",
    ])
      await assert.rejects(
        c.projects.edit(project.id, owner.user, alias, "{}", specFile.hash),
        { code: "UNSAFE_PATH" },
      );
    assert.deepEqual(
      await c.projects.readVersion(project.id, owner.user, "product.json"),
      specFile,
    );
    await assert.rejects(
      c.projects.edit(project.id, owner.user, "../.env", "secret", null),
      { code: "UNSAFE_PATH" },
    );
    const second = (
      await c.projects.create(owner.user, project.spec, "Other project")
    ).project;
    await assert.rejects(
      c.projects.revision(second.id, owner.user, first.json().revision),
      /版本不存在/,
    );
  } finally {
    await c.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
