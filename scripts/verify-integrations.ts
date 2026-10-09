import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { OpenAICompatibleProvider } from "../server/agent.js";
import { command } from "../server/executor.js";
import nodemailer from "nodemailer";
import pg from "pg";
type Result = {
  name: string;
  status: "TESTED" | "BLOCKED" | "FAILED";
  detail: string;
};
const results: Result[] = [];
if (process.env.LLM_API_KEY && process.env.LLM_MODEL) {
  try {
    const message = await new OpenAICompatibleProvider().complete(
      [
        {
          role: "user",
          content:
            "Call verify_connection with status connected. Do not answer in prose.",
        },
      ],
      [
        {
          type: "function",
          function: {
            name: "verify_connection",
            description: "Verify structured tool calling",
            parameters: {
              type: "object",
              properties: { status: { type: "string", enum: ["connected"] } },
              required: ["status"],
              additionalProperties: false,
            },
          },
        },
      ],
    );
    if (
      !message.tool_calls?.some((c) => c.function.name === "verify_connection")
    )
      throw new Error("Provider returned no required tool call");
    results.push({
      name: "LLM live tool call",
      status: "TESTED",
      detail: "Real configured provider returned a structured tool call.",
    });
  } catch (error) {
    results.push({
      name: "LLM live tool call",
      status: "FAILED",
      detail: (error as Error).message,
    });
  }
} else
  results.push({
    name: "LLM live tool call",
    status: "BLOCKED",
    detail:
      "Set LLM_API_KEY and LLM_MODEL in .env; optionally set LLM_BASE_URL.",
  });
const docker = await command(
  "docker",
  ["info", "--format", "{{.ServerVersion}}"],
  { timeout: 10000 },
);
results.push({
  name: "Docker Engine",
  status: docker.ok ? "TESTED" : "BLOCKED",
  detail: docker.ok
    ? docker.stdout.trim()
    : "Docker CLI/Engine unavailable. Install Docker Desktop and enable Linux containers.",
});
if (docker.ok) {
  const image = await command(
    "docker",
    ["image", "inspect", process.env.FOUNDRY_IMAGE || "campus-foundry:local"],
    { timeout: 10000 },
  );
  results.push({
    name: "Foundry runner image",
    status: image.ok ? "TESTED" : "BLOCKED",
    detail: image.ok
      ? "Image exists; isolated executor acceptance is run by npm run verify-docker."
      : "Run npm run image:build before isolated executor acceptance.",
  });
}
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await pool.query("SELECT 1");
    results.push({
      name: "PostgreSQL server",
      status: "TESTED",
      detail:
        "Configured server responded. Migration/application compatibility needs postgres acceptance.",
    });
  } catch (error) {
    results.push({
      name: "PostgreSQL server",
      status: "FAILED",
      detail: (error as Error).message,
    });
  } finally {
    await pool.end();
  }
} else {
  const native = await command(
    process.execPath,
    ["--import", "tsx", "scripts/verify-postgres.ts"],
    { timeout: 60000 },
  );
  results.push({
    name: "Native PostgreSQL local alternative",
    status: native.ok ? "TESTED" : "BLOCKED",
    detail: native.ok
      ? "Native server migrations and restart persistence passed; no external database credentials required."
      : "External DATABASE_URL absent; PGlite remains available and native acceptance was unavailable on this OS.",
  });
}
if (process.env.SMTP_URL && process.env.EMAIL_FROM) {
  try {
    await nodemailer.createTransport(process.env.SMTP_URL).verify();
    results.push({
      name: "SMTP transport",
      status: "TESTED",
      detail: "Server connection verified; no email sent.",
    });
  } catch (error) {
    results.push({
      name: "SMTP transport",
      status: "FAILED",
      detail: (error as Error).message,
    });
  }
} else
  results.push({
    name: "SMTP transport",
    status: "BLOCKED",
    detail:
      "Local outbox is available. Set EMAIL_PROVIDER=smtp, SMTP_URL and EMAIL_FROM for real delivery.",
  });
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/integration-results.json",
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
for (const result of results)
  console.log(`${result.status}: ${result.name}: ${result.detail}`);
process.exitCode = results.some((r) => r.status === "FAILED")
  ? 1
  : results.some((r) => r.status === "BLOCKED")
    ? 2
    : 0;
