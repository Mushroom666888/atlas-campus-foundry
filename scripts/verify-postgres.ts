import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import pg from "pg";
import { command } from "../server/executor.js";
import { createControl } from "../server/control.js";
import { createRuntime } from "../server/runtime-server.js";
import { catalog } from "../packages/modules/src/catalog.js";
import type { Database } from "../server/db.js";

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
async function verifyMigrations(db: Database, scope: "control" | "runtime") {
  const before = (
    await db.query("SELECT * FROM schema_migrations ORDER BY version")
  ).rows;
  const expected = (await readdir(path.join("migrations", scope)))
    .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
    .sort()
    .map((name) => `${scope}/${name}`);
  assert.deepEqual(
    before.map((row) => row.version),
    expected,
  );
  await db.migrate(scope);
  assert.deepEqual(
    (await db.query("SELECT * FROM schema_migrations ORDER BY version")).rows,
    before,
  );
}
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
    await control.deployments.archiveProject(
      projectId,
      ownerId,
      async () => {},
    );
    await assert.rejects(control.projects.get(projectId, ownerId));
    const second = await control.projects.create(
      ownerId,
      project.project.spec,
      "Quota race target",
    );
    await control.deployments.archiveProject(
      second.project.id,
      ownerId,
      async () => {},
    );
    for (let index = 0; index < 19; index++) {
      await control.projects.create(
        ownerId,
        project.project.spec,
        "Active quota fixture",
      );
    }
    const concurrent = await Promise.allSettled([
      control.deployments.restoreProject(projectId, ownerId),
      control.deployments.restoreProject(second.project.id, ownerId),
      control.projects.create(
        ownerId,
        project.project.spec,
        "Concurrent create",
      ),
    ]);
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (
        await control.db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM projects WHERE owner_id=$1 AND deleted_at IS NULL",
          [ownerId],
        )
      ).rows[0].count,
      20,
    );
    const active = (
      await control.db.query<{ id: string }>(
        "SELECT id FROM projects WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at",
        [ownerId],
      )
    ).rows;
    projectId = active[0].id;
    const archivedId = active[1].id;
    await control.deployments.archiveProject(
      archivedId,
      ownerId,
      async () => {},
    );
    assert.equal(
      (
        await control.db.query(
          "SELECT id FROM projects WHERE id=$1 AND deleted_at IS NOT NULL",
          [archivedId],
        )
      ).rows.length,
      1,
    );
    await verifyMigrations(control.db, "control");
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
    entityId = "",
    buyerSession = "",
    productId = "",
    orderId = "",
    postId = "",
    venueId = "";
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
    const university = await runtime.app.inject({
      method: "POST",
      url: "/api/campus/universities",
      headers: { cookie: session },
      payload: { name: "Native PG University" },
    });
    assert.equal(university.statusCode, 201, university.body);
    const universityId = university.json().id;
    const campus = await runtime.app.inject({
      method: "POST",
      url: "/api/campus/campuses",
      headers: { cookie: session },
      payload: { name: "Native PG Campus", university_id: universityId },
    });
    assert.equal(campus.statusCode, 201, campus.body);
    const venue = await runtime.app.inject({
      method: "POST",
      url: "/api/campus/venues",
      headers: { cookie: session },
      payload: {
        name: "Native PG Venue",
        university_id: universityId,
        campus_id: campus.json().id,
        capacity: 50,
      },
    });
    assert.equal(venue.statusCode, 201, venue.body);
    venueId = venue.json().id;
    const linked = await runtime.app.inject({
      method: "PUT",
      url: `/api/campus/events/${entityId}/location`,
      headers: { cookie: session },
      payload: { university_id: universityId, venue_id: venueId },
    });
    assert.equal(linked.statusCode, 200, linked.body);
    await runtime.db.query(
      "INSERT INTO campus_campuses(id,university_id,name,timezone) SELECT 'quota-' || n::text,$1,'Quota fixture ' || n::text,'Asia/Taipei' FROM generate_series(1,998) AS n",
      [universityId],
    );
    const campusRaces = await Promise.all(
      ["A", "B"].map((suffix) =>
        runtime.app.inject({
          method: "POST",
          url: "/api/campus/campuses",
          headers: { cookie: session },
          payload: {
            name: `Concurrent quota ${suffix}`,
            university_id: universityId,
          },
        }),
      ),
    );
    assert.deepEqual(campusRaces.map((r) => r.statusCode).sort(), [201, 429]);
    const pagedVenue = await runtime.app.inject({
      url: "/api/campus/venues?limit=1",
      headers: { cookie: session },
    });
    assert.equal(pagedVenue.json().items[0].owner_id, account.json().user.id);
    const joined = await runtime.app.inject({
      method: "POST",
      url: `/api/entities/${entityId}/join`,
      headers: { cookie: session },
      payload: {},
    });
    assert.equal(joined.json().status, "joined");
    const shop = await runtime.app.inject({
      method: "POST",
      url: "/api/commerce/shops",
      headers: { cookie: session },
      payload: {
        name: "Native SQL shop",
        description: "Server adapter acceptance",
        location: "Campus",
      },
    });
    assert.equal(shop.statusCode, 201, shop.body);
    const product = await runtime.app.inject({
      method: "POST",
      url: "/api/commerce/products",
      headers: { cookie: session },
      payload: {
        title: "Campus book",
        description: "Persistent product",
        category: "Books",
        priceCents: 2000,
        stock: 1,
      },
    });
    assert.equal(product.statusCode, 201, product.body);
    productId = product.json().id;
    const buyer = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "buyer@test.example", password: "NativeBuyer123" },
    });
    assert.equal(buyer.statusCode, 201, buyer.body);
    buyerSession = buyer.headers["set-cookie"]!.toString().split(";")[0];
    const reserve = () =>
      runtime.app.inject({
        method: "POST",
        url: "/api/commerce/orders",
        headers: { cookie: buyerSession },
        payload: {
          productId,
          expectedPriceCents: 2000,
          quantity: 1,
          requestKey: randomUUID(),
        },
      });
    const reservations = await Promise.all([reserve(), reserve()]);
    assert.deepEqual(reservations.map((r) => r.statusCode).sort(), [201, 409]);
    orderId = reservations.find((r) => r.statusCode === 201)!.json().id;
    const post = await runtime.app.inject({
      method: "POST",
      url: "/api/community/posts",
      headers: { cookie: buyerSession },
      payload: {
        title: "Native SQL discussion",
        body: "Stored in the actual PostgreSQL server",
        category: "经验交流",
        tags: [],
      },
    });
    assert.equal(post.statusCode, 201, post.body);
    postId = post.json().id;
    await verifyMigrations(runtime.db, "runtime");
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
    const location = await runtime.app.inject({
      url: `/api/campus/events/${entityId}/location`,
      headers: { cookie: session },
    });
    assert.equal(location.statusCode, 200, location.body);
    assert.equal(location.json().location.venue_id, venueId);
    assert.equal(
      location.json().location.university_name,
      "Native PG University",
    );
    const orders = await runtime.app.inject({
      url: "/api/commerce/orders",
      headers: { cookie: buyerSession },
    });
    assert.equal(orders.statusCode, 200, orders.body);
    assert.equal(orders.json().items[0].id, orderId);
    const products = await runtime.app.inject({
      url: "/api/commerce/products",
      headers: { cookie: session },
    });
    assert.equal(
      products.json().items.find((p: { id: string }) => p.id === productId)
        .stock,
      0,
    );
    const post = await runtime.app.inject({
      url: `/api/community/posts/${postId}`,
    });
    assert.equal(post.statusCode, 200, post.body);
    assert.equal(post.json().post.title, "Native SQL discussion");
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
          "trash hides active projects without deleting data",
          "concurrent create and restore enforce 20-project quota with PostgreSQL row locks",
          "runtime registration",
          "event creation and enrollment",
          "server restart persistence",
          "persistent sessions",
          "exact control/runtime migration ledger and repeat-run idempotence",
          "concurrent orders cannot oversell on PostgreSQL server",
          "orders, stock and community posts survive database server restart",
          "campus composite foreign keys and event venue survive PostgreSQL restart",
          "concurrent campus creation enforces the 1000-record quota with row locks",
          "paged campus records carry actual owner independently of school directory pages",
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
