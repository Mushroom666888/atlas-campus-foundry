import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveModules } from "../packages/modules/src/catalog.js";
import type {
  Composition,
  ProductSpec,
} from "../packages/contracts/src/index.js";

const root = path.resolve(process.env.DATA_DIR || ".data");
const base =
  process.env.FOUNDRY_URL ||
  JSON.parse(await readFile(path.join(root, "local-running.json"), "utf8")).url;
const credentials = JSON.parse(
  await readFile(path.join(root, "local-access.json"), "utf8"),
);
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(credentials),
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")!.split(";")[0];
async function request<T>(
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const response = await fetch(base + url, {
    method,
    headers: { cookie, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}
const ids = [
  "lost-found",
  "when-created",
  "notify-author",
  "checklists",
  "table-view",
  "keyword-search",
  "status-picker",
  "metric-counter",
  "status-summary",
  "embedded-list",
];
const graph: Composition = {
  version: 1,
  nodes: ids.map((moduleId, i): Composition["nodes"][number] => ({
    id: moduleId,
    moduleId,
    position: { x: (i % 3) * 310, y: Math.floor(i / 3) * 180 },
    configuration:
      moduleId === "embedded-list" ? { childModule: "checklists" } : {},
  })),
  edges: [
    { id: "event", source: "lost-found", target: "when-created", mode: "flow" },
    {
      id: "notify",
      source: "when-created",
      target: "notify-author",
      mode: "flow",
    },
    ...ids
      .slice(4)
      .map((target) => ({
        id: `display-${target}`,
        source: "lost-found",
        target,
        mode: "display" as const,
      })),
  ],
};
const spec: ProductSpec = {
  name: "校园失物协作台",
  description: "失物招领、个人跟进事项与自动通知",
  kind: "custom",
  modules: resolveModules(ids).map((m) => m.moduleId),
  features: [],
  primaryColor: "green",
  composition: graph,
};
const existing = await request<{ items: { id: string; name: string }[] }>(
  "/api/projects",
);
let project = existing.items.find((p) => p.name === spec.name);
if (!project)
  project = (
    await request<{ project: { id: string; name: string } }>("/api/projects", {
      idea: "Visual composition",
      spec,
    })
  ).project;
const deployments = await request<{
  items: { status: string; app_id: string; port: number }[];
}>(`/api/deployments?projectId=${project.id}`);
let deployment = deployments.items.find((d) => d.status === "running");
if (!deployment || process.argv.includes("--redeploy"))
  deployment = await request(`/api/projects/${project.id}/deploy`, {});
if (deployment!.status !== "running")
  throw new Error("Visual application deployment failed");
const url = `http://app-${deployment!.app_id}.localhost:${deployment!.port}`;
const health = await fetch(`http://127.0.0.1:${deployment!.port}/api/health`);
if (!health.ok) throw new Error(`Health failed: ${health.status}`);
const result = {
  projectId: project.id,
  studio: `${base}/compose?project=${project.id}`,
  url,
  status: "DEPLOYED locally",
  generation: "declarative composition; no model inference",
  at: new Date().toISOString(),
};
await writeFile(
  path.join(root, "visual-showcase.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
