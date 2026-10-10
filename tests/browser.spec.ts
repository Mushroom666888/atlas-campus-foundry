import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
const suffix = Date.now().toString(36);
async function register(page: Page, email: string, name: string) {
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.getByLabel("称呼").fill(name);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("Acceptance12345");
  await page.getByRole("button", { name: "注册并进入" }).click();
}
test("Studio and three deployed products: persisted workflows, module reuse, upload, chat, mobile", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await register(page, `studio-${suffix}@test.example`, "校园开发者");
  await expect(page.getByRole("heading", { name: "项目总览" })).toBeVisible();
  const products = [
    {
      name: `Campus Events ${suffix}`,
      kind: "events",
      description: "校园活动发布、报名、通知与地点",
    },
    {
      name: `Campus Marketplace ${suffix}`,
      kind: "marketplace",
      description: "校园二手商品、图片、搜索与买卖双方聊天",
    },
    {
      name: `Study Buddy ${suffix}`,
      kind: "study",
      description: "课程学习伙伴、小组、学习资料和聊天",
    },
  ];
  const apps: { name: string; kind: string; url: string; projectId: string }[] =
    [];
  for (const product of products) {
    await page.getByRole("link", { name: "创建产品", exact: true }).click();
    await page.getByRole("button", { name: "模块组装", exact: true }).click();
    await page.getByLabel("产品名称").fill(product.name);
    await page.getByLabel("产品需求").fill(product.description);
    await page.getByLabel("产品类型").selectOption(product.kind);
    await page.getByRole("button", { name: "创建并安装模块" }).click();
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toBeVisible();
    const projectId = page.url().split("/").pop()!;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "创建预览", exact: true }).click();
    const open = page
      .getByRole("link", { name: "打开应用", exact: true })
      .first();
    await expect(open).toBeVisible({ timeout: 45000 });
    apps.push({
      ...product,
      url: (await open.getAttribute("href"))!,
      projectId,
    });
  }
  await page.goto("/studio");
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/studio-desktop.png",
    fullPage: true,
  });
  for (const app of apps) {
    const context = await browser.newContext();
    const p = await context.newPage();
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto(app.url);
    await register(p, `owner-${suffix}@test.example`, "小林");
    await expect(
      p.getByRole("heading", { name: app.name, exact: true }),
    ).toBeVisible();
    if (app.kind === "events") {
      await p.getByRole("button", { name: "发布", exact: true }).click();
      await p.getByLabel("标题", { exact: true }).fill("校园开源夜");
      await p.getByLabel("描述", { exact: true }).fill("共同分享校园软件作品");
      await p.getByLabel("活动时间").fill("2026-11-08T18:00");
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "发布", exact: true })
        .click();
      await p
        .getByRole("button")
        .filter({ has: p.getByRole("heading", { name: "校园开源夜" }) })
        .click();
      await p.getByRole("button", { name: "报名加入" }).click();
      await expect(p.getByText("已报名", { exact: true })).toHaveCount(2);
      await p
        .getByRole("button", { name: "关闭", exact: true })
        .first()
        .click();
      await p.getByRole("button", { name: "通知", exact: true }).click();
      await expect(p.getByText("校园开源夜：报名成功")).toBeVisible();
    }
    if (app.kind === "marketplace") {
      await p.getByRole("button", { name: "发布", exact: true }).click();
      await p.getByLabel("标题", { exact: true }).fill("离散数学教材");
      await p.getByLabel("描述", { exact: true }).fill("无笔记，八成新");
      await p.getByLabel("价格（元）").fill("25");
      await p.getByLabel("上传图片").setInputFiles({
        name: "book.png",
        mimeType: "image/png",
        buffer: await sharp({
          create: {
            width: 120,
            height: 160,
            channels: 3,
            background: "#54799b",
          },
        })
          .png()
          .toBuffer(),
      });
      await expect(p.getByAltText("待发布图片")).toBeVisible();
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "发布", exact: true })
        .click();
      await p.getByLabel("搜索内容").fill("离散数学");
      await p.getByRole("button", { name: "搜索", exact: true }).click();
      await expect(
        p.getByRole("heading", { name: "离散数学教材" }),
      ).toBeVisible();
      const buyerContext = await browser.newContext();
      const buyer = await buyerContext.newPage();
      await buyer.goto(app.url);
      await register(buyer, `buyer-${suffix}@test.example`, "小周");
      await buyer
        .getByRole("button")
        .filter({ has: buyer.getByRole("heading", { name: "离散数学教材" }) })
        .click();
      await buyer.getByRole("button", { name: "联系卖家" }).click();
      await buyer.getByRole("button", { name: "关闭", exact: true }).click();
      await buyer.getByRole("button", { name: "聊天", exact: true }).click();
      await buyer
        .getByRole("button", { name: "离散数学教材", exact: true })
        .click();
      await buyer.getByLabel("聊天消息").fill("这本书还在吗？");
      await buyer.getByRole("button", { name: "发送消息" }).click();
      await expect(
        buyer.getByText("这本书还在吗？", { exact: true }),
      ).toBeVisible();
      await p.getByRole("button", { name: "聊天", exact: true }).click();
      await p
        .getByRole("button", { name: "离散数学教材", exact: true })
        .click();
      await expect(
        p.getByText("这本书还在吗？", { exact: true }),
      ).toBeVisible();
      await p.getByLabel("聊天消息").fill("还在，可以在校园当面查看。");
      await p.getByRole("button", { name: "发送消息" }).click();
      await expect(
        buyer.getByText("还在，可以在校园当面查看。", { exact: true }),
      ).toBeVisible();
      await buyerContext.close();
    }
    if (app.kind === "study") {
      await p.getByRole("button", { name: "创建小组", exact: true }).click();
      await p.getByLabel("标题", { exact: true }).fill("线性代数互助组");
      await p.getByLabel("课程或学习主题").fill("线性代数");
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "发布", exact: true })
        .click();
      await p
        .getByRole("button")
        .filter({ has: p.getByRole("heading", { name: "线性代数互助组" }) })
        .click();
      await p.getByRole("button", { name: "报名加入" }).click();
      await p
        .getByRole("button", { name: "关闭", exact: true })
        .first()
        .click();
      await p.getByRole("button", { name: "学习伙伴", exact: true }).click();
      await p.getByRole("button", { name: "创建学习资料" }).click();
      await p.getByLabel("姓名或称呼").fill("小林的学习计划");
      await p.getByLabel("学习介绍").fill("每周三学习线性代数");
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "发布", exact: true })
        .click();
      await expect(
        p.getByRole("heading", { name: "小林的学习计划" }),
      ).toBeVisible();
    }
    await p.reload();
    await expect(
      p.getByRole("heading", { name: app.name, exact: true }),
    ).toBeVisible();
    await p.getByLabel("语言 / Language").selectOption("en");
    await expect(
      p.getByRole("button", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("heading", { name: app.name, exact: true }),
    ).toBeVisible();
    await p.reload();
    await expect(p.getByLabel("语言 / Language")).toHaveValue("en");
    await p.screenshot({
      path: `artifacts/screenshots/${app.kind}-en-desktop.png`,
      fullPage: true,
    });
    await p.getByLabel("语言 / Language").selectOption("zh-CN");
    await p.screenshot({
      path: `artifacts/screenshots/${app.kind}-desktop.png`,
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        p.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await p.screenshot({
      path: `artifacts/screenshots/${app.kind}-mobile.png`,
      fullPage: true,
    });
    await context.close();
  }
  await page.goto("/modules");
  await page.getByRole("link", { name: "查看图片与媒体", exact: true }).click();
  await page.getByLabel("目标项目").selectOption(apps[0].projectId);
  await page.getByRole("button", { name: "安装到项目", exact: true }).click();
  await expect(page.getByText("模块及依赖已安装")).toBeVisible();
  await page.goto("/builder");
  await page.getByLabel("新的需求").fill("为学习小组生成新的候补功能");
  await page.getByRole("button", { name: "提交需求" }).click();
  await expect(
    page.getByText("模型尚未连接。需求已经保存，可在配置完成后重试。"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("模型尚未连接。需求已经保存，可在配置完成后重试。"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/studio-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
