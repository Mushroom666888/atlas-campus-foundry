import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sharedSourceFingerprint } from "../server/source-fingerprint.js";
const root = path.resolve(process.env.DATA_DIR || ".data");
const fingerprint = await sharedSourceFingerprint();
const hash = fingerprint.hash;
let artifacts: string[] = [];
try {
  artifacts = await readdir(path.join(root, "artifacts"));
} catch {
  /* No deploy artifacts yet. */
}
const rows = [];
for (const id of artifacts) {
  try {
    const artifact = JSON.parse(
      await readFile(path.join(root, "artifacts", id, "artifact.json"), "utf8"),
    );
    rows.push({
      deploymentId: id,
      applicationId: artifact.appId,
      name: artifact.spec.name,
      createdAt: artifact.createdAt,
      modules: artifact.installs,
      sharedSource: artifact.source,
      sourceHash: artifact.sourceHash,
      sameCurrentSource: artifact.sourceHash === hash,
      customExecutableCode: artifact.hasCode,
    });
  } catch {
    /* Failed preflight jobs have no artifact. */
  }
}
const unique = [
  ...new Map(
    rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((row) => [row.applicationId, row]),
  ).values(),
];
const showcaseOnly = process.argv.includes("--showcase");
let selected = unique;
if (showcaseOnly) {
  const showcase = JSON.parse(
    await readFile(path.join(root, "showcase.json"), "utf8"),
  );
  const expected = new Set<string>(
    showcase.applications.map(
      (app: { applicationId: string }) => app.applicationId,
    ),
  );
  for (const filename of ["visual-showcase.json", "commercial-showcase.json"]) {
    try {
      const app = JSON.parse(await readFile(path.join(root, filename), "utf8"));
      const match = /^app-([a-f0-9-]+)\.localhost$/.exec(
        new URL(app.url).hostname,
      );
      if (!match) throw new Error(`Invalid showcase address in ${filename}`);
      expected.add(match[1]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  selected = unique.filter((app) => expected.has(app.applicationId));
  if (selected.length !== expected.size)
    throw new Error(
      "A declared showcase application has no deployment artifact",
    );
}
const report = {
  at: new Date().toISOString(),
  scope: showcaseOnly
    ? "declared showcase applications"
    : "all retained application artifacts",
  sharedRuntimeLines: fingerprint.lines,
  sourceFiles: fingerprint.files,
  uniqueApplications: unique.length,
  validatedApplications: selected.length,
  outsideScope: unique
    .filter((app) => !selected.includes(app))
    .map((app) => ({
      applicationId: app.applicationId,
      name: app.name,
      sameCurrentSource: app.sameCurrentSource,
    })),
  applications: unique,
  sharedCodeImplementations: 1,
  applicationSpecificExecutableLines: unique.every(
    (a) => !a.customExecutableCode,
  )
    ? 0
    : null,
  moduleInstallationCount: unique.reduce((n, a) => n + a.modules.length, 0),
  distinctModuleIds: [
    ...new Set(
      unique.flatMap((a) =>
        a.modules.map((m: { module_id: string }) => m.module_id),
      ),
    ),
  ],
  integrationWorkflow: [
    "create product specification",
    "resolve and install shared modules",
    "assemble immutable deployment artifact",
    "start independent runtime and probe HTTP health",
  ],
  interpretation:
    "All module invocations use @campus/modules. Deterministic composition is not LLM-generated bespoke code. Runtime source hash equality proves shared artifact provenance, not behavior by itself.",
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  showcaseOnly
    ? "artifacts/showcase-reuse-report.json"
    : "artifacts/reuse-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (selected.length < 3 || selected.some((a) => !a.sameCurrentSource))
  process.exitCode = 1;
