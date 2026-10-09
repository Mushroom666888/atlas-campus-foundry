import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { createControl } from "../server/control.js";
import { createBackup, restoreBackup, verifyBackup } from "../server/backup.js";
import { applicationSecrets } from "../server/vault.js";
import { lockStorage } from "../server/storage-lock.js";

test("offline backup: live-storage refusal, checksums, fresh-root restore, accounts, media, secrets and HTTP redeploy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-backup-"));
  const source = path.join(root, "source"),
    archive = path.join(root, "archive"),
    restored = path.join(root, "restored");
  let control: Awaited<ReturnType<typeof createControl>> | undefined;
  try {
    control = await createControl({ dataDir: source });
    const registered = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "backup@test.example", password: "BackupPassword123" },
    });
    assert.equal(registered.statusCode, 201);
    const owner = registered.json().user.id;
    const cookie = registered.headers["set-cookie"]!.toString().split(";")[0];
    const created = await control.projects.create(
      owner,
      {
        name: "Restore acceptance",
        description: "Persistent recovery verification",
        kind: "marketplace",
        modules: ["content", "media", "search"],
        features: [],
        primaryColor: "rose",
      },
      "Restore acceptance",
    );
    await control.projects.write(
      created.project.id,
      owner,
      "notes.txt",
      "File revision retained across restore",
    );
    assert.equal(
      (
        await control.app.inject({
          method: "PUT",
          url: `/api/projects/${created.project.id}/env`,
          headers: { cookie },
          payload: {
            name: "APP_BACKUP_SECRET",
            value: "verified-without-logging-value",
          },
        })
      ).statusCode,
      200,
    );
    const deployed = await control.deployments.deploy(
      created.project.id,
      owner,
    );
    assert.equal(deployed.status, "running", deployed.logs);
    const base = `http://127.0.0.1:${deployed.port}`;
    const login = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student-backup@test.example",
        password: "StudentBackup123",
      }),
    });
    assert.equal(login.status, 201);
    const runtimeCookie = login.headers.get("set-cookie")!.split(";")[0];
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#338866" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "test.png",
    );
    const uploadResponse = await fetch(`${base}/api/uploads`, {
      method: "POST",
      headers: { cookie: runtimeCookie },
      body: form,
    });
    assert.equal(uploadResponse.status, 201);
    const upload = (await uploadResponse.json()) as { id: string; url: string };
    const listingResponse = await fetch(`${base}/api/entities`, {
      method: "POST",
      headers: { cookie: runtimeCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "listing",
        title: "Book survives restore",
        data: { price: 12, imageId: upload.id },
      }),
    });
    assert.equal(listingResponse.status, 201);
    const listing = (await listingResponse.json()) as { id: string };
    const mediaBefore = Buffer.from(
      await (
        await fetch(base + upload.url, { headers: { cookie: runtimeCookie } })
      ).arrayBuffer(),
    );
    await assert.rejects(createBackup(source, archive), { code: "ELOCKED" });
    await assert.rejects(lockStorage(path.join(source, "control")), {
      code: "ELOCKED",
    });
    const lifecycle = new Map<string, string>();
    for (const state of ["failed", "deleted", "stopped", "building"]) {
      const id = randomUUID();
      lifecycle.set(id, state);
      await control.db.query(
        "INSERT INTO deployments(id,app_id,owner_id,status,provider,spec) SELECT $1,app_id,owner_id,$2,provider,spec FROM deployments WHERE id=$3",
        [id, state, deployed.id],
      );
    }
    await control.app.close();
    control = undefined;
    const provenancePath = path.join(
      source,
      "apps",
      created.application.id,
      "storage.json",
    );
    const provenance = await readFile(provenancePath, "utf8");
    await writeFile(
      provenancePath,
      JSON.stringify({ database: "postgresql-server", isolation: "local" }),
    );
    await assert.rejects(createBackup(source, archive), /external PostgreSQL/);
    await writeFile(
      provenancePath,
      JSON.stringify({ database: "pglite", isolation: "docker" }),
    );
    await assert.rejects(createBackup(source, archive), /container volumes/);
    await writeFile(provenancePath, provenance);
    const snapshot = await createBackup(source, archive);
    assert.ok(snapshot.files > 10);
    assert.ok(snapshot.bytes > 1000);
    const manifest = await verifyBackup(archive);
    assert.ok(manifest.files.some((file) => file.path === "vault.key"));
    assert.ok(
      manifest.files.some((file) => file.path.startsWith("revisions/")),
    );
    await assert.rejects(restoreBackup(archive, source), { code: "EEXIST" });
    await restoreBackup(archive, restored);
    control = await createControl({ dataDir: restored, recover: true });
    const me = await control.app.inject({
      method: "GET",
      url: "/api/projects",
      headers: { cookie },
    });
    assert.equal(me.statusCode, 200);
    assert.ok(
      me
        .json()
        .items.some((item: { id: string }) => item.id === created.project.id),
    );
    assert.equal(
      await control.projects.read(created.project.id, owner, "notes.txt"),
      "File revision retained across restore",
    );
    assert.deepEqual(
      await applicationSecrets(control.db, restored, created.application.id),
      { APP_BACKUP_SECRET: "verified-without-logging-value" },
    );
    const oldDeployment = await control.deployments.get(deployed.id, owner);
    assert.equal(oldDeployment.status, "stopped");
    for (const [id, state] of lifecycle)
      assert.equal(
        (await control.deployments.get(id, owner)).status,
        state === "building" ? "interrupted" : state,
      );
    assert.ok(oldDeployment.artifact.startsWith(restored));
    const redeployed = await control.deployments.restart(deployed.id, owner);
    assert.equal(redeployed.status, "running", redeployed.logs);
    const newBase = `http://127.0.0.1:${redeployed.port}`;
    const recovered = await fetch(`${newBase}/api/entities/${listing.id}`, {
      headers: { cookie: runtimeCookie },
    });
    assert.equal(recovered.status, 200);
    assert.equal(
      ((await recovered.json()) as { title: string }).title,
      "Book survives restore",
    );
    const mediaAfter = Buffer.from(
      await (
        await fetch(newBase + upload.url, {
          headers: { cookie: runtimeCookie },
        })
      ).arrayBuffer(),
    );
    assert.deepEqual(mediaAfter, mediaBefore);
    const file = path.join(archive, "payload", "vault.key");
    const key = await readFile(file);
    await writeFile(file, "corrupt");
    await assert.rejects(verifyBackup(archive), /integrity/);
    await assert.rejects(
      restoreBackup(archive, path.join(root, "corrupt-restore")),
      /integrity/,
    );
    await writeFile(file, key);
    manifest.files[0].path = "../escape";
    await writeFile(
      path.join(archive, "manifest.json"),
      JSON.stringify(manifest),
    );
    await assert.rejects(verifyBackup(archive), /Invalid backup path/);
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/backup-results.json",
      JSON.stringify(
        {
          status: "TESTED",
          at: new Date().toISOString(),
          checks: [
            "running storage refused",
            "control and application snapshots",
            "integrity and traversal rejection",
            "existing destination protected",
            "control and runtime sessions",
            "business records and media",
            "vault secrets and file revisions",
            "relocated artifact HTTP restart",
          ],
          files: snapshot.files,
          bytes: snapshot.bytes,
        },
        null,
        2,
      ),
    );
  } finally {
    await control?.app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("kernel storage ownership survives an unresponsive owner and releases after process death", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "foundry-lock-"));
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import { lockStorage } from './server/storage-lock.ts';
    await lockStorage(process.env.LOCK_TEST_DIRECTORY);
    process.send('locked');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  `,
    ],
    {
      env: { ...process.env, LOCK_TEST_DIRECTORY: root },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let failure = "";
  child.stderr!.on("data", (chunk) => {
    failure += chunk;
  });
  try {
    const message = await Promise.race([
      once(child, "message"),
      once(child, "exit").then(() => {
        throw new Error(failure || "Lock child exited unexpectedly");
      }),
    ]);
    assert.equal(message[0], "locked");
    await delay(11000);
    await assert.rejects(lockStorage(root), { code: "ELOCKED" });
    const exited = once(child, "exit");
    child.kill();
    await exited;
    const release = await lockStorage(root);
    await release();
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});
