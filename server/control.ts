import Fastify from "fastify";
import { z } from "zod";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { Database } from "./db.js";
import { setupAuth, requireUser } from "./auth.js";
import { errors, serveFrontend } from "./http.js";
import { Projects } from "./projects.js";
import { exportProject } from "./export.js";
import { Deployments } from "./deployment.js";
import { Agent, toolContracts } from "./agent.js";
import {
  moduleManifestSchema,
  productSpecSchema,
} from "../packages/contracts/src/index.js";
import { IsolatedExecutor, dockerAvailable } from "./executor.js";
import { encryptSecret } from "./vault.js";
import { registerCommunity } from "../packages/modules/src/community.js";

export async function createControl(
  options: {
    dataDir?: string;
    databaseUrl?: string;
    frontend?: boolean;
    logger?: boolean;
    recover?: boolean;
  } = {},
) {
  const root = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? ".data");
  await mkdir(root, { recursive: true });
  const db = await new Database(
    path.join(root, "control"),
    options.databaseUrl ?? process.env.DATABASE_URL,
  ).init();
  await writeFile(
    path.join(root, "storage.json"),
    JSON.stringify({
      control:
        options.databaseUrl || process.env.DATABASE_URL
          ? "postgresql-server"
          : "pglite",
    }),
  );
  await db.migrate("control");
  const projects = new Projects(db, root);
  await projects.seed();
  const deployments = new Deployments(projects),
    agent = new Agent(projects, deployments),
    executor = new IsolatedExecutor();
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1024 * 1024,
  });
  errors(app);
  await setupAuth(app, db, "control", true);
  registerCommunity(app, db);
  const id = (request: { params: unknown }) =>
    (request.params as { id: string }).id;
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return {
      status: "ok",
      service: "campus-foundry",
      database:
        options.databaseUrl || process.env.DATABASE_URL
          ? "postgresql-server"
          : "pglite-postgresql",
    };
  });
  app.get("/api/contracts", async (request) => {
    requireUser(request);
    return {
      manifest: z.toJSONSchema(moduleManifestSchema),
      product: z.toJSONSchema(productSpecSchema),
      tools: toolContracts,
    };
  });
  app.get("/api/system", async (request) => {
    requireUser(request);
    return {
      llm: {
        configured: Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL),
        model: process.env.LLM_MODEL || null,
      },
      deployment: {
        provider: process.env.DEPLOYMENT_PROVIDER || "local-trusted",
        docker: await dockerAvailable(),
        untrustedCode: "docker-required",
      },
      version: "0.1.0",
    };
  });
  app.get("/api/projects", async (request) => {
    const user = requireUser(request);
    const { trash } = z
      .object({ trash: z.enum(["true", "false"]).default("false") })
      .parse(request.query);
    return {
      items: (
        await db.query(
          "SELECT p.*,a.id AS app_id FROM projects p JOIN applications a ON a.project_id=p.id WHERE p.owner_id=$1 AND (p.deleted_at IS NOT NULL)=$2 ORDER BY p.updated_at DESC",
          [user.id, trash === "true"],
        )
      ).rows,
    };
  });
  app.post("/api/projects", async (request, reply) => {
    const user = requireUser(request);
    const input = z
      .object({
        spec: z.unknown(),
        idea: z.string().max(12000).default("Explicit module assembly"),
      })
      .parse(request.body);
    return reply
      .code(201)
      .send(await projects.create(user.id, input.spec, input.idea));
  });
  app.get("/api/projects/:id", async (request) => {
    const user = requireUser(request);
    return {
      project: await projects.get(id(request), user.id),
      application: await projects.application(id(request), user.id),
      installs: await projects.installs(id(request), user.id),
    };
  });
  app.put("/api/projects/:id", async (request) =>
    projects.update(id(request), requireUser(request).id, request.body),
  );
  app.delete("/api/projects/:id", async (request) => {
    const actor = requireUser(request).id;
    return deployments.archiveProject(id(request), actor, () =>
      agent.cancelProject(id(request), actor),
    );
  });
  app.post("/api/projects/:id/restore", async (request) =>
    deployments.restoreProject(id(request), requireUser(request).id),
  );
  app.get("/api/projects/:id/export", async (request, reply) => {
    const actor = requireUser(request).id;
    const archive = await exportProject(projects, id(request), actor);
    return reply
      .header("Cache-Control", "no-store")
      .header(
        "Content-Disposition",
        `attachment; filename="atlas-${z.uuid().parse(id(request))}.zip"`,
      )
      .type("application/zip")
      .send(archive);
  });
  app.get("/api/projects/:id/files", async (request) => ({
    items: await projects.files(id(request), requireUser(request).id),
  }));
  app.get("/api/projects/:id/requirements", async (request) =>
    projects.requirements(id(request), requireUser(request).id),
  );
  app.get("/api/projects/:id/file", async (request) =>
    projects.readVersion(
      id(request),
      requireUser(request).id,
      z.object({ path: z.string() }).parse(request.query).path,
    ),
  );
  app.put("/api/projects/:id/file", async (request) => {
    const input = z
      .object({
        path: z.string(),
        content: z.string(),
        expectedHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
      })
      .parse(request.body);
    return projects.edit(
      id(request),
      requireUser(request).id,
      input.path,
      input.content,
      input.expectedHash,
    );
  });
  app.get("/api/projects/:id/file-history", async (request) => ({
    items: await projects.history(
      id(request),
      requireUser(request).id,
      z.object({ path: z.string() }).parse(request.query).path,
    ),
  }));
  app.get("/api/projects/:id/revisions/:revision", async (request) =>
    projects.revision(
      id(request),
      requireUser(request).id,
      (request.params as { revision: string }).revision,
    ),
  );
  app.post("/api/projects/:id/revisions/:revision/restore", async (request) => {
    const actor = requireUser(request).id;
    const input = z
      .object({
        expectedHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
      })
      .parse(request.body);
    const revision = await projects.revision(
      id(request),
      actor,
      (request.params as { revision: string }).revision,
    );
    return projects.edit(
      id(request),
      actor,
      revision.path,
      revision.after,
      input.expectedHash,
    );
  });
  app.get("/api/modules", async (request) => {
    const user = requireUser(request);
    const { q } = z
      .object({ q: z.string().max(100).default("") })
      .parse(request.query);
    return {
      items: (await projects.available(user.id)).filter((m) =>
        JSON.stringify(m).toLowerCase().includes(q.toLowerCase()),
      ),
    };
  });
  app.post("/api/projects/:id/modules", async (request) => {
    const input = z
      .object({
        modules: z.array(z.string()).min(1),
        pins: z.record(z.string(), z.string()).default({}),
      })
      .parse(request.body);
    return {
      items: await projects.install(
        id(request),
        requireUser(request).id,
        input.modules,
        input.pins,
      ),
    };
  });
  app.post("/api/projects/:id/modules/rollback", async (request) => ({
    items: await projects.rollbackModules(id(request), requireUser(request).id),
  }));
  app.get("/api/projects/:id/modules/history", async (request) => {
    const application = await projects.application(
      id(request),
      requireUser(request).id,
    );
    return {
      items: (
        await db.query(
          "SELECT * FROM install_history WHERE app_id=$1 ORDER BY created_at DESC",
          [application.id],
        )
      ).rows,
    };
  });
  app.post("/api/projects/:id/extract", async (request) =>
    projects.extract(id(request), requireUser(request).id, request.body),
  );
  app.get("/api/modules/pending", async (request) => {
    const user = requireUser(request);
    return {
      items: (
        await db.query(
          "SELECT module_id,version,manifest,recipe,status,owner_id FROM module_versions WHERE status='pending' AND ($1='admin' OR owner_id=$2)",
          [user.role, user.id],
        )
      ).rows,
    };
  });
  app.post("/api/modules/:id/approve", async (request) =>
    projects.review(
      requireUser(request),
      id(request),
      z.object({ version: z.string() }).parse(request.body).version,
    ),
  );
  app.get("/api/jobs", async (request) => {
    const user = requireUser(request);
    const { projectId } = z
      .object({ projectId: z.uuid().optional() })
      .parse(request.query);
    return {
      items: (
        await db.query(
          "SELECT * FROM jobs WHERE owner_id=$1 AND ($2::text IS NULL OR project_id=$2) ORDER BY created_at DESC LIMIT 100",
          [user.id, projectId ?? null],
        )
      ).rows,
    };
  });
  app.post("/api/jobs", async (request, reply) => {
    const user = requireUser(request);
    const input = z
      .object({
        input: z.string(),
        projectId: z.uuid().optional(),
        mode: z.enum(["llm", "design"]).default("llm"),
      })
      .parse(request.body);
    return reply
      .code(202)
      .send(
        await agent.create(user.id, input.input, input.projectId, input.mode),
      );
  });
  app.get("/api/jobs/:id", async (request) => {
    const user = requireUser(request);
    const job = await agent.get(id(request), user.id);
    return {
      job,
      events: (
        await db.query("SELECT * FROM job_events WHERE job_id=$1 ORDER BY id", [
          job.id,
        ])
      ).rows,
    };
  });
  app.post("/api/jobs/:id/cancel", async (request) =>
    agent.cancel(id(request), requireUser(request).id),
  );
  app.post("/api/jobs/:id/retry", async (request) => {
    const user = requireUser(request),
      job = await agent.get(id(request), user.id);
    return agent.create(
      user.id,
      job.input,
      job.project_id ?? undefined,
      job.mode === "design" ? "design" : "llm",
    );
  });
  app.post("/api/projects/:id/validate", async (request) => {
    const user = requireUser(request);
    await projects.get(id(request), user.id);
    const { kind } = z
      .object({ kind: z.enum(["build", "test"]) })
      .parse(request.body);
    const result = await executor.run(projects.workspace(id(request)), kind);
    await projects.audit(user.id, `project.${kind}`, id(request), result);
    return result;
  });
  app.get("/api/deployments", async (request) => {
    const user = requireUser(request);
    const { projectId } = z
      .object({ projectId: z.uuid().optional() })
      .parse(request.query);
    return {
      items: (
        await db.query(
          "SELECT d.*,p.name AS project_name FROM deployments d JOIN applications a ON a.id=d.app_id JOIN projects p ON p.id=a.project_id WHERE d.owner_id=$1 AND p.deleted_at IS NULL AND ($2::text IS NULL OR p.id=$2) ORDER BY d.created_at DESC LIMIT 100",
          [user.id, projectId ?? null],
        )
      ).rows,
    };
  });
  app.post("/api/projects/:id/deploy", async (request) =>
    deployments.deploy(id(request), requireUser(request).id),
  );
  app.post("/api/deployments/:id/stop", async (request) =>
    deployments.stop(id(request), requireUser(request).id),
  );
  app.post("/api/deployments/:id/restart", async (request) =>
    deployments.restart(id(request), requireUser(request).id),
  );
  app.post("/api/deployments/:id/rollback", async (request) =>
    deployments.rollback(id(request), requireUser(request).id),
  );
  app.delete("/api/deployments/:id", async (request) =>
    deployments.remove(id(request), requireUser(request).id),
  );
  app.get("/api/deployments/:id/logs", async (request) => ({
    logs: await deployments.logs(id(request), requireUser(request).id),
  }));
  app.get("/api/deployments/:id/health", async (request) =>
    deployments.health(id(request), requireUser(request).id),
  );
  app.get("/api/audit", async (request) => ({
    items: (
      await db.query(
        "SELECT * FROM audit_log WHERE actor_id=$1 ORDER BY id DESC LIMIT 100",
        [requireUser(request).id],
      )
    ).rows,
  }));
  app.get("/api/projects/:id/env", async (request) => {
    const application = await projects.application(
      id(request),
      requireUser(request).id,
    );
    return {
      items: (
        await db.query("SELECT name FROM app_secrets WHERE app_id=$1", [
          application.id,
        ])
      ).rows,
    };
  });
  app.put("/api/projects/:id/env", async (request) => {
    const user = requireUser(request),
      application = await projects.application(id(request), user.id);
    const input = z
      .object({
        name: z
          .string()
          .regex(/^APP_[A-Z0-9_]{1,60}$/)
          .refine(
            (name) => name !== "APP_DATABASE_URL",
            "Reserved runtime variable",
          ),
        value: z
          .string()
          .min(1)
          .max(8192)
          .refine(
            (value) => !/[\r\n\0]/.test(value),
            "Use a single-line secret value",
          ),
      })
      .parse(request.body);
    const encrypted = await encryptSecret(root, input.value);
    await db.query(
      "INSERT INTO app_secrets(app_id,name,encrypted_value) VALUES($1,$2,$3) ON CONFLICT(app_id,name) DO UPDATE SET encrypted_value=$3",
      [application.id, input.name, encrypted],
    );
    await projects.audit(user.id, "environment.updated", application.id, {
      name: input.name,
    });
    return {
      name: input.name,
      status: "stored-encrypted",
      injection: "docker-only",
    };
  });
  app.delete("/api/projects/:id/env/:name", async (request) => {
    const user = requireUser(request),
      application = await projects.application(id(request), user.id);
    const name = (request.params as { name: string }).name;
    await db.query("DELETE FROM app_secrets WHERE app_id=$1 AND name=$2", [
      application.id,
      name,
    ]);
    return { ok: true };
  });
  if (options.frontend) await serveFrontend(app);
  if (options.recover) {
    await deployments.recover();
    await agent.recover();
  }
  app.addHook("onClose", async () => {
    await agent.close();
    await deployments.close();
    await db.close();
  });
  return { app, db, projects, deployments, agent };
}
