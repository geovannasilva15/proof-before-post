import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox", "--single-process", "--no-zygote", "--disable-dev-shm-usage"] } : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && node scripts/dev-e2e.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { viewport: { width: 1365, height: 900 } } }],
});
