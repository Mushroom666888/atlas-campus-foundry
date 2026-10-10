import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("Atlas brand home: real imagery, working navigation, responsive composition and reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ATLAS", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".atlas-art-front")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator(".atlas-nebula")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await mkdir("artifacts/screenshots", { recursive: true });
  for (const [width, height] of [
    [1920, 1080],
    [1440, 960],
    [1280, 800],
    [1024, 768],
    [768, 1024],
    [414, 896],
    [390, 844],
    [375, 667],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: `artifacts/screenshots/atlas-home-${width}.png`,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    const hero = await page.locator(".atlas-hero").boundingBox();
    expect(hero!.height).toBeLessThan(height);
    const action = await page
      .getByRole("link", { name: /创造你的世界/ })
      .boundingBox();
    expect(action!.y + action!.height).toBeLessThan(height);
    const wordmark = await page.locator(".atlas-wordmark").boundingBox();
    const intro = await page.locator(".atlas-intro").boundingBox();
    const bottom = await page.locator(".atlas-hero-bottom").boundingBox();
    expect(wordmark!.y).toBeGreaterThan(intro!.y + intro!.height);
    expect(wordmark!.y + wordmark!.height).toBeLessThan(bottom!.y);
    expect(
      await page
        .locator(".atlas-hero-bottom p")
        .evaluate((p) => parseFloat(getComputedStyle(p).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await page
        .locator(".atlas-wordmark")
        .evaluate((h) => h.scrollWidth <= h.clientWidth + 1),
    ).toBeTruthy();
    expect(
      await page
        .locator(".atlas-wordmark")
        .evaluate(
          (h) =>
            h.clientHeight < parseFloat(getComputedStyle(h).fontSize) * 1.2,
        ),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "打开菜单" }).click();
  await expect(
    page.getByRole("navigation", { name: "首页导航" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭菜单" }).click();
  await page.getByRole("tab", { name: /校园功能/ }).click();
  await expect(page.getByRole("tabpanel", { name: "校园功能" })).toContainText(
    "课程笔记",
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: "artifacts/screenshots/atlas-home-full.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .locator(".atlas-wordmark")
      .evaluate((h) => getComputedStyle(h).animationName),
  ).toBe("none");
  await page.getByRole("link", { name: /创造你的世界/ }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("heading", { name: "登录工作台" })).toBeVisible();
  expect(errors).toEqual([]);
});
