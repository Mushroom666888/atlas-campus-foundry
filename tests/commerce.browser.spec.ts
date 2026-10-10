import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { commerceCatalog } from "../packages/modules/src/commerce-catalog.js";
import { communityCatalog } from "../packages/modules/src/community-catalog.js";

async function register(page: Page, name: string) {
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.getByLabel("称呼").fill(name);
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`user-${Date.now()}@commerce.browser`);
  await page.getByLabel("密码", { exact: true }).fill("CommerceBrowser123");
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page.getByRole("button", { name: "注册并进入" })).toBeHidden();
}
test("commercial modules deploy a real multiuser shop, orders, appointments and reusable forum", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/auth/register", {
    data: {
      email: `merchant-dev-${Date.now()}@test.example`,
      name: "商业开发者",
      password: "CommerceBrowser123",
    },
  });
  const created = await page.request.post("/api/projects", {
    data: {
      idea: "校园里经营商品交易与服务预约，同时提供用户论坛和主页",
      spec: {
        name: "校园商业社区",
        description: "商家上架、下单交付、摄影预约、用户交流",
        kind: "custom",
        modules: [...commerceCatalog, ...communityCatalog].map(
          (m) => m.moduleId,
        ),
        features: [],
        primaryColor: "green",
      },
    },
  });
  expect(created.status()).toBe(201);
  const projectId = (await created.json()).project.id;
  const deployment = await page.request.post(
    `/api/projects/${projectId}/deploy`,
    { data: {}, timeout: 60000 },
  );
  const deployed = await deployment.json();
  expect(deployed.status, deployed.logs).toBe("running");
  const url = `http://app-${deployed.app_id}.localhost:${deployed.port}`;
  const sellerContext = await browser.newContext(),
    buyerContext = await browser.newContext(),
    seller = await sellerContext.newPage(),
    buyer = await buyerContext.newPage();
  seller.on("pageerror", (e) => errors.push(e.message));
  buyer.on("pageerror", (e) => errors.push(e.message));
  try {
    await seller.goto(url);
    await register(seller, "商家");
    await seller.getByRole("button", { name: "商家店铺", exact: true }).click();
    await seller.getByRole("button", { name: "开设店铺", exact: true }).click();
    await seller.getByLabel("店铺名称").fill("校园手作工坊");
    await seller.getByLabel("店铺介绍").fill("原创帆布袋和毕业季摄影服务");
    await seller.getByLabel("营业地点").fill("校园南门");
    await seller.getByRole("button", { name: "确认保存" }).click();
    await expect(
      seller.getByRole("heading", { name: "校园手作工坊" }),
    ).toBeVisible();
    await seller.getByRole("button", { name: "商品货架", exact: true }).click();
    await seller.getByRole("button", { name: "发布商品", exact: true }).click();
    await seller.getByLabel("商品名称").fill("校园纪念帆布袋");
    await seller.getByLabel("商品说明").fill("原创图案，现场交付");
    await seller.getByLabel("分类", { exact: true }).fill("原创手作");
    await seller.getByLabel("单价（元）").fill("39");
    await seller.getByLabel("可售库存").fill("3");
    await seller
      .getByLabel("商品图片")
      .setInputFiles("public/assets/atlas-icon.png");
    await seller.getByRole("button", { name: "确认保存" }).click();
    await expect(
      seller.getByRole("heading", { name: "校园纪念帆布袋" }),
    ).toBeVisible();
    await buyer.goto(url);
    await register(buyer, "买家");
    await buyer.getByRole("button", { name: "查看商品", exact: true }).click();
    await buyer.getByRole("button", { name: "提交订单", exact: true }).click();
    await expect(buyer.getByText(/下单成功/)).toBeVisible();
    await buyer.getByRole("button", { name: "交易订单", exact: true }).click();
    await expect(buyer.getByText("待接单", { exact: true })).toBeVisible();
    await seller
      .getByRole("button", { name: "交付与核销", exact: true })
      .click();
    await seller.getByRole("button", { name: "确认接单" }).click();
    await seller.getByRole("button", { name: "安排交付" }).click();
    await seller
      .getByLabel("交付地点与取货说明")
      .fill("明天下午南门，报姓名取货");
    await seller.getByRole("button", { name: "确认保存" }).click();
    await expect(seller.getByText("待取货", { exact: true })).toBeVisible();
    await buyer.getByRole("button", { name: "商品货架", exact: true }).click();
    await buyer.getByRole("button", { name: "交易订单", exact: true }).click();
    await buyer.getByRole("button", { name: "确认收货" }).click();
    await buyer.getByRole("button", { name: "评价订单" }).click();
    await buyer.getByLabel("交易体验").fill("交付顺利，帆布袋很好看");
    await buyer.getByRole("button", { name: "确认保存" }).click();
    await buyer.getByRole("button", { name: "交易评价", exact: true }).click();
    await expect(buyer.getByText("交付顺利，帆布袋很好看")).toBeVisible();
    await buyer.reload();
    await buyer.getByRole("button", { name: "交易评价", exact: true }).click();
    await expect(buyer.getByText("交付顺利，帆布袋很好看")).toBeVisible();
    await seller.getByRole("button", { name: "服务预约", exact: true }).click();
    await seller.getByRole("button", { name: "发布服务时段" }).click();
    await seller.getByLabel("服务名称").fill("毕业摄影半小时");
    await seller.getByLabel("服务介绍").fill("毕业照片服务");
    await seller.getByLabel("每人价格（元）").fill("99");
    await seller.getByLabel("服务时间").fill("2027-12-15T10:00");
    await seller.getByLabel("预约名额").fill("2");
    await seller.getByRole("button", { name: "确认保存" }).click();
    await buyer.getByRole("button", { name: "服务预约", exact: true }).click();
    await buyer.getByRole("button", { name: "预约此时段" }).click();
    await expect(buyer.getByText("已预约", { exact: true })).toBeVisible();
    await buyer.getByRole("button", { name: "取消预约" }).click();
    await expect(buyer.getByText("已取消", { exact: true })).toBeVisible();
    await seller.getByRole("button", { name: "经营看板", exact: true }).click();
    await expect(seller.locator(".commerce-metrics")).toContainText("¥39.00");
    await buyer.getByRole("link", { name: "交流论坛", exact: true }).click();
    await buyer.getByRole("button", { name: "发起讨论" }).click();
    await buyer
      .getByLabel("标题", { exact: true })
      .fill("这家校园店的设计很棒");
    await buyer
      .getByLabel("内容", { exact: true })
      .fill("这是一条真实部署应用里的论坛帖子。");
    await buyer.getByRole("button", { name: "保存并公开" }).click();
    await expect(
      buyer.getByRole("heading", { name: "这家校园店的设计很棒" }),
    ).toBeVisible();
    const runtimeForum = await buyer.evaluate(async () => {
      const response = await fetch("/api/community/posts");
      if (!response.ok) throw new Error("Runtime forum read failed");
      return response.json();
    });
    expect(runtimeForum.items).toHaveLength(1);
    const platformForum = await page.request.get(
      "/api/community/posts?q=这家校园店的设计很棒",
    );
    expect((await platformForum.json()).items).toHaveLength(0);
    await mkdir("artifacts/screenshots", { recursive: true });
    for (const width of [1440, 390, 320]) {
      await seller.setViewportSize({ width, height: 900 });
      await seller.screenshot({
        path: `artifacts/screenshots/commerce-analytics-${width}.png`,
        fullPage: true,
      });
      expect(
        await seller.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
      await buyer.setViewportSize({ width, height: 900 });
      await buyer.screenshot({
        path: `artifacts/screenshots/runtime-forum-${width}.png`,
        fullPage: true,
      });
      expect(
        await buyer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
    for (const m of [...commerceCatalog, ...communityCatalog]) {
      await page.goto(`/modules/${m.moduleId}`);
      await expect(
        page.getByRole("heading", { name: m.name, exact: true }).first(),
      ).toBeVisible();
      await expect(page.locator(".module-preview-body")).not.toBeEmpty();
    }
    await page.getByLabel("搜索示例成员").fill("摄影");
    await expect(page.locator(".community-demo-directory article")).toHaveCount(
      1,
    );
    await expect(page.locator(".community-demo-directory")).toContainText(
      "陈同学",
    );
    await page.getByRole("button", { name: "接口与数据", exact: true }).click();
    await expect(page.locator(".commerce-interfaces")).toContainText(
      "GET /api/community/directory",
    );
    expect(errors).toEqual([]);
  } finally {
    await sellerContext.close();
    await buyerContext.close();
    await page.request.post(`/api/deployments/${deployed.id}/stop`, {
      data: {},
    });
  }
});
