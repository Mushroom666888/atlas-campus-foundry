import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function register(page: Page, name: string) {
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.getByLabel("称呼").fill(name);
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`${Date.now()}@modules.test`);
  await page.getByLabel("密码", { exact: true }).fill("ModuleBrowser12345");
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page.getByRole("button", { name: "注册并进入" })).toBeHidden();
}

test("94-module explorer, interactive details and persisted +references", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await register(page, "模块开发者");
  await page.goto("/modules");
  await expect(page.getByText(/94 个内置模块/)).toBeVisible();
  for (const [label, count] of [
    ["基础能力", 10],
    ["商业经营", 10],
    ["用户社区", 4],
    ["校园功能", 50],
    ["连接自动化", 12],
    ["展示组件", 8],
  ] as const) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(count);
  }
  await page.getByRole("tab", { name: "全部模块", exact: true }).click();
  await page.getByLabel("搜索模块", { exact: true }).fill("失物");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page.getByRole("link", { name: "查看失物招领" }).click();
  await expect(
    page.getByRole("heading", { name: "失物招领", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .first()
    .fill("预览里的校园卡");
  await page.getByLabel("信息类型").selectOption("寻物");
  await page.getByLabel("地点", { exact: false }).fill("图书馆");
  await page.getByLabel("日期", { exact: false }).fill("2026-10-10");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("预览里的校园卡", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "看板", exact: true }).click();
  await expect(page.locator(".record-board")).toContainText("预览里的校园卡");
  await page.getByRole("button", { name: "卡片", exact: true }).click();
  await expect(page.getByText("预览里的校园卡", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "接口与数据" }).click();
  await expect(page.getByRole("heading", { name: "连接接口" })).toBeVisible();
  await expect(
    page.getByText("/api/modules/lost-found/records", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "依赖与权限" }).click();
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/module-detail.png",
    fullPage: true,
  });
  await page.goto("/modules/media");
  await page
    .getByLabel("选择图片")
    .setInputFiles("public/assets/atlas-icon.png");
  await expect(page.getByRole("img", { name: "atlas-icon.png" })).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: "atlas-icon.png" })
      .evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.goto("/modules/campus");
  await page.getByLabel("纬度").fill("0");
  await page.getByLabel("经度").fill("0");
  await expect(
    page.getByRole("link", { name: "在 OpenStreetMap 查看地点" }),
  ).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/?mlat=0&mlon=0#map=16/0/0",
  );
  await page.goto("/modules/events");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await expect(page.getByLabel("活动日期")).toBeVisible();
  await expect(page.getByLabel("人数上限")).toBeVisible();
  await page.goto("/builder");
  await page.getByLabel("新的需求").fill("我要找回物品 +失物");
  await page.getByRole("button", { name: /失物招领.*lost-found/ }).click();
  await expect(page.locator(".reference-chips")).toContainText("+失物招领");
  await page.getByRole("button", { name: "提交需求" }).click();
  await expect(page).toHaveURL(/job=/);
  const jobId = new URL(page.url()).searchParams.get("job");
  const job = await (await page.request.get(`/api/jobs/${jobId}`)).json();
  expect(
    job.events.some((e: { type: string }) => e.type === "module_references"),
  ).toBeTruthy();
  expect(job.job.status).toBe("blocked");
  await page.goto("/modules");
  await expect(page.locator(".catalog-card")).toHaveCount(94);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "artifacts/screenshots/modules-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/screenshots/modules-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("described drag and connect builds a validated application with notifications, embedded records and display widgets", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await register(page, "画布开发者");
  await page.goto("/compose");
  await page.getByLabel("应用名称").fill("校园失物协作台");
  await page
    .getByLabel("产品描述")
    .fill(
      "学生发布失物招领信息，记录跟进事项，创建记录后发送通知并支持按状态搜索。",
    );
  await page.getByLabel("搜索画布模块").fill("失物招领");
  await page
    .getByRole("button", { name: "添加失物招领" })
    .dragTo(page.getByLabel("模块编排画布"), {
      targetPosition: { x: 65, y: 130 },
    });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const modules = [
    "记录创建触发",
    "通知操作者",
    "个人待办",
    "表格视图",
    "关键词搜索框",
    "状态筛选器",
    "记录计数",
    "状态汇总",
    "内嵌记录区",
  ];
  for (const name of modules) {
    await page.getByLabel("搜索画布模块").fill(name);
    await page
      .getByRole("button", { name: `添加${name}`, exact: true })
      .click();
  }
  await page.locator(".react-flow__controls-fitview").click();
  async function connect(source: string, target: string, mode = "auto") {
    await page.getByLabel("连接类型").selectOption(mode);
    const from = page.getByLabel(`${source}输出`, { exact: true });
    const to = page.getByLabel(`${target}输入`, { exact: true });
    await from.dragTo(to);
  }
  await connect("失物招领", "记录创建触发");
  await connect("记录创建触发", "通知操作者");
  for (const target of [
    "表格视图",
    "关键词搜索框",
    "状态筛选器",
    "记录计数",
    "状态汇总",
    "内嵌记录区",
  ])
    await connect("失物招领", target);
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "内嵌记录区" })
    .click();
  await page.getByLabel("目标模块").selectOption("checklists");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/project=/);
  const id = new URL(page.url()).searchParams.get("project")!;
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(12);
  expect(
    (await page.locator(".canvas-library .search-input").boundingBox())!.height,
  ).toBeLessThan(50);
  const saved = await (await page.request.get(`/api/projects/${id}`)).json();
  expect(
    saved.project.spec.composition.edges.filter(
      (e: { mode: string }) => e.mode !== "dependency",
    ),
  ).toHaveLength(8);
  expect(
    saved.project.spec.composition.edges.filter(
      (e: { mode: string }) => e.mode === "dependency",
    ),
  ).toHaveLength(4);
  await page.screenshot({
    path: "artifacts/screenshots/canvas-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "生成应用", exact: true }).click();
  await expect(page.getByRole("link", { name: "打开应用" })).toBeVisible({
    timeout: 45000,
  });
  const url = (await page
    .getByRole("link", { name: "打开应用" })
    .getAttribute("href"))!;
  const context = await browser.newContext();
  const app = await context.newPage();
  app.on("pageerror", (e) => errors.push(e.message));
  try {
    await app.goto(url);
    await register(app, "失物同学");
    await app.getByRole("button", { name: "失物招领", exact: true }).click();
    await app.getByRole("button", { name: "新增", exact: true }).click();
    await app
      .getByRole("dialog")
      .getByRole("textbox")
      .first()
      .fill("蓝色校园卡");
    await app.getByLabel("信息类型").selectOption("寻物");
    await app.getByLabel("地点", { exact: false }).fill("图书馆");
    await app.getByLabel("日期", { exact: false }).fill("2026-10-10");
    await app.getByRole("button", { name: "保存", exact: true }).click();
    await expect(app.getByRole("table")).toContainText("蓝色校园卡");
    await expect(app.locator(".record-metrics")).toContainText("1");
    await app.getByLabel("搜索失物招领").fill("找不到的物品");
    await expect(app.getByText("暂无符合条件的记录")).toBeVisible();
    await app.getByLabel("搜索失物招领").fill("");
    await app.getByLabel("筛选状态").selectOption("已找回");
    await expect(app.getByText("暂无符合条件的记录")).toBeVisible();
    await app.getByLabel("筛选状态").selectOption("");
    await app.getByRole("button", { name: "蓝色校园卡", exact: true }).click();
    await app
      .getByRole("dialog")
      .getByRole("button", { name: "新增", exact: true })
      .click();
    const editor = app.getByRole("dialog", {
      name: "新增个人待办",
      exact: true,
    });
    await editor.getByRole("textbox").first().fill("联系失物中心");
    await editor.getByLabel("优先级").selectOption("高");
    await editor.getByLabel("截止日期").fill("2026-10-11");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(app.getByText("联系失物中心", { exact: true })).toBeVisible();
    await app.reload();
    await app.getByRole("button", { name: "失物招领", exact: true }).click();
    await app.getByRole("button", { name: "蓝色校园卡", exact: true }).click();
    await expect(app.getByText("联系失物中心", { exact: true })).toBeVisible();
    await app.screenshot({
      path: "artifacts/screenshots/visual-app-embedded.png",
      fullPage: true,
    });
    await app.getByRole("button", { name: "关闭", exact: true }).click();
    const notifications = await app.evaluate(async () =>
      (await fetch("/api/notifications")).json(),
    );
    expect(JSON.stringify(notifications)).toContain("蓝色校园卡");
    await app.setViewportSize({ width: 390, height: 844 });
    await app.screenshot({
      path: "artifacts/screenshots/visual-app-mobile.png",
      fullPage: true,
    });
    expect(
      await app.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  } finally {
    await context.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/screenshots/canvas-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
