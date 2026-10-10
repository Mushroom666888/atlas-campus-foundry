import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { commerceCatalog } from "../packages/modules/src/commerce-catalog.js";
import { communityCatalog } from "../packages/modules/src/community-catalog.js";
import { resolveModules } from "../packages/modules/src/catalog.js";
import type {
  ProductSpec,
  Composition,
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
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(base + url, {
    method: body ? "POST" : "GET",
    headers: { cookie, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}
const modules = resolveModules(
  [...commerceCatalog, ...communityCatalog]
    .map((m) => m.moduleId)
    .concat("chat"),
);
const indexByLayer = [0, 0];
const graph: Composition = {
  version: 2,
  nodes: modules.map((m) => {
    const lane = m.category === "foundation" ? 0 : 1;
    return {
      id: m.moduleId,
      moduleId: m.moduleId,
      position: { x: 40 + lane * 400, y: 140 + indexByLayer[lane]++ * 215 },
      configuration: {},
    };
  }),
  edges: modules.flatMap((m) =>
    Object.keys(m.dependencies).map((d) => ({
      id: `${d}-${m.moduleId}`,
      source: d,
      target: m.moduleId,
      mode: "dependency" as const,
    })),
  ),
};
const spec: ProductSpec = {
  name: "Campus Commerce",
  description:
    "面向校园的多商家商品与服务平台：商家发布商品及库存、买家下单线下结算、确认收货与评价，并提供服务时段预约和创作者论坛。",
  kind: "custom",
  modules: modules.map((m) => m.moduleId),
  features: [],
  primaryColor: "green",
  composition: graph,
};
const projects = await request<{ items: { id: string; name: string }[] }>(
  "/api/projects",
);
let project = projects.items.find((p) => p.name === spec.name);
if (!project)
  project = (
    await request<{ project: { id: string; name: string } }>("/api/projects", {
      spec,
      idea: spec.description,
    })
  ).project;
const deployments = await request<{
  items: {
    id: string;
    status: string;
    app_id: string;
    port: number;
    logs: string;
  }[];
}>(`/api/deployments?projectId=${project.id}`);
let deployed = deployments.items.find((d) => d.status === "running");
if (!deployed || process.argv.includes("--redeploy"))
  deployed = await request(`/api/projects/${project.id}/deploy`, {});
if (deployed!.status !== "running")
  throw new Error(deployed!.logs || "Commercial deployment failed");
const url = `http://app-${deployed!.app_id}.localhost:${deployed!.port}`;
const health = await fetch(`http://127.0.0.1:${deployed!.port}/api/health`);
if (!health.ok) throw new Error("Health check failed");
const result = {
  projectId: project.id,
  studio: `${base}/compose?project=${project.id}`,
  url,
  status: "DEPLOYED locally; trusted shared runtime",
  modules: modules.map((m) => m.moduleId),
  payments: "offline settlement only",
  at: new Date().toISOString(),
};
await writeFile(
  path.join(root, "commercial-showcase.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
