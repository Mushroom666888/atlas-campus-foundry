import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductSpec } from "../packages/contracts/src/index.js";
const root = path.resolve(process.env.DATA_DIR || ".data");
await mkdir(root, { recursive: true });
let base = process.env.FOUNDRY_URL || "http://127.0.0.1:3000";
try {
  base = JSON.parse(
    await readFile(path.join(root, "local-running.json"), "utf8"),
  ).url;
} catch {
  /* Explicit URL/default is used when launched directly. */
}
const credentialPath = path.join(root, "local-access.json");
let credentials: { email: string; password: string; name: string };
let isNew = false;
try {
  credentials = JSON.parse(await readFile(credentialPath, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  credentials = {
    email: "developer@campus.local",
    password: randomBytes(18).toString("base64url"),
    name: "校园产品开发者",
  };
  await writeFile(credentialPath, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  isNew = true;
}
const login = await fetch(`${base}/api/auth/${isNew ? "register" : "login"}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(credentials),
});
if (!login.ok)
  throw new Error(
    `Local developer account failed: HTTP ${login.status}. Credentials retained in ${credentialPath}`,
  );
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
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || `HTTP ${response.status}`);
  return result as T;
}
const specs: ProductSpec[] = [
  {
    name: "Campus Events",
    description: "校园活动与社团报名；发布活动、查找地点、管理报名与通知。",
    kind: "events",
    modules: ["events", "search", "groups"],
    features: ["活动发布", "活动搜索", "活动报名", "站内通知", "校园地点"],
    primaryColor: "green",
  },
  {
    name: "Campus Marketplace",
    description: "校园闲置物品交易；发布带图片的商品，与同学沟通交易。",
    kind: "marketplace",
    modules: ["content", "search", "chat", "media", "profiles"],
    features: ["商品发布", "图片上传", "商品搜索", "买卖双方聊天", "商品状态"],
    primaryColor: "rose",
  },
  {
    name: "Study Buddy",
    description: "找到同课程的学习伙伴，组建学习小组，交流资料和学习安排。",
    kind: "study",
    modules: [
      "profiles",
      "groups",
      "chat",
      "campus",
      "search",
      "notifications",
    ],
    features: [
      "学习资料",
      "课程主题",
      "查找伙伴",
      "学习小组",
      "聊天",
      "学习地点",
    ],
    primaryColor: "blue",
  },
];
const existing = await request<{
  items: { id: string; name: string; spec: ProductSpec }[];
}>("/api/projects");
const result = [];
for (const spec of specs) {
  let project = existing.items.find((p) => p.name === spec.name);
  if (!project) {
    project = (
      await request<{
        project: { id: string; name: string; spec: ProductSpec };
      }>("/api/projects", { spec, idea: spec.description })
    ).project;
    await request("/api/jobs", {
      input: `${spec.description} 请为它生成个性化业务逻辑。`,
      projectId: project.id,
    });
  }
  if (spec.kind === "study") {
    await request(
      `/api/projects/${project.id}/file`,
      {
        path: "features/waitlist.json",
        content: JSON.stringify(
          {
            type: "capacity-waitlist",
            version: 1,
            entity: "group",
            capacityField: "capacity",
            promotion: "fifo",
            notify: true,
          },
          null,
          2,
        ),
      },
      "PUT",
    );
    const modules = await request<{
      items: { moduleId: string; securityMetadata: { review: string } }[];
    }>("/api/modules");
    if (!modules.items.some((m) => m.moduleId === "study-waitlist"))
      await request(`/api/projects/${project.id}/extract`, {
        moduleId: "study-waitlist",
        name: "学习小组候补队列",
        version: "1.0.0",
        sourceFile: "features/waitlist.json",
      });
    const pending = await request<{ items: { module_id: string }[] }>(
      "/api/modules/pending",
    );
    if (pending.items.some((m) => m.module_id === "study-waitlist"))
      await request("/api/modules/study-waitlist/approve", {
        version: "1.0.0",
      });
    await request(`/api/projects/${project.id}/modules`, {
      modules: [...spec.modules, "study-waitlist"],
    });
  }
  const deployments = await request<{
    items: { id: string; status: string; port: number; app_id: string }[];
  }>(`/api/deployments?projectId=${project.id}`);
  let deployment = deployments.items.find((d) => d.status === "running");
  if (process.argv.includes("--redeploy")) deployment = undefined;
  if (!deployment)
    deployment = await request(`/api/projects/${project.id}/deploy`, {});
  if (deployment!.status !== "running")
    throw new Error(`${spec.name} failed to deploy; inspect Studio logs`);
  const runtimeBase = `http://127.0.0.1:${deployment!.port}`;
  let runtimeLogin = await fetch(`${runtimeBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (runtimeLogin.status === 401)
    runtimeLogin = await fetch(`${runtimeBase}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
  if (!runtimeLogin.ok)
    throw new Error("Showcase runtime account setup failed");
  const runtimeCookie = runtimeLogin.headers.get("set-cookie")!.split(";")[0];
  const records = (await (
    await fetch(`${runtimeBase}/api/entities`, {
      headers: { cookie: runtimeCookie },
    })
  ).json()) as { items: unknown[] };
  if (!records.items.length) {
    const samples =
      spec.kind === "events"
        ? [
            {
              kind: "event",
              title: "校园开源交流夜（示例活动）",
              body: "本地验收样例：交流校园产品创意，分享开源项目。此记录通过公开 API 持久化写入。",
              data: { capacity: 30, date: "2026-11-08T18:00" },
            },
            {
              kind: "group",
              title: "校园开发者社团（示例）",
              body: "讨论校园技术实践与项目协作。",
              data: { capacity: 20 },
            },
          ]
        : spec.kind === "marketplace"
          ? [
              {
                kind: "listing",
                title: "离散数学教材（示例商品）",
                body: "本地验收样例，不是真实售卖信息。可以体验搜索、状态修改与联系卖家。",
                data: { price: 25 },
              },
              {
                kind: "listing",
                title: "台灯（示例商品）",
                body: "本地验收样例，不是真实售卖信息。",
                data: { price: 35 },
              },
            ]
          : [
              {
                kind: "group",
                title: "线性代数互助组（示例）",
                body: "每周一起讨论习题；容量满后可加入候补。",
                data: { capacity: 3, course: "线性代数" },
              },
              {
                kind: "course",
                title: "线性代数",
                body: "本地示例学习主题，不是学校官方课程目录。",
                data: {},
              },
              {
                kind: "profile",
                title: "校园产品开发者",
                body: "本地验收账户的学习资料，可编辑。",
                data: { course: "线性代数", interests: "学习与校园软件" },
              },
            ];
    for (const sample of samples) {
      const created = await fetch(`${runtimeBase}/api/entities`, {
        method: "POST",
        headers: { cookie: runtimeCookie, "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      });
      if (created.status !== 201)
        throw new Error(`Sample persistence failed: ${created.status}`);
    }
  }
  result.push({
    name: spec.name,
    projectId: project.id,
    applicationId: deployment!.app_id,
    url: `http://app-${deployment!.app_id}.localhost:${deployment!.port}`,
    deploymentId: deployment!.id,
    assembly: "deterministic-shared-modules",
    aiStatus: process.env.LLM_API_KEY
      ? "configured-not-asserted"
      : "BLOCKED_NO_CREDENTIALS",
  });
}
await writeFile(
  path.join(root, "showcase.json"),
  JSON.stringify(
    {
      studio: base,
      applications: result,
      createdAt: new Date().toISOString(),
      credentialFile: credentialPath,
    },
    null,
    2,
  ),
);
console.log(
  `Studio: ${base}\nLocal credentials: ${credentialPath}\n` +
    result.map((app) => `${app.name}: ${app.url}`).join("\n"),
);
