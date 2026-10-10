import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance, InjectOptions } from "fastify";
import { createControl } from "../server/control.js";
import { createRuntime } from "../server/runtime-server.js";
import { resolveModules } from "../packages/modules/src/catalog.js";

async function account(app: FastifyInstance, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name,
      email: `${name}@community.test`,
      password: "CommunityPassword123",
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return {
    id: response.json().user.id as string,
    cookie: response.headers["set-cookie"]!.toString().split(";")[0],
  };
}
test("creator community: real persistence, public privacy, author permissions, search, replies, moderation and quota", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-community-"));
  let control = await createControl({ dataDir: root });
  try {
    const admin = await account(control.app, "admin"),
      alice = await account(control.app, "alice"),
      bob = await account(control.app, "bob");
    const call = (
      url: string,
      method: InjectOptions["method"] = "GET",
      payload?: object,
      cookie?: string,
    ) =>
      control.app.inject({
        url,
        method,
        payload,
        headers: cookie ? { cookie } : {},
      });
    assert.equal(
      (
        await call("/api/community/posts", "POST", {
          title: "hi",
          body: "hello",
          category: "经验交流",
        })
      ).statusCode,
      401,
    );
    const profile = {
      displayName: "校园创业者",
      school: "自填测试大学",
      bio: "共同经营校园摄影服务",
      tags: ["摄影", "创业"],
    };
    assert.equal(
      (await call("/api/community/profile", "PUT", profile, alice.cookie))
        .statusCode,
      200,
    );
    const publicProfile = (
      await call(`/api/community/profiles/${alice.id}`)
    ).json().profile;
    assert.equal(publicProfile.school, profile.school);
    assert.equal(publicProfile.email, undefined);
    assert.equal(publicProfile.password_hash, undefined);
    assert.equal(
      (await call("/api/community/directory?school=自填测试大学&q=摄影")).json()
        .items.length,
      1,
    );
    assert.equal(
      (
        await call(
          "/api/community/profile",
          "PUT",
          { ...profile, user_id: bob.id },
          alice.cookie,
        )
      ).statusCode,
      400,
    );
    const p = {
      name: "校园摄影",
      tagline: "校园里的毕业照预约",
      description: "创作者主动公开的独立产品",
      url: "https://example.org/product",
      category: "校园服务",
      stage: "内测中",
      tags: ["摄影"],
    };
    assert.equal(
      (
        await call(
          "/api/community/products",
          "POST",
          { ...p, url: "javascript:alert(1)" },
          alice.cookie,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(
          "/api/community/products",
          "POST",
          { ...p, url: "https://key:secret@example.org" },
          alice.cookie,
        )
      ).statusCode,
      400,
    );
    const created = await call(
      "/api/community/products",
      "POST",
      p,
      alice.cookie,
    );
    assert.equal(created.statusCode, 201, created.body);
    const productId = created.json().id;
    assert.equal(
      (await call(`/api/community/products/${productId}`, "PUT", p, bob.cookie))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await call(
          `/api/community/products/${productId}`,
          "DELETE",
          undefined,
          bob.cookie,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (await call("/api/community/products?q=摄影&category=校园服务")).json()
        .items.length,
      1,
    );
    const body = {
      title: "找校园产品合伙人",
      body: "欢迎交流 <script>alert(1)</script>",
      category: "寻找合作",
      tags: ["创业"],
    };
    const discussion = await call(
      "/api/community/posts",
      "POST",
      body,
      alice.cookie,
    );
    assert.equal(discussion.statusCode, 201, discussion.body);
    const postId = discussion.json().id;
    assert.equal(
      (await call(`/api/community/posts/${postId}`, "PUT", body, bob.cookie))
        .statusCode,
      403,
    );
    const reply = await call(
      `/api/community/posts/${postId}/replies`,
      "POST",
      { body: "我擅长运营" },
      bob.cookie,
    );
    assert.equal(reply.statusCode, 201, reply.body);
    assert.equal(
      (
        await call(
          `/api/community/replies/${reply.json().id}`,
          "DELETE",
          undefined,
          alice.cookie,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (await call("/api/community/posts?q=合伙人")).json().items[0].reply_count,
      1,
    );
    const csrf = await control.app.inject({
      method: "POST",
      url: "/api/community/posts",
      headers: { cookie: alice.cookie, origin: "https://evil.example" },
      payload: body,
    });
    assert.equal(csrf.statusCode, 403);
    await control.app.close();
    control = await createControl({ dataDir: root });
    assert.equal(
      (await call(`/api/community/products/${productId}`)).json().product.name,
      p.name,
    );
    assert.equal(
      (await call(`/api/community/posts/${postId}/replies`)).json().items[0]
        .body,
      "我擅长运营",
    );
    assert.equal(
      (
        await call(
          `/api/community/posts/${postId}`,
          "DELETE",
          undefined,
          admin.cookie,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (await call(`/api/community/posts/${postId}`)).statusCode,
      404,
    );
    assert.equal(
      (
        await control.db.query(
          "SELECT * FROM community_replies WHERE post_id=$1",
          [postId],
        )
      ).rows.length,
      0,
    );
    await control.db.query(
      "INSERT INTO creator_products(id,owner_id,name,tagline,description,category,stage) SELECT 'quota-'||i,$1,'quota','quota','quota','其他','构建中' FROM generate_series(1,49) i",
      [alice.id],
    );
    assert.equal(
      (await call("/api/community/products", "POST", p, alice.cookie))
        .statusCode,
      429,
    );
    assert.equal(
      (
        await control.db.query(
          "SELECT * FROM audit_log WHERE action='community.posts.deleted'",
        )
      ).rows.length,
      1,
    );
  } finally {
    await control.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("community modules reuse the platform implementation in isolated application databases and enforce installation", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "atlas-community-runtime-"),
  );
  const modules = resolveModules([
    "discussion-forum",
    "member-directory",
    "product-showcase",
  ]).map((m) => m.moduleId);
  const config = {
    appId: "community-app",
    dataDir: root,
    spec: {
      name: "校园创作者",
      description: "开放的产品社区",
      kind: "custom" as const,
      primaryColor: "green" as const,
      modules,
      features: [],
    },
    modules,
    recipes: [],
  };
  const runtime = await createRuntime(config);
  try {
    const alice = await account(runtime.app, "app-alice");
    const post = await runtime.app.inject({
      method: "POST",
      url: "/api/community/posts",
      headers: { cookie: alice.cookie },
      payload: {
        title: "应用内的论坛",
        body: "这条记录只存在于应用数据库中",
        category: "产品分享",
      },
    });
    assert.equal(post.statusCode, 201, post.body);
    assert.equal(
      (await runtime.app.inject({ url: "/api/community/posts" })).json().items
        .length,
      1,
    );
    const profile = await runtime.app.inject({
      method: "PUT",
      url: "/api/community/profile",
      headers: { cookie: alice.cookie },
      payload: { displayName: "App member", school: "校园", tags: [] },
    });
    assert.equal(profile.statusCode, 200, profile.body);
    assert.equal(
      (await runtime.db.query("SELECT * FROM audit_log")).rows.length,
      1,
    );
    config.modules.splice(config.modules.indexOf("discussion-forum"), 1);
    assert.equal(
      (await runtime.app.inject({ url: "/api/community/posts" })).statusCode,
      409,
    );
    assert.equal(
      (await runtime.app.inject({ url: `/api/community/profiles/${alice.id}` }))
        .statusCode,
      200,
    );
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
