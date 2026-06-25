import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import "dotenv/config";

import { getEnv } from "./src/config/env.js";
import { DEFAULT_AUTH_STATE_PATH } from "./src/playwright/auth.js";

const { HH_BASE_URL, HEADLESS } = getEnv();
const hasAuthState = existsSync(DEFAULT_AUTH_STATE_PATH);

export default defineConfig({
  testDir: "./src/playwright",
  timeout: 180_000,
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
      // Логин только вручную (playwright:auth). Тесты читают .auth/hh-user.json.
      ...(hasAuthState ? {} : { dependencies: ["setup"] as const }),
      use: {
        storageState: DEFAULT_AUTH_STATE_PATH,
      },
    },
  ],
});
