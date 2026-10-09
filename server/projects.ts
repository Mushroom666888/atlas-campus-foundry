import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  lstat,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Database } from "./db.js";
import {
  AppError,
  productSpecSchema,
  moduleManifestSchema,
  featureRecipeSchema,
  type ProductSpec,
  type ModuleManifest,
  type FeatureRecipe,
  type PublicUser,
} from "../packages/contracts/src/index.js";
import { catalog, resolveModules } from "../packages/modules/src/catalog.js";
import { validateComposition } from "../packages/modules/src/composition.js";

export type Project = {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  idea: string;
  spec: ProductSpec;
  created_at: string;
};
export type Application = { id: string; project_id: string; spec: ProductSpec };
export class Projects {
  constructor(
    public db: Database,
    public root: string,
  ) {}
  async seed() {
    for (const manifest of catalog)
      await this.db.query(
        "INSERT INTO module_versions(module_id,version,manifest,status) VALUES($1,$2,$3,'approved') ON CONFLICT(module_id,version) DO UPDATE SET manifest=EXCLUDED.manifest WHERE module_versions.owner_id IS NULL",
        [manifest.moduleId, manifest.version, JSON.stringify(manifest)],
      );
  }
  async audit(
    actor: string,
    action: string,
    resource: string,
    detail: unknown = {},
  ) {
    await this.db.query(
      "INSERT INTO audit_log(actor_id,action,resource_id,detail) VALUES($1,$2,$3,$4)",
      [actor, action, resource, JSON.stringify(detail)],
    );
  }
  async get(id: string, actor: string): Promise<Project> {
    const row = (
      await this.db.query<Project>(
        "SELECT * FROM projects WHERE id=$1 AND owner_id=$2",
        [id, actor],
      )
    ).rows[0];
    if (!row) throw new AppError(404, "PROJECT_NOT_FOUND", "项目不存在");
    return row;
  }
  async application(projectId: string, actor: string) {
    await this.get(projectId, actor);
    const app = (
      await this.db.query<Application>(
        "SELECT * FROM applications WHERE project_id=$1",
        [projectId],
      )
    ).rows[0];
    if (!app) throw new AppError(404, "APP_NOT_FOUND", "应用不存在");
    return app;
  }
  async available(actor?: string): Promise<ModuleManifest[]> {
    return (
      await this.db.query<{ manifest: ModuleManifest }>(
        "SELECT manifest FROM module_versions WHERE status=$1 OR owner_id=$2",
        ["approved", actor ?? null],
      )
    ).rows.map((r) => r.manifest);
  }
  async create(
    actor: string,
    input: unknown,
    idea: string,
  ): Promise<{ project: Project; application: Application }> {
    const spec = productSpecSchema.parse(input);
    const resolved = resolveModules(spec.modules, await this.available(actor));
    spec.modules = resolved.map((m) => m.moduleId);
    validateComposition(spec, resolved);
    this.checkSpecSize(spec);
    const quota = (
      await this.db.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM projects WHERE owner_id=$1",
        [actor],
      )
    ).rows[0].count;
    if (quota >= 20)
      throw new AppError(429, "PROJECT_QUOTA", "每个账户最多 20 个项目");
    const projectId = randomUUID(),
      appId = randomUUID();
    await this.db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO projects(id,owner_id,name,idea,spec) VALUES($1,$2,$3,$4,$5)",
        [projectId, actor, spec.name, idea, JSON.stringify(spec)],
      );
      await tx.query(
        "INSERT INTO applications(id,project_id,spec) VALUES($1,$2,$3)",
        [appId, projectId, JSON.stringify(spec)],
      );
      for (const m of resolved)
        await tx.query(
          "INSERT INTO module_installs(app_id,module_id,version) VALUES($1,$2,$3)",
          [appId, m.moduleId, m.version],
        );
    });
    await this.scaffold(projectId, spec);
    await this.audit(actor, "project.created", projectId, {
      appId,
      modules: spec.modules,
    });
    return {
      project: await this.get(projectId, actor),
      application: await this.application(projectId, actor),
    };
  }
  workspace(id: string) {
    z.uuid().parse(id);
    return path.resolve(this.root, "projects", id);
  }
  async scaffold(id: string, spec: ProductSpec) {
    const root = this.workspace(id);
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, "product.json"),
      JSON.stringify(spec, null, 2),
    );
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          name: `foundry-${id}`,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            build: "tsc -p tsconfig.json",
            test: "node --test dist/feature.test.js",
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2023",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            outDir: "dist",
            skipLibCheck: true,
            typeRoots: ["/opt/foundry/node_modules/@types"],
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(root, "README.md"),
      `# ${spec.name}\n\n${spec.description}\n\nShared modules: ${spec.modules.join(", ")}\n\nThis project is deterministic assembly until a live Agent task edits custom code. Custom code builds and runs only through the Docker executor.\n`,
    );
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "sdk.d.ts"),
      await readFile("packages/sdk/src/feature-contract.d.ts", "utf8"),
    );
  }
  async update(id: string, actor: string, input: unknown) {
    await this.get(id, actor);
    const spec = productSpecSchema.parse(input);
    const available = await this.available(actor);
    spec.modules = resolveModules(spec.modules, available).map(
      (m) => m.moduleId,
    );
    this.checkSpecSize(spec);
    validateComposition(spec, available);
    await this.preflightWrite(
      id,
      actor,
      "product.json",
      JSON.stringify(spec, null, 2),
    );
    await this.install(id, actor, spec.modules);
    const app = await this.application(id, actor);
    spec.modules = app.spec.modules;
    await this.db.transaction(async (tx) => {
      await tx.query(
        "UPDATE projects SET name=$2,spec=$3,updated_at=now() WHERE id=$1",
        [id, spec.name, JSON.stringify(spec)],
      );
      await tx.query("UPDATE applications SET spec=$2 WHERE project_id=$1", [
        id,
        JSON.stringify(spec),
      ]);
    });
    await this.write(id, actor, "product.json", JSON.stringify(spec, null, 2));
    return this.get(id, actor);
  }
  async installs(id: string, actor: string) {
    const app = await this.application(id, actor);
    return (
      await this.db.query<{
        module_id: string;
        version: string;
        configuration: unknown;
      }>("SELECT * FROM module_installs WHERE app_id=$1", [app.id])
    ).rows;
  }
  async install(
    id: string,
    actor: string,
    requested: string[],
    pins: Record<string, string> = {},
  ) {
    const app = await this.application(id, actor);
    const manifests = resolveModules(
      requested,
      await this.available(actor),
      pins,
    );
    const previous = await this.installs(id, actor);
    const spec = { ...app.spec, modules: manifests.map((m) => m.moduleId) };
    if (spec.composition) {
      const nodes = spec.composition.nodes.filter(
        (n) =>
          spec.modules.includes(n.moduleId) &&
          (n.moduleId !== "create-linked-record" ||
            spec.modules.includes(String(n.configuration.targetModule))) &&
          (n.moduleId !== "embedded-list" ||
            spec.modules.includes(String(n.configuration.childModule))),
      );
      const ids = new Set(nodes.map((n) => n.id));
      spec.composition = nodes.length
        ? {
            ...spec.composition,
            nodes,
            edges: spec.composition.edges.filter(
              (e) => ids.has(e.source) && ids.has(e.target),
            ),
          }
        : undefined;
    }
    validateComposition(spec, manifests);
    await this.preflightWrite(
      id,
      actor,
      "product.json",
      JSON.stringify(spec, null, 2),
    );
    await this.db.transaction(async (tx) => {
      await tx.query("DELETE FROM module_installs WHERE app_id=$1", [app.id]);
      for (const m of manifests)
        await tx.query(
          "INSERT INTO module_installs(app_id,module_id,version) VALUES($1,$2,$3)",
          [app.id, m.moduleId, m.version],
        );
      await tx.query("UPDATE applications SET spec=$2 WHERE id=$1", [
        app.id,
        JSON.stringify(spec),
      ]);
      await tx.query(
        "UPDATE projects SET spec=$2,updated_at=now() WHERE id=$1",
        [id, JSON.stringify(spec)],
      );
      await tx.query(
        "INSERT INTO install_history(id,app_id,before_state,after_state) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          app.id,
          JSON.stringify(previous),
          JSON.stringify(
            manifests.map((m) => ({
              module_id: m.moduleId,
              version: m.version,
            })),
          ),
        ],
      );
    });
    await this.write(id, actor, "product.json", JSON.stringify(spec, null, 2));
    await this.audit(actor, "modules.installed", app.id, {
      modules: manifests.map((m) => `${m.moduleId}@${m.version}`),
    });
    return manifests;
  }
  async rollbackModules(id: string, actor: string) {
    const app = await this.application(id, actor);
    const entry = (
      await this.db.query<{
        before_state: { module_id: string; version: string }[];
      }>(
        "SELECT before_state FROM install_history WHERE app_id=$1 ORDER BY created_at DESC LIMIT 1",
        [app.id],
      )
    ).rows[0];
    if (!entry) throw new AppError(409, "NO_HISTORY", "没有可回滚的安装记录");
    return this.install(
      id,
      actor,
      entry.before_state.map((m) => m.module_id),
      Object.fromEntries(
        entry.before_state.map((m) => [m.module_id, m.version]),
      ),
    );
  }
  async recipes(appId: string): Promise<FeatureRecipe[]> {
    return (
      await this.db.query<{ recipe: FeatureRecipe }>(
        "SELECT v.recipe FROM module_installs i JOIN module_versions v ON i.module_id=v.module_id AND i.version=v.version WHERE i.app_id=$1 AND v.recipe IS NOT NULL",
        [appId],
      )
    ).rows.map((r) => r.recipe);
  }
  async safePath(id: string, file: string) {
    if (
      file
        .split("/")
        .some(
          (segment) =>
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment) ||
            segment.endsWith("."),
        )
    )
      throw new AppError(400, "UNSAFE_PATH", "不允许 Windows 保留文件名");
    if (
      !/^[a-zA-Z0-9_./-]{1,180}$/.test(file) ||
      file.split("/").some((s) => s === ".." || s.startsWith(".")) ||
      file.includes("//") ||
      /^(node_modules|dist|secrets)(\/|$)/.test(file)
    )
      throw new AppError(400, "UNSAFE_PATH", "路径不允许");
    const root = this.workspace(id),
      resolved = path.resolve(root, file);
    if (!resolved.startsWith(root + path.sep))
      throw new AppError(400, "UNSAFE_PATH", "路径超出项目");
    let cursor = path.dirname(resolved);
    while (cursor !== root) {
      try {
        if ((await lstat(cursor)).isSymbolicLink())
          throw new AppError(400, "UNSAFE_PATH", "不允许符号链接");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      cursor = path.dirname(cursor);
    }
    try {
      if ((await lstat(resolved)).isSymbolicLink())
        throw new AppError(400, "UNSAFE_PATH", "不允许符号链接");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const canonical = await realpath(root);
    if (path.resolve(canonical) !== path.resolve(root))
      throw new AppError(400, "UNSAFE_PATH", "项目目录已重定向");
    return resolved;
  }
  async files(id: string, actor: string) {
    await this.get(id, actor);
    const root = this.workspace(id);
    const result: { path: string; size: number }[] = [];
    const walk = async (dir: string) => {
      for (const file of await readdir(dir, { withFileTypes: true })) {
        if (
          file.isSymbolicLink() ||
          file.name.startsWith(".") ||
          ["node_modules", "dist"].includes(file.name)
        )
          continue;
        const target = path.join(dir, file.name);
        if (file.isDirectory()) await walk(target);
        else
          result.push({
            path: path.relative(root, target).replaceAll("\\", "/"),
            size: (await lstat(target)).size,
          });
      }
    };
    await walk(root);
    return result;
  }
  async read(id: string, actor: string, file: string) {
    await this.get(id, actor);
    const target = await this.safePath(id, file);
    try {
      return await readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new AppError(404, "FILE_NOT_FOUND", "文件不存在");
      throw error;
    }
  }
  private checkSpecSize(spec: ProductSpec) {
    if (Buffer.byteLength(JSON.stringify(spec, null, 2)) > 200000)
      throw new AppError(413, "FILE_TOO_LARGE", "产品配置最多 200 KB");
  }
  private async preflightWrite(
    id: string,
    actor: string,
    file: string,
    content: string,
  ) {
    await this.get(id, actor);
    if (Buffer.byteLength(content) > 200000)
      throw new AppError(413, "FILE_TOO_LARGE", "文件最多 200 KB");
    const files = await this.files(id, actor);
    if (
      files.filter((f) => f.path !== file).length >= 100 ||
      files.filter((f) => f.path !== file).reduce((n, f) => n + f.size, 0) +
        Buffer.byteLength(content) >
        2_000_000
    )
      throw new AppError(
        413,
        "PROJECT_QUOTA",
        "项目文件限额为 2 MB / 100 个文件",
      );
    const target = await this.safePath(id, file);
    return target;
  }
  async write(id: string, actor: string, file: string, content: string) {
    const target = await this.preflightWrite(id, actor, file, content);
    let previous: string | null = null;
    try {
      previous = await readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const revision = randomUUID();
    const history = path.resolve(this.root, "revisions", id);
    await mkdir(history, { recursive: true });
    await writeFile(
      path.join(history, `${revision}.json`),
      JSON.stringify({
        path: file,
        actor,
        at: new Date().toISOString(),
        before: previous,
        after: content,
      }),
      { mode: 0o600 },
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    await this.audit(actor, "file.written", id, {
      file,
      bytes: Buffer.byteLength(content),
      revision,
    });
    return { path: file, bytes: Buffer.byteLength(content) };
  }
  async extract(id: string, actor: string, input: unknown) {
    await this.get(id, actor);
    const data = z
      .object({
        moduleId: z.string(),
        name: z.string().min(1).max(80),
        version: z.string(),
        sourceFile: z.string(),
      })
      .parse(input);
    if (catalog.some((m) => m.moduleId === data.moduleId))
      throw new AppError(409, "RESERVED_MODULE", "平台内置模块标识不可覆盖");
    const existingOwners = (
      await this.db.query<{ owner_id: string }>(
        "SELECT owner_id FROM module_versions WHERE module_id=$1",
        [data.moduleId],
      )
    ).rows;
    if (existingOwners.some((row) => row.owner_id !== actor))
      throw new AppError(
        403,
        "MODULE_OWNER_REQUIRED",
        "只有模块所有者可以发布新版本",
      );
    const recipe = featureRecipeSchema.parse(
      JSON.parse(await this.read(id, actor, data.sourceFile)),
    );
    const manifest = moduleManifestSchema.parse({
      moduleId: data.moduleId,
      name: data.name,
      version: data.version,
      description: `Capacity and FIFO waiting list for ${recipe.entity}`,
      category: "extension",
      capabilities: ["capacity-waitlist"],
      configurationSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      providedInterfaces: ["campus.waitlist@1"],
      requiredInterfaces: [
        `campus.${recipe.entity === "event" ? "events" : "groups"}@1`,
      ],
      dependencies: {
        [recipe.entity === "event" ? "events" : "groups"]: "^1.0.0",
        notifications: "^1.0.0",
      },
      databaseMigrations: [],
      requiredPermissions: ["membership:own"],
      eventsProduced: ["waitlist.promoted"],
      eventsConsumed: ["membership.left"],
      frontendExports: ["MembershipState"],
      backendExports: ["CapacityPolicy"],
      healthChecks: ["/api/health"],
      testSpecifications: ["tests/runtime.test.ts"],
      compatiblePlatformVersions: "^0.1.0",
      securityMetadata: {
        review: "pending",
        execution: "declarative",
        network: [],
      },
      license: "MIT",
    });
    await this.db.query(
      "INSERT INTO module_versions(module_id,version,manifest,recipe,source_project_id,owner_id,status) VALUES($1,$2,$3,$4,$5,$6,'pending')",
      [
        manifest.moduleId,
        manifest.version,
        JSON.stringify(manifest),
        JSON.stringify(recipe),
        id,
        actor,
      ],
    );
    await this.audit(actor, "module.extracted", manifest.moduleId, {
      version: manifest.version,
      sourceFile: data.sourceFile,
    });
    return { manifest, recipe, status: "pending" };
  }
  async review(user: PublicUser, id: string, version: string) {
    if (user.role !== "admin")
      throw new AppError(403, "ADMIN_REQUIRED", "需要平台管理员审核");
    const row = (
      await this.db.query<{ manifest: ModuleManifest; recipe: FeatureRecipe }>(
        "SELECT manifest,recipe FROM module_versions WHERE module_id=$1 AND version=$2",
        [id, version],
      )
    ).rows[0];
    if (!row) throw new AppError(404, "NOT_FOUND", "模块不存在");
    featureRecipeSchema.parse(row.recipe);
    const manifest = moduleManifestSchema.parse({
      ...row.manifest,
      securityMetadata: {
        ...row.manifest.securityMetadata,
        review: "approved",
      },
    });
    resolveModules(Object.keys(manifest.dependencies), await this.available());
    await this.db.query(
      "UPDATE module_versions SET status='approved',reviewed_by=$3,manifest=$4 WHERE module_id=$1 AND version=$2",
      [id, version, user.id, JSON.stringify(manifest)],
    );
    await this.audit(user.id, "module.approved", id, { version });
    return manifest;
  }
}
