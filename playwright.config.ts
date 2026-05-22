import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

import { getEnv } from "./src/config/env.js";
import { DEFAULT_AUTH_STATE_PATH } from "./src/playwright/auth.js";

const { HH_BASE_URL, HEADLESS } = getEnv();

export default defineConfig({
  testDir: "./src/playwright",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: HH_BASE_URL,
    headless: HEADLESS,
    locale: "ru-RU",
    timezoneId: "Asia/Novosibirsk",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "scrape",
      testMatch: /.*\.scrape\.ts/,
      dependencies: ["setup"],
      use: {
        storageState: DEFAULT_AUTH_STATE_PATH,
      },
    },
  ],
});
