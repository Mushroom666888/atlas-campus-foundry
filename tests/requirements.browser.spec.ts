import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("structured specification, Canvas retention, conflicting source edits and history recovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/auth/register", {
    data: {
      email: `requirements-${Date.now()}@atlas.test`,
      password: "Requirements123",
    },
  });
  const result = await page.request.post("/api/projects", {
    data: {
      spec: {
        name: "Requirements acceptance",
        description: "校园活动报名与真实场地关联",
        kind: "events",
        modules: ["events"],
        features: ["活动发布"],
        primaryColor: "rose",
      },
    },
  });
  expect(result.status()).toBe(201);
  const { project } = await result.json();
  const projectUrl = `/projects/${project.id}`;
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "添加角色", exact: true }).click();
  await page.getByLabel("角色名称", { exact: true }).fill("活动组织者");
  await page
    .getByLabel("职责与权限", { exact: true })
    .fill("维护自己的活动与报名");
  await page.getByRole("button", { name: "添加模型", exact: true }).click();
  await page.getByLabel("模型名称", { exact: true }).fill("活动资料");
  await page.getByRole("button", { name: "添加场景", exact: true }).click();
  await page.getByLabel("场景名称", { exact: true }).fill("发布并查看活动");
  await page
    .getByLabel("前置条件", { exact: true })
    .fill("已登录，存在有效场地");
  await page.getByLabel("用户操作", { exact: true }).fill("提交活动名称与场地");
  await page
    .getByLabel("预期结果", { exact: true })
    .fill("活动持久化，重启后仍可读取");
  const relatedModules = page.getByRole("group", {
    name: "关联模块",
    exact: true,
  });
  await relatedModules.getByLabel("events", { exact: true }).check();
  await relatedModules.getByLabel("campus", { exact: true }).check();
  await page.getByRole("button", { name: "保存规格", exact: true }).click();
  await expect(page.getByText("产品规格已更新", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("场景名称", { exact: true })).toHaveValue(
    "发布并查看活动",
  );
  const beforeCanvas = (
    await (await page.request.get(`/api/projects/${project.id}`)).json()
  ).project.spec;
  expect(
    (
      await (
        await page.request.get(`/api/projects/${project.id}/requirements`)
      ).json()
    ).scenarios[0].status,
  ).toBe("NOT_RUN");
  await page
    .getByRole("main")
    .getByRole("link", { name: "可视化编排", exact: true })
    .click();
  await expect(page.getByText("结构校验通过", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true }).first()).toBeVisible();
  const afterCanvas = (
    await (await page.request.get(`/api/projects/${project.id}`)).json()
  ).project.spec;
  expect(afterCanvas.requirements).toEqual(beforeCanvas.requirements);
  expect(afterCanvas.kind).toBe("events");
  expect(afterCanvas.primaryColor).toBe("rose");
  expect(
    afterCanvas.composition.nodes.find(
      (node: { moduleId: string }) => node.moduleId === "identity",
    ).position.x,
  ).toBe(40);
  expect(
    afterCanvas.composition.nodes.find(
      (node: { moduleId: string }) => node.moduleId === "events",
    ).position.x,
  ).toBe(440);
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "项目文件", exact: true }).click();
  await page.getByRole("button", { name: "新建文件", exact: true }).click();
  await page.getByLabel("文件路径").fill("src/review.txt");
  await page.getByLabel("文件内容").fill("Original version");
  await page.getByRole("button", { name: "保存文件", exact: true }).click();
  await expect(page.getByText("文件已保存", { exact: true })).toBeVisible();
  const fileUrl = `/api/projects/${project.id}/file`;
  const snapshot = await (
    await page.request.get(fileUrl + "?path=src/review.txt")
  ).json();
  const concurrent = await page.request.put(fileUrl, {
    data: {
      path: "src/review.txt",
      content: "Concurrent editor version",
      expectedHash: snapshot.hash,
    },
  });
  expect(concurrent.status()).toBe(200);
  await page.getByLabel("文件内容").fill("Unsaved human edit");
  await page.getByRole("button", { name: "保存文件", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("文件已有更新");
  await expect(page.getByLabel("文件内容")).toHaveValue("Unsaved human edit");
  await page.getByRole("button", { name: "文件历史", exact: true }).click();
  await page.locator(".file-history-list button").first().click();
  await expect(page.locator(".revision-source").last()).toHaveText(
    "Concurrent editor version",
  );
  await expect(page.getByRole("button", { name: "恢复此版本" })).toBeDisabled();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .locator(".file-tree")
    .getByRole("button", { name: "src/review.txt", exact: true })
    .click();
  await expect(page.getByLabel("文件内容")).toHaveValue(
    "Concurrent editor version",
  );
  await page.getByRole("button", { name: "文件历史", exact: true }).click();
  await page.locator(".file-history-list button").last().click();
  await page.getByRole("button", { name: "恢复此版本" }).click();
  await expect(page.getByLabel("文件内容")).toHaveValue("Original version");
  expect(
    (await (await page.request.get(fileUrl + "?path=src/review.txt")).json())
      .content,
  ).toBe("Original version");
  await page
    .locator(".file-tree")
    .getByRole("button", { name: "product.json", exact: true })
    .click();
  await expect(page.getByLabel("文件内容")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "产品与模块", exact: true }).click();
  await page.getByLabel("语言 / Language").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Acceptance scenarios" }),
  ).toBeVisible();
  await expect(page.getByLabel("Scenario title")).toHaveValue("发布并查看活动");
  await mkdir("docs/evidence/2026-10-12-requirements", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/evidence/2026-10-12-requirements/spec-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("deployed campus directory: hierarchy forms, private affiliation, event venue and bilingual mobile", async ({
  page,
  browser,
}) => {
  await page.request.post("/api/auth/register", {
    data: {
      email: `campus-${Date.now()}@atlas.test`,
      password: "CampusDirectory123",
    },
  });
  const { project } = await (
    await page.request.post("/api/projects", {
      data: {
        spec: {
          name: "Campus Domain Acceptance",
          description: "真实校园目录与活动归属",
          kind: "events",
          modules: ["events"],
          features: [],
        },
      },
    })
  ).json();
  const deployment = await (
    await page.request.post(`/api/projects/${project.id}/deploy`)
  ).json();
  expect(deployment.status).toBe("running");
  const context = await browser.newContext();
  const app = await context.newPage();
  const errors: string[] = [];
  app.on("pageerror", (e) => errors.push(e.message));
  try {
    const base = `http://127.0.0.1:${deployment.port}`;
    await context.request.post(`${base}/api/auth/register`, {
      data: {
        email: "owner@campus-directory.test",
        password: "CampusDirectory123",
        name: "校园维护者",
      },
    });
    await app.goto(base);
    await app.getByRole("button", { name: "校园目录", exact: true }).click();
    async function add(
      kind: string,
      name: string,
      extra?: () => Promise<void>,
    ) {
      await app
        .locator(".campus-directory .tabs")
        .getByRole("button", { name: kind, exact: true })
        .click();
      await app.getByRole("button", { name: "新增资料", exact: true }).click();
      await app.getByRole("dialog").getByLabel("资料名称").fill(name);
      if (extra) await extra();
      await app
        .getByRole("dialog")
        .getByRole("button", { name: "保存", exact: true })
        .click();
      await expect(app.getByRole("dialog")).toHaveCount(0);
      await expect(
        app.locator(".campus-records strong").getByText(name, { exact: true }),
      ).toBeVisible();
    }
    await add("学校", "Acceptance university");
    const university = (
      await (
        await context.request.get(`${base}/api/campus/universities`)
      ).json()
    ).items[0];
    await app
      .locator(".campus-filters")
      .getByLabel("所属学校")
      .selectOption(university.id);
    await add("校区", "North campus");
    const campus = (
      await (await context.request.get(`${base}/api/campus/campuses`)).json()
    ).items[0];
    await add("建筑", "Library", async () => {
      await app
        .getByRole("dialog")
        .getByLabel("所属校区")
        .selectOption(campus.id);
    });
    const building = (
      await (await context.request.get(`${base}/api/campus/buildings`)).json()
    ).items[0];
    await add("场地", "Room 201", async () => {
      await app
        .getByRole("dialog")
        .getByLabel("所属校区")
        .selectOption(campus.id);
      await app
        .getByRole("dialog")
        .getByLabel("所属建筑")
        .selectOption(building.id);
      await app.getByRole("dialog").getByLabel("容量").fill("25");
    });
    const venue = (
      await (await context.request.get(`${base}/api/campus/venues`)).json()
    ).items[0];
    await add("课程", "Distributed systems", async () => {
      await app.getByRole("dialog").getByLabel("课程代码").fill("CS401");
    });
    await add("社团", "Open source club");
    await app
      .getByRole("button", { name: "添加学校关系", exact: true })
      .click();
    await app
      .locator(".campus-affiliations")
      .getByLabel("所属学校")
      .selectOption(university.id);
    await app
      .locator(".campus-affiliations")
      .getByLabel("专业或学习方向")
      .fill("计算机科学");
    await app
      .locator(".campus-affiliations")
      .getByRole("button", { name: "保存", exact: true })
      .click();
    await expect(app.locator(".campus-affiliations")).toContainText(
      "自主声明，非官方认证",
    );
    const event = await (
      await context.request.post(`${base}/api/entities`, {
        data: { kind: "event", title: "Open source meetup", data: {} },
      })
    ).json();
    await app.getByRole("button", { name: "校园活动", exact: true }).click();
    await app
      .getByRole("button")
      .filter({ has: app.getByRole("heading", { name: "Open source meetup" }) })
      .click();
    await app.getByRole("button", { name: "设置活动场地" }).click();
    await app
      .getByRole("dialog")
      .getByLabel("所属学校")
      .selectOption(university.id);
    await app
      .getByRole("dialog")
      .getByLabel("活动场地", { exact: true })
      .selectOption(venue.id);
    await app
      .getByRole("dialog")
      .getByRole("button", { name: "保存", exact: true })
      .click();
    await expect(app.getByRole("dialog")).toContainText(
      "Acceptance university / Room 201",
    );
    expect(
      (
        await (
          await context.request.get(
            `${base}/api/campus/events/${event.id}/location`,
          )
        ).json()
      ).location.venue_id,
    ).toBe(venue.id);
    await app
      .getByRole("dialog")
      .getByRole("button", { name: "关闭", exact: true })
      .first()
      .click();
    await app.reload();
    await app.getByRole("button", { name: "校园目录", exact: true }).click();
    await expect(app.locator(".campus-records")).toContainText(
      "Acceptance university",
    );
    await app.getByLabel("语言 / Language").selectOption("en");
    await expect(
      app.getByRole("heading", { name: "Campus directory", exact: true }),
    ).toBeVisible();
    for (const width of [1440, 390, 320]) {
      await app.setViewportSize({ width, height: 950 });
      expect(
        await app.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await app.screenshot({
        path: `docs/evidence/2026-10-12-requirements/campus-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  } catch (error) {
    await app.screenshot({
      path: "docs/evidence/2026-10-12-requirements/domain-runtime-failure.png",
      fullPage: true,
    });
    await writeFile(
      ".data/requirements-runtime-failure.json",
      JSON.stringify(
        { errors, url: app.url(), text: await app.locator("body").innerText() },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await context.close();
    await page.request.post(`/api/deployments/${deployment.id}/stop`);
  }
});
