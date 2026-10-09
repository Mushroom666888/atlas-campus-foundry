import Fastify from "fastify";
import { Database } from "./db.js";
import { setupAuth, requireUser } from "./auth.js";
import { errors, serveFrontend } from "./http.js";
import {
  registerRuntime,
  type RuntimeConfig,
} from "../packages/modules/src/runtime.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import fastifyStatic from "@fastify/static";
import type { RegisterFeature } from "../packages/sdk/src/index.js";

export async function createRuntime(
  config: RuntimeConfig,
  options: { frontend?: boolean; databaseUrl?: string; logger?: boolean } = {},
) {
  const db = await new Database(
    path.join(config.dataDir, "db"),
    options.databaseUrl,
  ).init();
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(
    path.join(config.dataDir, "storage.json"),
    JSON.stringify({
      database: options.databaseUrl ? "postgresql-server" : "pglite",
      isolation: process.env.FOUNDRY_ISOLATED === "docker" ? "docker" : "local",
    }),
  );
  await db.migrate("runtime");
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1024 * 1024,
  });
  errors(app);
  await setupAuth(app, db, config.appId, false);
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return {
      status: "ok",
      appId: config.appId,
      storage: "postgresql",
      runtime: "shared-modules",
    };
  });
  await registerRuntime(app, db, config);
  if (
    process.env.FOUNDRY_ISOLATED === "docker" &&
    process.env.ENABLE_CUSTOM_CODE === "true"
  ) {
    const entry = "/opt/foundry/app-workspace/dist/feature.js";
    if (existsSync(entry)) {
      const extension = (await import(pathToFileURL(entry).href)) as {
        register: RegisterFeature;
      };
      if (typeof extension.register !== "function")
        throw new Error("Custom feature must export register(app, context)");
      await extension.register(app, {
        db,
        config,
        requireUser,
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([name, value]) => name.startsWith("APP_") && value !== undefined,
          ),
        ) as Record<string, string>,
      });
    }
    if (existsSync("/opt/foundry/app-workspace/public/index.html"))
      await app.register(fastifyStatic, {
        root: "/opt/foundry/app-workspace/public",
        prefix: "/custom/",
        decorateReply: false,
      });
  }
  if (options.frontend) await serveFrontend(app);
  app.addHook("onClose", () => db.close());
  return { app, db };
}
