import { mkdir, writeFile } from "node:fs/promises";
import { command } from "../server/executor.js";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this command through npm run acceptance");
const connected = process.argv.includes("--connected");
const commands = [
  "lint",
  "build",
  "test",
  "e2e",
  "verify-postgres",
  "verify-recovery",
  "reuse-report",
  ...(connected
    ? ["verify-integrations", "verify-docker", "verify-live-agent"]
    : []),
];
const results = [];
await mkdir("artifacts/acceptance", { recursive: true });
for (const name of commands) {
  const extra = name === "reuse-report" ? ["--", "--showcase"] : [];
  const commandLabel = ["npm", "run", name, ...extra].join(" ");
  console.log(`RUNNING: ${commandLabel}`);
  const result = await command(process.execPath, [npm, "run", name, ...extra], {
    timeout: name === "verify-live-agent" ? 1000000 : 240000,
  });
  const status = result.ok
    ? "TESTED"
    : result.exitCode === 2
      ? "BLOCKED"
      : "FAILED";
  results.push({
    command: commandLabel,
    status,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
  });
  await writeFile(
    `artifacts/acceptance/${name}.log`,
    result.stdout + "\n" + result.stderr,
  );
  await writeFile(
    "artifacts/acceptance/results.json",
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );
  console.log(`${status}: ${commandLabel}`);
}
process.exitCode = results.some((r) => r.status === "FAILED")
  ? 1
  : results.some((r) => r.status === "BLOCKED")
    ? 2
    : 0;
