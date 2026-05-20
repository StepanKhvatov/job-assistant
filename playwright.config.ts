import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const baseURL = process.env.HH_SCRAPE_BASE_URL ?? "https://novosibirsk.hh.ru";
const statePath = process.env.HH_AUTH_STATE_PATH ?? ".auth/hh-user.json";

export default defineConfig({
  testDir: "./src/playwright",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
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
        storageState: statePath,
      },
    },
  ],
});
