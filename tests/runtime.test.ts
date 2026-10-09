import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createRuntime } from "../server/runtime-server.js";
import { catalog, resolveModules } from "../packages/modules/src/catalog.js";
import { moduleManifestSchema } from "../packages/contracts/src/index.js";

test("SSE authorization is revoked after logout and open streams do not prevent shutdown", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-stream-"));
  const runtime = await createRuntime({
    appId: "stream-test",
    dataDir: root,
    streamHeartbeatMs: 50,
    spec: {
      name: "Stream test",
      description: "Session revalidation test",
      kind: "custom",
      modules: ["identity", "chat"],
      features: [],
      primaryColor: "green",
    },
    modules: ["identity", "chat"],
    recipes: [],
  });
  try {
    const url = await runtime.app.listen({ host: "127.0.0.1", port: 0 });
    const registered = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "stream@test.example", password: "StreamPassword123" },
    });
    const cookie = registered.headers["set-cookie"]!.toString().split(";")[0];
    const response = await fetch(`${url}/api/stream`, {
      headers: { cookie },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    assert.equal((await reader.read()).done, false);
    await runtime.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie },
      payload: {},
    });
    let ended = false;
    for (let i = 0; i < 20; i++) {
      const next = await reader.read();
      if (next.done) {
        ended = true;
        break;
      }
      await delay(10);
    }
    assert.equal(ended, true);
    const login = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "stream@test.example", password: "StreamPassword123" },
    });
    const live = await fetch(`${url}/api/stream`, {
      headers: {
        cookie: login.headers["set-cookie"]!.toString().split(";")[0],
      },
      signal: AbortSignal.timeout(5000),
    });
    const liveReader = live.body!.getReader();
    await liveReader.read();
    await runtime.app.close();
    assert.equal((await liveReader.read()).done, true);
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("manifest contracts and dependency resolution reject cycles, conflicts and missing modules", () => {
  for (const m of catalog) moduleManifestSchema.parse(m);
  assert.ok(resolveModules(["events"]).some((m) => m.moduleId === "identity"));
  assert.throws(() => resolveModules(["unknown"]));
  const changed = catalog.map((m) =>
    m.moduleId === "identity"
      ? { ...m, dependencies: { events: "^1.0.0" } }
      : m,
  );
  assert.throws(() => resolveModules(["events"], changed), /Cycle/);
  assert.throws(() =>
    resolveModules(["events"], catalog, { identity: "2.0.0" }),
  );
  const identity = catalog.find((m) => m.moduleId === "identity")!,
    content = catalog.find((m) => m.moduleId === "content")!;
  const versions = [
    identity,
    { ...identity, version: "1.1.0" },
    { ...content, dependencies: { identity: "1.0.0" } },
  ];
  assert.deepEqual(
    resolveModules(["identity", "content"], versions),
    resolveModules(["content", "identity"], versions),
  );
  assert.equal(
    resolveModules(["identity", "content"], versions)[0].version,
    "1.0.0",
  );
});
test("real runtime: identity, events, FIFO waitlist, notifications, search, chat, authorization and persistence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-runtime-"));
  const config = {
    appId: "test-app",
    dataDir: root,
    spec: {
      name: "Runtime acceptance",
      description: "Real database acceptance",
      kind: "study" as const,
      modules: catalog.map((m) => m.moduleId),
      features: [],
      primaryColor: "green" as const,
    },
    modules: catalog.map((m) => m.moduleId),
    recipes: [
      {
        type: "capacity-waitlist" as const,
        version: 1 as const,
        entity: "group" as const,
        capacityField: "capacity" as const,
        promotion: "fifo" as const,
        notify: true,
      },
    ],
  };
  let runtime = await createRuntime(config);
  try {
    const request = (
      method: "GET" | "POST" | "PATCH",
      url: string,
      body?: unknown,
      cookie?: string,
    ) =>
      runtime.app.inject({
        method,
        url,
        payload: body as object,
        headers: cookie ? { cookie } : {},
      });
    async function register(email: string) {
      const r = await request("POST", "/api/auth/register", {
        email,
        password: "Password12345",
        name: email.split("@")[0],
      });
      assert.equal(r.statusCode, 201, r.body);
      return {
        cookie: r.headers["set-cookie"]!.toString().split(";")[0],
        user: r.json().user,
      };
    }
    const a = await register("alice@campus.test"),
      b = await register("bob@campus.test"),
      c = await register("charlie@campus.test");
    assert.equal((await request("GET", "/api/entities")).statusCode, 401);
    const group = await request(
      "POST",
      "/api/entities",
      {
        kind: "group",
        title: "Calculus group",
        body: "Weekly study",
        data: { capacity: 1 },
      },
      a.cookie,
    );
    assert.equal(group.statusCode, 201, group.body);
    const id = group.json().id;
    assert.equal(
      (
        await request(
          "PATCH",
          `/api/entities/${id}`,
          { status: "closed" },
          b.cookie,
        )
      ).statusCode,
      403,
    );
    const joins = await Promise.all([
      request("POST", `/api/entities/${id}/join`, {}, b.cookie),
      request("POST", `/api/entities/${id}/join`, {}, c.cookie),
    ]);
    assert.deepEqual(
      joins.map((r) => r.json().status),
      ["joined", "waiting"],
    );
    await request("POST", `/api/entities/${id}/leave`, {}, b.cookie);
    assert.equal(
      (
        await request("GET", `/api/entities/${id}/members`, undefined, c.cookie)
      ).json().mine.status,
      "joined",
    );
    assert.ok(
      (await request("GET", "/api/notifications", undefined, c.cookie))
        .json()
        .items.some((n: { body: string }) => n.body.includes("递补")),
    );
    assert.equal(
      (
        await request("GET", "/api/entities?q=Calculus", undefined, a.cookie)
      ).json().items.length,
      1,
    );
    assert.equal(
      (
        await request(
          "GET",
          "/api/entities?q=%27%20OR%201%3D1--",
          undefined,
          a.cookie,
        )
      ).json().items.length,
      0,
    );
    const conversation = await request(
      "POST",
      "/api/conversations",
      { title: "Private", members: [b.user.id] },
      a.cookie,
    );
    assert.equal(conversation.statusCode, 201, conversation.body);
    const cid = conversation.json().id;
    assert.equal(
      (
        await request(
          "POST",
          `/api/conversations/${cid}/messages`,
          { body: "Meet in the library" },
          a.cookie,
        )
      ).statusCode,
      201,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/conversations/${cid}/messages`,
          undefined,
          b.cookie,
        )
      ).json().items.length,
      1,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/conversations/${cid}/messages`,
          undefined,
          c.cookie,
        )
      ).statusCode,
      404,
    );
    const csrf = await runtime.app.inject({
      method: "POST",
      url: "/api/entities",
      headers: { cookie: a.cookie, origin: "https://evil.example" },
      payload: { kind: "post", title: "No" },
    });
    assert.equal(csrf.statusCode, 403);
    const school = await request(
      "POST",
      "/api/entities",
      { kind: "school", title: "Acceptance school (test fixture)", data: {} },
      a.cookie,
    );
    assert.equal(school.statusCode, 201);
    assert.equal(
      (
        await request(
          "POST",
          `/api/schools/${school.json().id}/join`,
          {},
          a.cookie,
        )
      ).json().verification,
      "self-declared",
    );
    const place = await request(
      "POST",
      "/api/entities",
      {
        kind: "location",
        title: "Geographic API test point, not campus data",
        data: { latitude: 0, longitude: 0 },
      },
      a.cookie,
    );
    assert.equal(place.statusCode, 201);
    assert.match(
      (
        await request(
          "GET",
          `/api/locations/${place.json().id}/map`,
          undefined,
          a.cookie,
        )
      ).json().url,
      /openstreetmap.org/,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/entities",
          {
            kind: "location",
            title: "Invalid latitude",
            data: { latitude: 91, longitude: 0 },
          },
          a.cookie,
        )
      ).statusCode,
      400,
    );
    for (const kind of ["profile", "course", "post"])
      assert.equal(
        (
          await request(
            "POST",
            "/api/entities",
            {
              kind,
              title: `${kind} fixture`,
              body: "Persisted domain record",
              data: {},
            },
            a.cookie,
          )
        ).statusCode,
        201,
      );
    assert.equal(
      (
        await request(
          "POST",
          "/api/entities",
          {
            kind: "profile",
            title: "Topic match",
            data: { course: "TopologyMatch42" },
          },
          a.cookie,
        )
      ).statusCode,
      201,
    );
    assert.equal(
      (
        await request(
          "GET",
          "/api/entities?kind=profile&q=TopologyMatch42",
          undefined,
          a.cookie,
        )
      ).json().items.length,
      1,
    );
    const listing = await request(
      "POST",
      "/api/entities",
      { kind: "listing", title: "Test textbook", data: { price: 18.5 } },
      a.cookie,
    );
    assert.equal(listing.statusCode, 201);
    assert.equal(
      (
        await request(
          "PATCH",
          `/api/entities/${listing.json().id}`,
          { status: "sold" },
          a.cookie,
        )
      ).json().status,
      "sold",
    );
    const boundary = "FoundryBoundary";
    const malicious = await runtime.app.inject({
      method: "POST",
      url: "/api/uploads",
      headers: {
        cookie: a.cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="attack.png"\r\nContent-Type: image/png\r\n\r\n<script>alert(1)</script>\r\n--${boundary}--\r\n`,
    });
    assert.equal(malicious.statusCode, 400);
    const other = await createRuntime({
      ...config,
      appId: "other-app",
      dataDir: path.join(root, "other"),
    });
    try {
      assert.equal(
        (
          await other.app.inject({
            url: `/api/entities/${id}`,
            headers: {
              cookie: a.cookie.replace("foundry_test_app", "foundry_other_app"),
            },
          })
        ).statusCode,
        401,
      );
    } finally {
      await other.app.close();
    }
    await runtime.app.close();
    runtime = await createRuntime(config);
    assert.equal(
      (await request("GET", `/api/entities/${id}`, undefined, a.cookie)).json()
        .title,
      "Calculus group",
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/conversations/${cid}/messages`,
          undefined,
          b.cookie,
        )
      ).json().items[0].body,
      "Meet in the library",
    );
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
