import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import pg from "pg";
import { command } from "../server/executor.js";
import { createControl } from "../server/control.js";
import { createRuntime } from "../server/runtime-server.js";
import { catalog } from "../packages/modules/src/catalog.js";

if (process.platform !== "win32")
  throw new Error(
    "This native PostgreSQL acceptance launcher is verified only on Windows. Use configured DATABASE_URL on other OSes.",
  );
const root = path.resolve(".data", `postgres-acceptance-${randomUUID()}`),
  cluster = path.join(root, "cluster");
await mkdir(root, { recursive: true });
const bin = path.resolve(
  "node_modules/@embedded-postgres/windows-x64/native/bin",
);
const password = randomBytes(24).toString("base64url"),
  passwordFile = path.join(root, "init-password");
await writeFile(passwordFile, password, { mode: 0o600 });
const port = await new Promise<number>((resolve, reject) => {
  const listener = createServer();
  listener.on("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const p = (listener.address() as { port: number }).port;
    listener.close(() => resolve(p));
  });
});
const logs: string[] = [];
async function run(name: string, args: string[]) {
  const result = await command(path.join(bin, `${name}.exe`), args, {
    timeout: 60000,
  });
  logs.push(result.stdout, result.stderr);
  if (!result.ok) throw new Error(`${name} failed: ${result.stderr}`);
}
let started = false;
const start = async () => {
  await run("pg_ctl", [
    "start",
    "-D",
    cluster,
    "-l",
    path.join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port}`,
    "-w",
  ]);
  started = true;
};
const stop = async () => {
  if (started) {
    await run("pg_ctl", ["stop", "-D", cluster, "-m", "fast", "-w"]);
    started = false;
  }
};
try {
  await run("initdb", [
    "-D",
    cluster,
    "-U",
    "foundry",
    "-A",
    "scram-sha-256",
    `--pwfile=${passwordFile}`,
    "--encoding=UTF8",
    "--locale=C",
  ]);
  await start();
  const url = (name: string) =>
    `postgresql://foundry:${password}@127.0.0.1:${port}/${name}`;
  const admin = new pg.Client({ connectionString: url("postgres") });
  await admin.connect();
  const version = (await admin.query("SELECT version()")).rows[0].version;
  await admin.query("CREATE DATABASE foundry_control_test");
  await admin.query("CREATE DATABASE foundry_runtime_test");
  await admin.end();
  let control = await createControl({
    dataDir: path.join(root, "control-files"),
    databaseUrl: url("foundry_control_test"),
  });
  let projectId = "",
    ownerId = "";
  try {
    const registered = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "native@test.example",
        password: "NativePostgres123",
        name: "Native",
      },
    });
    assert.equal(registered.statusCode, 201, registered.body);
    ownerId = registered.json().user.id;
    const project = await control.projects.create(
      ownerId,
      {
        name: "Native PostgreSQL project",
        description: "Real PostgreSQL server adapter test",
        kind: "events",
        modules: ["events", "search"],
        features: [],
        primaryColor: "green",
      },
      "Migration and project test",
    );
    projectId = project.project.id;
    await control.db.migrate("control");
    assert.equal(
      (
        await control.db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM schema_migrations",
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await control.app.close();
  }
  const config = {
    appId: "native-postgres",
    dataDir: path.join(root, "runtime-files"),
    spec: {
      name: "Native PG application",
      description: "PostgreSQL runtime persistence",
      kind: "study" as const,
      modules: catalog.map((m) => m.moduleId),
      features: [],
      primaryColor: "blue" as const,
    },
    modules: catalog.map((m) => m.moduleId),
    recipes: [],
  };
  let runtime = await createRuntime(config, {
    databaseUrl: url("foundry_runtime_test"),
  });
  let session = "",
    entityId = "";
  try {
    const account = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "student@test.example", password: "NativeStudent123" },
    });
    assert.equal(account.statusCode, 201, account.body);
    session = account.headers["set-cookie"]!.toString().split(";")[0];
    const created = await runtime.app.inject({
      method: "POST",
      url: "/api/entities",
      headers: { cookie: session },
      payload: {
        kind: "event",
        title: "Persistent SQL event",
        data: { capacity: 1 },
      },
    });
    assert.equal(created.statusCode, 201, created.body);
    entityId = created.json().id;
    const joined = await runtime.app.inject({
      method: "POST",
      url: `/api/entities/${entityId}/join`,
      headers: { cookie: session },
      payload: {},
    });
    assert.equal(joined.json().status, "joined");
    await runtime.db.migrate("runtime");
  } finally {
    await runtime.app.close();
  }
  await stop();
  await start();
  control = await createControl({
    dataDir: path.join(root, "control-files"),
    databaseUrl: url("foundry_control_test"),
  });
  try {
    assert.equal(
      (await control.projects.get(projectId, ownerId)).name,
      "Native PostgreSQL project",
    );
  } finally {
    await control.app.close();
  }
  runtime = await createRuntime(config, {
    databaseUrl: url("foundry_runtime_test"),
  });
  try {
    const entity = await runtime.app.inject({
      url: `/api/entities/${entityId}`,
      headers: { cookie: session },
    });
    assert.equal(entity.statusCode, 200);
    assert.equal(entity.json().title, "Persistent SQL event");
  } finally {
    await runtime.app.close();
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/postgres-results.json",
    JSON.stringify(
      {
        status: "TESTED",
        at: new Date().toISOString(),
        version,
        checks: [
          "native server startup",
          "SCRAM authentication",
          "control migration",
          "runtime migration",
          "idempotent migrations",
          "platform registration",
          "project creation",
          "runtime registration",
          "event creation and enrollment",
          "server restart persistence",
          "persistent sessions",
        ],
        clusterDirectory: cluster,
      },
      null,
      2,
    ),
  );
  console.log(
    `TESTED: ${version}\nNative PostgreSQL control/runtime migrations and restart persistence passed.`,
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/postgres-failure.log",
    logs.join("\n") + "\n" + String(error),
  );
  throw error;
} finally {
  await stop();
  await rm(passwordFile, { force: true });
}
