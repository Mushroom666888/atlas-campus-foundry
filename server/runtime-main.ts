import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createRuntime } from "./runtime-server.js";
import type { RuntimeConfig } from "../packages/modules/src/runtime.js";

const file = process.env.RUNTIME_CONFIG;
if (!file) throw new Error("RUNTIME_CONFIG required");
const config = JSON.parse(await readFile(file, "utf8")) as RuntimeConfig;
const { app } = await createRuntime(config, {
  frontend: true,
  logger: true,
  databaseUrl: process.env.APP_DATABASE_URL,
});
await app.listen({
  host: process.env.RUNTIME_HOST || "127.0.0.1",
  port: Number(process.env.RUNTIME_PORT || 4100),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
if (process.send)
  process.on("disconnect", () => {
    void app.close().then(() => process.exit(0));
  });
