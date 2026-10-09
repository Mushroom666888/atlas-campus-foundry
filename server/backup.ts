import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Database } from "./db.js";
import { lockStorage } from "./storage-lock.js";

const roots = [
  "control",
  "apps",
  "projects",
  "revisions",
  "artifacts",
  "outbox",
  "vault.key",
  "local-access.json",
  "storage.json",
];
const manifestSchema = z.object({
  format: z.literal("campus-foundry-offline-v1"),
  platform: z.string(),
  createdAt: z.iso.datetime(),
  sourceRoot: z.string(),
  directories: z.array(z.string().min(1).max(4096)).min(1).max(100000),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(4096),
        size: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1)
    .max(100000),
});
type Entry = z.infer<typeof manifestSchema>["files"][number];

function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function relativePath(value: string) {
  const parts = value.split("/");
  if (
    !roots.includes(parts[0]) ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[\\:]/.test(part) ||
        [...part].some((character) => character.charCodeAt(0) < 32) ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part),
    )
  )
    throw new Error("Invalid backup path");
  return parts;
}

async function digest(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function inventory(
  root: string,
  selected: string[] = roots,
): Promise<{ files: Entry[]; directories: string[] }> {
  const result: Entry[] = [];
  const directories: string[] = [];
  async function visit(relative: string) {
    if (/^apps\/[^/]+\/db\.lock$/.test(relative)) return;
    relativePath(relative);
    const file = path.join(root, ...relative.split("/"));
    const stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error("Backup refuses symbolic links");
    if (stat.isDirectory()) {
      directories.push(relative);
      for (const child of (await readdir(file)).sort())
        await visit(`${relative}/${child}`);
    } else if (stat.isFile()) {
      result.push({
        path: relative,
        size: stat.size,
        sha256: await digest(file),
      });
    } else throw new Error("Backup refuses special files");
  }
  for (const name of selected) {
    try {
      await lstat(path.join(root, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      continue;
    }
    await visit(name);
  }
  return {
    files: result.sort((a, b) => a.path.localeCompare(b.path)),
    directories: directories.sort(),
  };
}

async function newDestination(target: string, source: string) {
  const absolute = path.resolve(target);
  await mkdir(path.dirname(absolute), { recursive: true });
  const resolved = path.join(
    await realpath(path.dirname(absolute)),
    path.basename(absolute),
  );
  if (inside(source, resolved) || inside(resolved, source))
    throw new Error("Backup and restore directories must not overlap");
  await mkdir(resolved, { mode: 0o700 });
  return resolved;
}

async function copyEntries(
  source: string,
  destination: string,
  entries: Entry[],
  directories: string[],
) {
  for (const directory of directories)
    await mkdir(path.join(destination, ...relativePath(directory)), {
      recursive: true,
      mode: 0o700,
    });
  for (const entry of entries) {
    const parts = relativePath(entry.path);
    const target = path.join(destination, ...parts);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(path.join(source, ...parts), target, 1);
    if (
      (await lstat(target)).size !== entry.size ||
      (await digest(target)) !== entry.sha256
    )
      throw new Error(`Backup changed during copy: ${entry.path}`);
  }
}

export async function createBackup(dataDirectory: string, target: string) {
  const source = await realpath(dataDirectory);
  const storage = JSON.parse(
    await readFile(path.join(source, "storage.json"), "utf8"),
  );
  if (storage.control !== "pglite")
    throw new Error(
      "Offline file backup supports PGlite only; use pg_dump for PostgreSQL servers",
    );
  const release: (() => Promise<void>)[] = [];
  try {
    release.push(await lockStorage(path.join(source, "control")));
    // Holding the control lock prevents new app deployments while their locks are acquired.
    let apps: string[] = [];
    try {
      apps = await readdir(path.join(source, "apps"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const app of apps) {
      const provenance = JSON.parse(
        await readFile(path.join(source, "apps", app, "storage.json"), "utf8"),
      );
      if (provenance.database !== "pglite" || provenance.isolation !== "local")
        throw new Error(
          "File backup supports local PGlite apps only; external PostgreSQL or container volumes require their own offline backup",
        );
      const directory = path.join(source, "apps", app, "db");
      try {
        if ((await lstat(directory)).isDirectory())
          release.push(await lockStorage(directory));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const { files: entries, directories } = await inventory(source);
    const destination = await newDestination(target, source);
    const payload = path.join(destination, "payload");
    await mkdir(payload, { mode: 0o700 });
    await copyEntries(source, payload, entries, directories);
    const manifest = manifestSchema.parse({
      format: "campus-foundry-offline-v1",
      platform: process.platform,
      createdAt: new Date().toISOString(),
      sourceRoot: source,
      files: entries,
      directories,
    });
    await writeFile(
      path.join(destination, "manifest.json.pending"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await rename(
      path.join(destination, "manifest.json.pending"),
      path.join(destination, "manifest.json"),
    );
    return {
      directory: destination,
      files: entries.length,
      bytes: entries.reduce((n, entry) => n + entry.size, 0),
    };
  } finally {
    for (const unlock of release.reverse()) await unlock();
  }
}

export async function verifyBackup(directory: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")),
  );
  const seen = new Set<string>();
  for (const name of [
    ...manifest.files.map((entry) => entry.path),
    ...manifest.directories,
  ]) {
    relativePath(name);
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) throw new Error("Duplicate backup path");
    seen.add(normalized);
  }
  const payload = path.join(directory, "payload");
  if ((await lstat(payload)).isSymbolicLink())
    throw new Error("Backup refuses symbolic links");
  const actual = await inventory(payload, await readdir(payload));
  const expected = {
    files: [...manifest.files].sort((a, b) => a.path.localeCompare(b.path)),
    directories: [...manifest.directories].sort(),
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Backup integrity verification failed");
  return manifest;
}

export async function restoreBackup(directory: string, target: string) {
  const source = await realpath(directory);
  const manifest = await verifyBackup(source);
  if (manifest.platform !== process.platform)
    throw new Error("Cross-platform physical restore has not been validated");
  const destination = await newDestination(target, source);
  await copyEntries(
    path.join(source, "payload"),
    destination,
    manifest.files,
    manifest.directories,
  );
  const db = await new Database(path.join(destination, "control")).init();
  try {
    await db.transaction(async (tx) => {
      const deployments = await tx.query<{ id: string; artifact: string }>(
        "SELECT id,artifact FROM deployments",
      );
      for (const deployment of deployments.rows) {
        z.uuid().parse(deployment.id);
        await tx.query(
          "UPDATE deployments SET artifact=$2,status=CASE WHEN status IN ('running','starting','building') THEN 'interrupted' ELSE status END,pid=NULL,port=0,updated_at=now() WHERE id=$1",
          [
            deployment.id,
            deployment.artifact
              ? path.join(destination, "artifacts", deployment.id)
              : "",
          ],
        );
      }
      await tx.query(
        "UPDATE jobs SET status='interrupted',error='Restored from offline backup' WHERE status IN ('queued','running')",
      );
      await tx.query(
        "INSERT INTO audit_log(action,resource_id,detail) VALUES($1,$2,$3)",
        [
          "storage.restored",
          randomUUID(),
          JSON.stringify({ backedUpAt: manifest.createdAt }),
        ],
      );
    });
  } finally {
    await db.close();
  }
  return {
    directory: destination,
    files: manifest.files.length,
    status: "RESTORED_OFFLINE",
  };
}
