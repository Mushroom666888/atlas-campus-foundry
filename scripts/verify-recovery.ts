import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
const root = path.resolve(".data", `recovery-${randomUUID()}`);
await mkdir(root, { recursive: true });
const port = await new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const p = (server.address() as { port: number }).port;
    server.close(() => resolve(p));
  });
});
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess | undefined;
let logs = "";
async function healthy(url: string) {
  try {
    return (
      await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) })
    ).ok;
  } catch {
    return false;
  }
}
async function start() {
  child = spawn(process.execPath, ["--import", "tsx", "server/main.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: root,
      LLM_API_KEY: "",
      LLM_MODEL: "",
      DATABASE_URL: "",
      DOTENV_CONFIG_PATH: path.join(root, "no-env"),
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout!.on("data", (chunk) => {
    logs = (logs + chunk).slice(-100000);
  });
  child.stderr!.on("data", (chunk) => {
    logs = (logs + chunk).slice(-100000);
  });
  for (let i = 0; i < 200; i++) {
    if (await healthy(base)) return;
    await delay(150);
  }
  throw new Error("Control did not start");
}
async function kill() {
  const current = child;
  if (!current) return;
  await new Promise<void>((resolve) => {
    current.once("exit", () => resolve());
    current.kill();
  });
  child = undefined;
}
try {
  await start();
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "recovery@test.example",
      password: "RecoveryPassword123",
    }),
  });
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get("set-cookie")!.split(";")[0];
  async function api<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(base + url, {
      method: body ? "POST" : "GET",
      headers: { cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.ok(response.ok, `HTTP ${response.status} ${url}`);
    return response.json() as Promise<T>;
  }
  const project = await api<{ project: { id: string } }>("/api/projects", {
    idea: "Crash recovery test",
    spec: {
      name: "Recovery app",
      description: "Application survives data recovery",
      kind: "events",
      modules: ["events"],
      features: [],
      primaryColor: "green",
    },
  });
  const deployment = await api<{ status: string; port: number }>(
    `/api/projects/${project.project.id}/deploy`,
    {},
  );
  assert.equal(deployment.status, "running");
  const runtime = `http://127.0.0.1:${deployment.port}`;
  assert.equal(await healthy(runtime), true);
  await kill();
  for (let i = 0; i < 40 && (await healthy(runtime)); i++) await delay(150);
  assert.equal(
    await healthy(runtime),
    false,
    "Application must exit on control IPC disconnect",
  );
  await start();
  const projects = await api<{ items: { id: string }[] }>("/api/projects");
  assert.ok(projects.items.some((p) => p.id === project.project.id));
  const deployments = await api<{ items: { status: string }[] }>(
    "/api/deployments",
  );
  assert.equal(deployments.items[0].status, "interrupted");
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/recovery-results.json",
    JSON.stringify(
      {
        status: "TESTED",
        at: new Date().toISOString(),
        checks: [
          "abrupt control exit",
          "runtime IPC-disconnect shutdown",
          "control database crash recovery",
          "session persistence",
          "deployment state reconciled as interrupted",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "TESTED: abrupt control exit, child shutdown, persistent state and recovery reconciliation.",
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/recovery-failure.log",
    logs + "\n" + String(error),
  );
  throw error;
} finally {
  await kill();
}
