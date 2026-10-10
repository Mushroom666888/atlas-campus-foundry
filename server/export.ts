import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { AppError } from "../packages/contracts/src/index.js";
import type { Projects } from "./projects.js";

export async function exportProject(
  projects: Projects,
  id: string,
  actor: string,
) {
  const project = await projects.get(id, actor);
  const app = await projects.application(id, actor);
  const files: Record<string, Uint8Array> = {};
  let size = 0;
  const put = (name: string, data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? strToU8(data) : data;
    size += bytes.length;
    if (size > 40_000_000)
      throw new AppError(413, "EXPORT_TOO_LARGE", "导出包超过 40 MB");
    files[name.replaceAll("\\", "/")] = bytes;
  };
  const copy = async (file: string) => {
    const stat = await lstat(file);
    if (stat.isSymbolicLink())
      throw new AppError(400, "EXPORT_SYMLINK", "导出不允许符号链接");
    if (stat.isDirectory()) {
      for (const child of await readdir(file)) {
        if (child.startsWith(".") || child === "node_modules") continue;
        await copy(path.join(file, child));
      }
    } else {
      if (stat.size > 15_000_000)
        throw new AppError(413, "EXPORT_TOO_LARGE", "导出文件过大");
      put(file, await readFile(file));
    }
  };
  // Explicit shipped-source allowlist excludes the control plane and all private storage.
  for (const file of [
    "packages",
    "migrations/runtime",
    "web",
    "public",
    "dist",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "package-lock.json",
    "LICENSE",
    ...[
      "runtime-server",
      "auth",
      "db",
      "http",
      "providers",
      "storage-lock",
    ].map((name) => `server/${name}.ts`),
  ])
    await copy(file);
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  pkg.scripts = {
    start: "tsx standalone.ts",
    build: "vite build",
    verify: "node verify.mjs",
    deploy: "docker compose up --build -d",
  };
  put("package.json", JSON.stringify(pkg, null, 2));
  put("product.json", JSON.stringify(project.spec, null, 2));
  put(
    "module-lock.json",
    JSON.stringify(await projects.installs(id, actor), null, 2),
  );
  put("recipes.json", JSON.stringify(await projects.recipes(app.id), null, 2));
  for (const file of await projects.files(id, actor))
    put(`workspace/${file.path}`, await projects.read(id, actor, file.path));
  put(
    "standalone.ts",
    `import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRuntime } from './server/runtime-server.js';
import { productSpecSchema } from './packages/contracts/src/index.js';
// Exported project code requires a separate review/build; only the shipped runtime executes.
process.env.ENABLE_CUSTOM_CODE = 'false';
const spec = productSpecSchema.parse(JSON.parse(await readFile('product.json', 'utf8')));
const recipes = JSON.parse(await readFile('recipes.json', 'utf8'));
const { app } = await createRuntime({ appId: ${JSON.stringify(app.id)}, spec, modules: spec.modules, recipes, dataDir: path.resolve(process.env.APP_DATA_DIR || './app-data') }, { frontend: true, logger: true, databaseUrl: process.env.APP_DATABASE_URL });
await app.listen({ host: process.env.RUNTIME_HOST || '127.0.0.1', port: Number(process.env.RUNTIME_PORT || 4100) });
const stop = () => void app.close().then(() => process.exit(0));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
if (process.send) process.on('disconnect', stop);
`,
  );
  put(
    "verify.mjs",
    `import 'dotenv/config';
const base = 'http://127.0.0.1:' + (process.env.RUNTIME_PORT || 4100);
for (const route of ['/', '/api/health', '/api/application']) { const response = await fetch(base + route); if (!response.ok) throw new Error(route + ': ' + response.status); console.log(route + ' OK'); }
`,
  );
  put(
    ".env.example",
    "RUNTIME_HOST=127.0.0.1\nRUNTIME_PORT=4100\nAPP_DATA_DIR=./app-data\n# APP_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/APP_DATABASE\n# RUNTIME_PUBLIC_ORIGIN=https://your-app.example.com\n# COOKIE_SECURE=true\n# EMAIL_PROVIDER=smtp\n# SMTP_URL=smtps://USER:PASSWORD@HOST:465\n# EMAIL_FROM=notifications@example.com\n",
  );
  put(
    "Dockerfile",
    'FROM node:24-bookworm-slim\nWORKDIR /opt/atlas\nCOPY --chown=node:node . .\nRUN npm ci --ignore-scripts && mkdir -p /app-data && chown node:node /app-data\nUSER node\nENV NODE_ENV=production RUNTIME_HOST=0.0.0.0 APP_DATA_DIR=/app-data\nEXPOSE 4100\nCMD ["npm","start"]\n',
  );
  put(
    "compose.yaml",
    'services:\n  app:\n    build: .\n    init: true\n    restart: unless-stopped\n    ports: ["127.0.0.1:4100:4100"]\n    volumes: ["app-data:/app-data"]\n    environment:\n      RUNTIME_PUBLIC_ORIGIN: ${RUNTIME_PUBLIC_ORIGIN:-http://localhost:4100}\n      COOKIE_SECURE: ${COOKIE_SECURE:-false}\n      APP_DATABASE_URL: ${APP_DATABASE_URL:-}\n      EMAIL_PROVIDER: ${EMAIL_PROVIDER:-local}\n      SMTP_URL: ${SMTP_URL:-}\n      EMAIL_FROM: ${EMAIL_FROM:-}\n    read_only: true\n    tmpfs: ["/tmp:rw,noexec,nosuid,size=64m"]\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    mem_limit: 1g\n    cpus: 1\n    pids_limit: 128\n    logging:\n      options: {max-size: 5m, max-file: \'2\'}\n    healthcheck:\n      test: [CMD, node, verify.mjs]\n      interval: 30s\n      timeout: 10s\n      start_period: 60s\n      retries: 3\nvolumes:\n  app-data:\n',
  );
  put(".dockerignore", "node_modules\n.env\napp-data\nworkspace\n.git\n");
  put(
    "README.md",
    `# ${project.name.replace(/[\r\n]/g, " ")}

Independent Atlas application / Atlas 独立应用

## Local / 本地
Install Node.js 24. Run these commands in the extracted folder:

    npm ci --ignore-scripts
    npm start

Open http://127.0.0.1:4100 and register a new app account.
In a second terminal: npm run verify
Stop with Ctrl+C; restart with npm start. Data persists in app-data/.
配置：将 .env.example 复制为 .env，按需填写。不要提交密钥。

## Cloud / 云部署
Dedicated server: npm run deploy (Docker + Compose required).
Use a TLS reverse proxy to 127.0.0.1:4100. Set RUNTIME_PUBLIC_ORIGIN
and COOKIE_SECURE=true in .env for HTTPS. Back up the app-data volume.
Commands: docker compose logs --tail 100; docker compose restart;
docker compose down (retains volume). Never use down -v to preserve data.
Cloud configuration is provided; no remote deployment is claimed.
This is a dedicated trusted application, not a hostile multi-tenant sandbox.

## Contents / 内容
product.json: editable specification; module-lock.json: installed versions;
recipes.json: reviewed policies; packages/: shared runtime; web/: frontend;
dist/: prebuilt frontend; workspace/: original project source for review.
Run npm run build after editing the frontend. Custom workspace code is
included for development but is NOT automatically executed.
导出不包含平台账户、应用数据、密钥或 Agent 凭据，不能代替数据备份。
No live payment gateway or school SSO is implied. Verify external providers
before exposing your application. Local email uses app-data/outbox.

Source checksums are in export-manifest.json. Exported ${new Date().toISOString()}.
`,
  );
  put(
    "export-manifest.json",
    JSON.stringify(
      {
        projectId: id,
        appId: app.id,
        format: 1,
        dataIncluded: false,
        customCodeExecution: false,
        files: Object.fromEntries(
          Object.entries(files).map(([name, bytes]) => [
            name,
            createHash("sha256").update(bytes).digest("hex"),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  await projects.audit(actor, "project.exported", id, {
    bytes: size,
    dataIncluded: false,
  });
  return Buffer.from(zipSync(files, { level: 5 }));
}
