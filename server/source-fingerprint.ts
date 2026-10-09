import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function sharedSourceFingerprint() {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(ts|sql)$/.test(file)) files.push(file);
    }
  }
  for (const directory of [
    "packages/modules/src",
    "packages/contracts/src",
    "migrations/runtime",
  ])
    await walk(directory);
  files.push(
    ...[
      "runtime-server",
      "runtime-main",
      "auth",
      "db",
      "providers",
      "http",
    ].map((name) => `server/${name}.ts`),
  );
  const hash = createHash("sha256");
  let lines = 0;
  for (const file of files.sort()) {
    const text = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
    hash.update(file.replaceAll("\\", "/") + "\0" + text + "\0");
    lines += text.split("\n").length;
  }
  return {
    hash: hash.digest("hex"),
    files: files.map((file) => file.replaceAll("\\", "/")),
    lines,
  };
}
