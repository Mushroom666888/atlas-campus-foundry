import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Fastify from "fastify";
import { serveFrontend } from "../server/http.js";

test("frontend serves fresh build assets, uncached deep links and real asset 404s", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-frontend-"));
  const app = Fastify();
  try {
    await mkdir(path.join(root, "assets"));
    await writeFile(path.join(root, "index.html"), "<h1>Atlas</h1>");
    await serveFrontend(app, root);
    await app.ready();
    await writeFile(
      path.join(root, "assets", "new-build.js"),
      "export const version = 2;",
    );
    const asset = await app.inject({ url: "/assets/new-build.js" });
    assert.equal(asset.statusCode, 200);
    assert.match(String(asset.headers["content-type"]), /javascript/);
    const shell = await app.inject({ url: "/modules/identity" });
    assert.equal(shell.statusCode, 200);
    assert.equal(shell.headers["cache-control"], "no-store");
    assert.match(shell.body, /Atlas/);
    assert.equal(
      (await app.inject({ url: "/assets/missing.js" })).statusCode,
      404,
    );
    assert.equal((await app.inject({ url: "/api/missing" })).statusCode, 404);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
