import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run start:e2e --workspace=@pastagansa/api",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:3100/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run start:e2e --workspace=@pastagansa/web",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:3101/acceso",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
