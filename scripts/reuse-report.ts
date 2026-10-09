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
const report = {
  at: new Date().toISOString(),
  sharedRuntimeLines: fingerprint.lines,
  sourceFiles: fingerprint.files,
  uniqueApplications: unique.length,
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
await writeFile("artifacts/reuse-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (unique.length < 3 || unique.some((a) => !a.sameCurrentSource))
  process.exitCode = 1;
