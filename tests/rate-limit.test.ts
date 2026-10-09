import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { setupAuth } from "../server/auth.js";
import { Database } from "../server/db.js";

test("static assets preserve API rate budget while real API requests remain limited", async () => {
  const db = await new Database("memory://").init();
  const app = Fastify();
  try {
    await db.migrate("runtime");
    await setupAuth(app, db, "ratelimit", false);
    app.get("/assets/limit-fixture.txt", async () => "asset");
    app.get("/api/limited", async () => ({ ok: true }));
    for (let i = 0; i < 320; i++)
      assert.equal(
        (await app.inject({ url: "/assets/limit-fixture.txt" })).statusCode,
        200,
      );
    for (let i = 0; i < 300; i++)
      assert.equal((await app.inject({ url: "/api/limited" })).statusCode, 200);
    assert.equal((await app.inject({ url: "/api/limited" })).statusCode, 429);
  } finally {
    await app.close();
    await db.close();
  }
});
