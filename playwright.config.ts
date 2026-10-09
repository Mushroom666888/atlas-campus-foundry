import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "**/browser.spec.ts",
    "**/modules.browser.spec.ts",
    "**/atlas.browser.spec.ts",
  ],
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "artifacts/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 960 },
  },
  webServer: {
    command: "node --import tsx server/main.ts",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      PORT: "3100",
      DATA_DIR: ".data/browser-tests",
      DEPLOYMENT_PROVIDER: "local-trusted",
      ALLOW_REGISTRATION: "true",
      PUBLIC_ORIGIN: "http://127.0.0.1:3100",
      LLM_API_KEY: "",
      LLM_MODEL: "",
    },
  },
});
