import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = JSON.parse(await readFile(".data/local-running.json", "utf8")).url;
const credentials = JSON.parse(
  await readFile(".data/local-access.json", "utf8"),
);
const showcase = JSON.parse(await readFile(".data/showcase.json", "utf8"));
const visual = JSON.parse(await readFile(".data/visual-showcase.json", "utf8"));
const directory = "artifacts/atlas-redesign";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
const errors: string[] = [];
const results: { route: string; width: number; heading: string }[] = [];
try {
  const response = await context.request.post(`${base}/api/auth/login`, {
    data: credentials,
  });
  expect(response.status()).toBe(200);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    "/studio",
    "/modules",
    "/modules/study-waitlist",
    "/modules/lost-found",
    "/modules/events",
    "/modules/when-created",
    "/modules/table-view",
    "/compose",
    `/compose?project=${visual.projectId}`,
    "/builder",
    "/create",
    "/deployments",
    "/publisher",
    `/projects/${showcase.applications[0].projectId}`,
  ];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 800 ? 960 : 844 });
    for (const [index, route] of routes.entries()) {
      await page.goto(base + route);
      await expect(page.locator(".workspace")).toBeVisible();
      await expect(page.locator(".workspace .loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      if (route.includes("/compose?project=")) {
        await expect(
          page.locator(".react-flow__edge-text").first(),
        ).toBeVisible();
        expect(
          await page
            .locator(".react-flow__edge-text")
            .first()
            .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        ).toBeGreaterThanOrEqual(16);
      }
      expect(
        (await page.locator(".workspace").innerText()).trim().length,
      ).toBeGreaterThan(20);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${directory}/${width}-${index}.png` });
      results.push({
        route,
        width,
        heading: (await page.locator(".workspace h1").count())
          ? (await page.locator(".workspace h1").first().textContent()) || ""
          : "Canvas",
      });
    }
  }
  expect(errors).toEqual([]);
  console.log(
    `PASS: ${results.length} existing-account route/viewport checks; no page errors.`,
  );
} finally {
  await writeFile(
    `${directory}/routes.json`,
    JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2),
  );
  await browser.close();
}
