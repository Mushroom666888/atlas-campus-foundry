import "dotenv/config";
import { createControl } from "../server/control.js";
import { dockerAvailable } from "../server/executor.js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
if (
  !process.env.LLM_API_KEY ||
  !process.env.LLM_MODEL ||
  !(await dockerAvailable()) ||
  process.env.ENABLE_CUSTOM_CODE !== "true" ||
  !process.env.APP_DOMAIN ||
  !process.env.PUBLIC_ORIGIN?.startsWith("https://") ||
  process.env.COOKIE_SECURE !== "true"
) {
  console.error(
    "BLOCKED: live Agent acceptance requires LLM credentials/model, Docker runner image, ENABLE_CUSTOM_CODE=true, APP_DOMAIN, HTTPS PUBLIC_ORIGIN and COOKIE_SECURE=true. See docs/USER_ACTION_REQUIRED.md.",
  );
  process.exitCode = 2;
} else {
  const root = path.resolve(".data", `live-agent-${randomUUID()}`),
    control = await createControl({ dataDir: root });
  try {
    const registered = await control.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "live-agent@test.example",
        name: "Live acceptance",
        password: randomBytes(18).toString("base64url"),
      },
    });
    if (registered.statusCode !== 201)
      throw new Error("Test account creation failed");
    const user = registered.json().user;
    const requirement =
      '创建一个真正的自定义校园学习小组候补系统。只选 identity、groups、notifications 和 search 基础模块，不安装任何 waitlist 模块，不使用 feature recipe。创建 src/feature.ts，使用 import type { Application, FeatureContext } from "./sdk.js"，导出 register(app, context)。通过 context.db 创建独立 custom_cohorts 和 custom_enrollments 表。实现需要登录的 POST /api/custom/cohorts {name,capacity} -> {id}; POST /api/custom/cohorts/:id/join -> {status:joined或waiting}; POST /api/custom/cohorts/:id/leave；GET /api/custom/cohorts/:id/members -> {items:[{user_id,status}]}。用事务锁保证并发容量，退出后按 FIFO 递补。生成 src/feature.test.ts 测试真实数据库业务逻辑和权限；数据库库可从已安装的 @electric-sql/pglite 引入。生成 public/index.html、public/client.js、public/styles.css 提供可用的登录、创建小组、报名和候补状态界面。不得内联脚本。必须先构建、测试、修复，再创建真实预览。';
    const job = await control.agent.create(user.id, requirement);
    const deadline = Date.now() + 15 * 60 * 1000;
    let final = await control.agent.get(job.id, user.id);
    while (
      ["queued", "running"].includes(final.status) &&
      Date.now() < deadline
    ) {
      await delay(1000);
      final = await control.agent.get(job.id, user.id);
    }
    if (["queued", "running"].includes(final.status))
      await control.agent.cancel(job.id, user.id);
    const events = (
      await control.db.query(
        "SELECT type,payload,created_at FROM job_events WHERE job_id=$1 ORDER BY id",
        [job.id],
      )
    ).rows;
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/live-agent-results.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          job: final,
          events,
          mode: "REAL_CONFIGURED_LLM",
        },
        null,
        2,
      ),
    );
    if (final.status !== "succeeded" || !final.project_id)
      throw new Error(`Live generation not accepted: ${final.status}`);
    const source = await control.projects.read(
      final.project_id,
      user.id,
      "src/feature.ts",
    );
    if (
      !source.includes("custom_cohorts") ||
      !source.includes("custom_enrollments")
    )
      throw new Error(
        "Expected bespoke database feature source was not generated",
      );
    console.log(
      "Live model tool workflow completed. Evidence saved. Independent feature API/browser acceptance is still required before claiming arbitrary generation quality.",
    );
  } finally {
    await control.app.close();
  }
}
