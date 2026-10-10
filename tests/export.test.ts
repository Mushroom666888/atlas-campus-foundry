import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { unzipSync, strFromU8 } from "fflate";
import { createControl } from "../server/control.js";
import { command } from "../server/executor.js";

test(
  "export: owner-only source ZIP; independent install, HTTP app, fresh accounts and persistence after restart",
  { timeout: 240000 },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-export-"));
    const extracted = path.join(root, "independent");
    const c = await createControl({ dataDir: path.join(root, "control") });
    let child: ChildProcess | undefined;
    const stop = async () => {
      if (child && child.exitCode === null)
        await new Promise<void>((resolve) => {
          child!.once("exit", () => resolve());
          child!.disconnect();
        });
    };
    try {
      const account = await c.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "export@atlas.test",
          name: "Exporter",
          password: "Exporter12345",
        },
      });
      const cookie = account.headers["set-cookie"]!.toString().split(";")[0];
      const created = await c.projects.create(
        account.json().user.id,
        {
          name: "Independent Study",
          description: "Run outside the Atlas workspace",
          kind: "study",
          modules: ["groups", "chat", "search"],
          features: [],
          primaryColor: "green",
        },
        "Export test",
      );
      await c.app.inject({
        method: "PUT",
        url: `/api/projects/${created.project.id}/env`,
        headers: { cookie },
        payload: {
          name: "APP_PRIVATE_TOKEN",
          value: "private-sentinel-never-export",
        },
      });
      const denied = await c.app.inject({
        url: `/api/projects/${created.project.id}/export`,
      });
      assert.equal(denied.statusCode, 401);
      const response = await c.app.inject({
        url: `/api/projects/${created.project.id}/export`,
        headers: { cookie },
      });
      assert.equal(response.statusCode, 200, response.body.slice(0, 200));
      const files = unzipSync(response.rawPayload);
      for (const name of Object.keys(files)) {
        assert.ok(
          !name.split("/").includes(".data") &&
            !name.endsWith(".env") &&
            !name.includes(".."),
        );
        assert.ok(
          !strFromU8(files[name]).includes("private-sentinel-never-export"),
        );
        const target = path.join(extracted, name);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, files[name]);
      }
      assert.ok(
        files["compose.yaml"] &&
          files["dist/index.html"] &&
          files["workspace/product.json"],
      );
      const manifest = JSON.parse(strFromU8(files["export-manifest.json"]));
      assert.equal(manifest.dataIncluded, false);
      const npmCli =
        process.env.npm_execpath ||
        path.join(
          path.dirname(process.execPath),
          "node_modules/npm/bin/npm-cli.js",
        );
      const install = await command(
        process.execPath,
        [npmCli, "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: extracted, timeout: 180000 },
      );
      assert.equal(install.ok, true, install.stderr);
      const socket = createServer();
      await new Promise<void>((resolve) =>
        socket.listen(0, "127.0.0.1", resolve),
      );
      const port = (socket.address() as { port: number }).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      const base = `http://127.0.0.1:${port}`;
      await writeFile(path.join(extracted, ".env"), `RUNTIME_PORT=${port}\n`);
      const start = async () => {
        let log = "";
        child = spawn(process.execPath, ["--import", "tsx", "standalone.ts"], {
          cwd: extracted,
          windowsHide: true,
          env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
          },
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        child.stdout!.on("data", (chunk) => {
          log += chunk;
        });
        child.stderr!.on("data", (chunk) => {
          log += chunk;
        });
        for (let i = 0; i < 80; i++) {
          try {
            if ((await fetch(base + "/api/health")).ok) return;
          } catch {
            /* Bounded startup probe. */
          }
          if (child.exitCode !== null) throw new Error(log);
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error("Export runtime startup failed: " + log);
      };
      await start();
      const healthCommand = await command(process.execPath, ["verify.mjs"], {
        cwd: extracted,
        env: {
          ...process.env,
          RUNTIME_PORT: undefined,
          RUNTIME_PUBLIC_ORIGIN: "https://unreachable.invalid",
        },
      });
      assert.equal(healthCommand.ok, true, healthCommand.stderr);
      assert.equal((await fetch(base)).status, 200);
      assert.equal((await fetch(base + "/api/auth/me")).status, 200);
      const fresh = await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "export@atlas.test",
          password: "Exporter12345",
        }),
      });
      assert.equal(
        fresh.status,
        401,
        "control-plane account must not be exported",
      );
      const user = await fetch(base + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "fresh@export.test",
          name: "Fresh",
          password: "FreshUser12345",
        }),
      });
      assert.equal(user.status, 201);
      const runtimeCookie = user.headers.get("set-cookie")!.split(";")[0];
      const record = await fetch(base + "/api/entities", {
        method: "POST",
        headers: { cookie: runtimeCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "group",
          title: "Exported app group",
          data: {},
        }),
      });
      assert.equal(record.status, 201);
      const entity = (await record.json()) as { id: string };
      await stop();
      await start();
      assert.equal(
        (
          await fetch(base + `/api/entities/${entity.id}`, {
            headers: { cookie: runtimeCookie },
          })
        ).status,
        200,
      );
    } finally {
      await stop();
      await c.app.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);
