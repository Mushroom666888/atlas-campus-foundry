import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("creator forum, public profile and product showcase persist across users and mobile routes", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `creator-${Date.now()}@browser.test`;
  const postTitle = `寻找校园商业产品合伙人 ${Date.now()}`;
  await page.goto("/studio");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.getByLabel("称呼").fill("校园创作者");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("CreatorPassword123");
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page.getByRole("heading", { name: "项目总览" })).toBeVisible();
  await page.getByRole("link", { name: "我的主页", exact: true }).click();
  await page.getByRole("button", { name: "编辑主页" }).click();
  await page.getByLabel("公开名称").fill("做生意的林同学");
  await page.getByLabel("学校（选填）").fill("自填大学");
  await page.getByLabel("个人简介").fill("做校园交易和毕业摄影预约产品。");
  await page.getByLabel("标签（最多 8 个，用逗号分隔）").fill("校园创业,摄影");
  await page.getByRole("button", { name: "保存并公开" }).click();
  await expect(
    page.getByRole("heading", { name: "做生意的林同学" }),
  ).toBeVisible();
  const profileUrl = page.url();
  await page.getByRole("button", { name: "发布产品", exact: true }).click();
  await page.getByLabel("产品名称").fill("毕业季摄影预约");
  await page.getByLabel("一句话介绍").fill("让学生摄影师找到校内客户");
  await page
    .getByRole("combobox", { name: "领域", exact: true })
    .selectOption("校园服务");
  await page.getByLabel("当前阶段").selectOption("内测中");
  await page
    .getByLabel("产品简介")
    .fill("按时段预约摄影服务，面向校内毕业生。");
  await page
    .getByLabel("访问地址（选填）")
    .fill("https://example.org/photography");
  await page.getByRole("button", { name: "保存并公开" }).click();
  await expect(
    page.getByRole("heading", { name: "毕业季摄影预约" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "毕业季摄影预约" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "创作者论坛", exact: true }).click();
  await page.getByRole("button", { name: "发起讨论" }).click();
  await page.getByLabel("标题", { exact: true }).fill(postTitle);
  await page.getByLabel("话题").selectOption("寻找合作");
  await page
    .getByLabel("内容", { exact: true })
    .fill("希望一起经营摄影产品 <img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "保存并公开" }).click();
  await page.getByRole("link", { name: postTitle, exact: true }).click();
  await expect(page.locator(".community-prose")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".community-prose img")).toHaveCount(0);
  const postUrl = page.url();
  await page.getByLabel("你的回复").fill("先把第一个可用版本做出来。");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(page.locator(".community-reply")).toContainText(
    "第一个可用版本",
  );
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  try {
    await publicPage.goto(postUrl);
    await expect(
      publicPage.getByRole("heading", { name: postTitle }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("button", { name: "编辑讨论" }),
    ).toHaveCount(0);
    await expect(
      publicPage.getByRole("link", { name: "登录后参与讨论" }),
    ).toBeVisible();
    await publicPage.goto(profileUrl);
    await expect(publicPage.locator(".creator-school")).toBeVisible();
    await expect(publicPage.getByText(email, { exact: true })).toHaveCount(0);
    await publicPage
      .getByRole("link", { name: "毕业季摄影预约", exact: true })
      .click();
    await expect(
      publicPage.getByRole("link", { name: "访问产品" }),
    ).toHaveAttribute("href", "https://example.org/photography");
  } finally {
    await visitor.close();
  }
  await mkdir("artifacts/screenshots", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [label, url] of [
      ["forum", "/community"],
      ["products", "/community/products"],
      ["profile", profileUrl],
      ["directory", "/community/creators"],
    ]) {
      await page.goto(url);
      await expect(page.locator(".community-main")).toBeVisible();
      await expect(page.locator(".community-main .loading")).toHaveCount(0);
      await expect(page.locator(".community-main h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `artifacts/screenshots/community-${label}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});

test("canvas marks incompatible links red, requires intent and preserves validated dependencies", async ({
  page,
}) => {
  const registered = await page.request.post("/api/auth/register", {
    data: {
      email: `canvas-${Date.now()}@browser.test`,
      password: "CanvasPassword123",
      name: "画布验收",
    },
  });
  expect(registered.status()).toBe(201);
  await page.goto("/compose?add=sales-orders");
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "生成应用", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("产品描述")
    .fill(
      "学生买卖教材，店主设置库存，买家提交订单后卖家确认，取消订单自动归还库存。",
    );
  await expect(page.locator(".canvas-validation")).toContainText(
    "结构校验通过",
  );
  await page.getByLabel("搜索画布模块").fill("表格视图");
  await page.getByRole("button", { name: "添加表格视图", exact: true }).click();
  await page.getByLabel("连接类型").selectOption("display");
  await page.getByLabel("连线起点").selectOption({ label: "交易订单" });
  await page.getByLabel("连线终点").selectOption({ label: "表格视图" });
  await page.getByRole("button", { name: "添加连线", exact: true }).click();
  await expect(page.locator(".invalid-edge")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "生成应用", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "表格视图" })
    .click();
  await page.getByRole("button", { name: "移除节点" }).click();
  await expect(page.locator(".invalid-edge")).toHaveCount(0);
  await expect(page.locator(".canvas-validation")).toContainText(
    "结构校验通过",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/project=/);
  await page.reload();
  await expect(page.getByLabel("产品描述")).toHaveValue(/学生买卖教材/);
  await expect(page.locator(".canvas-validation")).toContainText(
    "结构校验通过",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.screenshot({
      path: `artifacts/screenshots/guided-canvas-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
});
