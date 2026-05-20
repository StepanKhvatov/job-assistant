import { test } from "@playwright/test";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "./auth.js";
import { resolveScrapeEnv } from "./config.js";
import { scrapeVacancyDetailById } from "./vacancy-page.js";

test("parse vacancy page", async ({ page }) => {
  const env = resolveScrapeEnv();
  assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

  const hhId = process.env.HH_VACANCY_ID?.trim() || "132469416";
  const detail = await scrapeVacancyDetailById(page, env.baseUrl, hhId);

  console.log(`[job-assistant][${HH_AUTH_PROVIDER}]`, JSON.stringify(detail, null, 2));
});
