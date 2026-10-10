import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("bilingual Studio: persisted language, owner deletion/restore and ZIP download", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("语言 / Language").selectOption("en");
  await expect(
    page.getByRole("link", { name: "Explore modules", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("语言 / Language")).toHaveValue("en");
  await page.goto("/studio");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("语言验收 User");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`lifecycle-${Date.now()}@atlas.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("BrowserLifecycle123");
  await page
    .getByRole("button", { name: "Create account and continue" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/projects", {
    data: {
      idea: "Lifecycle browser verification",
      spec: {
        name: "中文名称 Remains",
        description: "User data stays unchanged after switching language",
        kind: "custom",
        modules: ["sales-orders", "discussion-forum"],
        features: [],
        primaryColor: "green",
      },
    },
  });
  expect(response.status()).toBe(201);
  const { project } = await response.json();
  await page.goto(`/projects/${project.id}`);
  await page
    .getByRole("button", { name: "Export application", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(project.id);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project 中文名称 Remains" })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "中文名称 Remains" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete project 中文名称 Remains" })
    .click();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator(".project-list-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    page.getByText("中文名称 Remains", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("button", { name: "Restore project" }).click();
  await page.getByRole("button", { name: "Back to my projects" }).click();
  await expect(
    page.getByText("中文名称 Remains", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("语言 / Language").selectOption("zh-CN");
  await expect(
    page.getByRole("heading", { name: "项目总览", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("中文名称 Remains", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("idea-first Canvas: blocked design saved, manual refinement, English filters and responsive UI", async ({
  page,
}) => {
  await page.request.post("/api/auth/register", {
    data: {
      email: `design-${Date.now()}@atlas.test`,
      password: "BrowserDesign123",
      name: "Designer",
    },
  });
  await page.goto("/compose");
  await expect(
    page.getByRole("heading", { name: "先说想法，再一起设计。" }),
  ).toBeVisible();
  await expect(page.getByLabel("连接类型")).toHaveCount(0);
  await page
    .getByLabel("产品需求", { exact: true })
    .fill("我要做校园摄影预约生意 +service-booking");
  await page.getByRole("button", { name: "让 AI 设计方案" }).click();
  await expect(page).toHaveURL(/design=/);
  await expect(
    page.getByText("模型尚未连接。需求已经保存，可在配置完成后重试。"),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".design-job")).toContainText("校园摄影预约生意");
  await page.getByRole("link", { name: "手动选择模块" }).click();
  await page.getByLabel("语言 / Language").selectOption("en");
  await expect(page.getByLabel("Connection type")).toBeHidden();
  await page.getByLabel("Search Canvas modules").fill("booking");
  await page
    .getByRole("button", { name: "AddService bookings", exact: true })
    .click();
  await expect(page.locator(".plan-modules")).toContainText("Service bookings");
  await page
    .getByLabel("Product description", { exact: true })
    .fill("学生摄影师提供拍摄时段，顾客预约并接收通知。");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/project=/);
  await page
    .getByRole("button", { name: "Technical connections", exact: true })
    .click();
  await expect(page.locator(".react-flow__edge")).not.toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await page.locator(".react-flow__node").first().boundingBox())
          ?.width ?? 0,
    )
    .toBeGreaterThan(140);
  await mkdir("artifacts/screenshots", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.screenshot({
      path: `artifacts/screenshots/canvas-en-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/modules");
  await page.getByLabel("Search modules", { exact: true }).fill("booking");
  await expect(page.locator(".catalog-card")).toHaveCount(2);
  await expect(page.locator(".catalog-card")).toContainText([
    "Service bookings",
    "Business dashboard",
  ]);
  await page.getByLabel("Search modules", { exact: true }).fill("");
  await page
    .getByLabel("Filter by domain")
    .selectOption({ label: "Service marketplace" });
  await expect(page.locator(".catalog-card")).not.toHaveCount(0);
  await page.goto("/modules/lost-found");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Listing type").selectOption({ label: "Lost" });
  await expect(page.getByLabel("Listing type")).toHaveValue("寻物");
});

test("bilingual visual audit: readable CJK font, mobile layouts, working routes and preserved form state", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const registered = await page.request.post("/api/auth/register", {
    data: {
      email: `visual-${Date.now()}@atlas.test`,
      password: "VisualBrowser123",
      name: "Visual creator",
    },
  });
  expect(registered.status()).toBe(201);
  await mkdir("artifacts/screenshots", { recursive: true });
  const report: unknown[] = [];
  for (const language of ["zh-CN", "en"]) {
    await page.goto("/studio");
    await page.getByLabel("语言 / Language").selectOption(language);
    for (const [slug, route] of [
      ["home", "/"],
      ["modules", "/modules"],
      ["module", "/modules/sales-orders"],
      ["design", "/compose"],
      ["plan", "/compose?add=sales-orders"],
      ["community", "/community"],
    ]) {
      await page.goto(route);
      await expect(page.locator(".loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 960 });
        await page.screenshot({
          path: `artifacts/screenshots/followup-${slug}-${language}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        report.push({
          language,
          route,
          width,
          chinese:
            language === "en"
              ? (await page.locator("body").innerText())
                  .split("\n")
                  .filter((text) => /[\u3400-\u9fff]/.test(text))
              : [],
        });
      }
      await page.waitForTimeout(1000);
    }
  }
  await page.goto("/compose?mode=manual");
  await page
    .getByLabel("Product description", { exact: true })
    .fill("Do not erase this unsaved input");
  await page.getByLabel("语言 / Language").selectOption("zh-CN");
  await expect(page.getByLabel("产品描述", { exact: true })).toHaveValue(
    "Do not erase this unsaved input",
  );
  await page.goto("/modules");
  await expect(page.locator(".catalog-card h3").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const domDocument = await cdp.send("DOM.getDocument");
  const element = await cdp.send("DOM.querySelector", {
    nodeId: domDocument.root.nodeId,
    selector: ".catalog-card h3",
  });
  const fonts = await cdp.send("CSS.getPlatformFontsForNode", {
    nodeId: element.nodeId,
  });
  expect(
    fonts.fonts.every((font) => !font.familyName.includes("Atlas Sans")),
  ).toBe(true);
  expect(
    fonts.fonts.some((font) =>
      /YaHei|PingFang|Noto Sans/.test(font.familyName),
    ),
  ).toBe(true);
  report.push({ fonts });
  await writeFile(
    "artifacts/followup-ui-audit.json",
    JSON.stringify(report, null, 2),
  );
  expect(errors).toEqual([]);
});
